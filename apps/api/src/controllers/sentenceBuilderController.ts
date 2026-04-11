/**
 * Sentence-builder quiz controller.
 *
 * The sentence-builder quiz asks the user to reconstruct a short
 * target-language sentence from shuffled tiles. The correct answer is
 * generated up-front by the LLM using {@link resolveModel} so BYOK users
 * hit their own provider; the default path uses the system Gemini key via
 * the same helper the translation routes use.
 *
 * Challenges are held in a process-local LRU cache so the `validate`
 * endpoint can check a submitted ordering without re-hitting the model.
 * In-memory caching is a deliberate simplification — we considered a
 * dedicated `sentence_challenges` table, but:
 *   - the feature is strictly a learning aid (cache misses are harmless,
 *     just regenerate)
 *   - a DB table would need per-user RLS, expiry, and migration overhead
 *   - we run a single API instance today, so cross-instance cache coherence
 *     isn't a problem
 *
 * If the deploy ever scales horizontally, swap `challengeCache` for a
 * shared store (Redis, or the DB table the plan sketches) — the surface
 * exposed below (`put`, `get`) is intentionally minimal to make that swap
 * straightforward.
 */

import { generateText } from 'ai'
import { randomUUID } from 'node:crypto'
import { extractJSON } from './helpers.ts'
import { resolveModel } from './translationController.ts'
import { userContextData } from '../data/usersData.ts'
import conceptsData from '../data/conceptsData.ts'

export type SentenceBuilderChallenge = {
  id: string
  conceptId: number
  userId: number
  nativeSentence: string
  tiles: string[] // shuffled target + distractor tiles shown to the user
  correctOrdering: string[] // held server-side; revealed on validate
  createdAt: number
}

/**
 * TTL for a cached challenge. Roughly tracks how long a user is expected to
 * spend inside a single sentence-builder session before submitting.
 */
const CHALLENGE_TTL_MS = 60 * 60 * 1000 // 1h

/**
 * Hard cap on cache size. At ~200 bytes per entry this bounds memory to a
 * fraction of a megabyte, and LRU eviction keeps eviction pressure on the
 * oldest (most likely abandoned) challenges.
 */
const CHALLENGE_CACHE_MAX = 2000

/**
 * Insertion-ordered Map used as a small LRU.
 *
 * `Map` preserves insertion order in ES2015+, so reinserting on `get` bumps
 * recency. Eviction drops the first-inserted (least recently used) key.
 */
const challengeCache = new Map<string, SentenceBuilderChallenge>()

function putChallenge(challenge: SentenceBuilderChallenge): void {
  challengeCache.set(challenge.id, challenge)
  while (challengeCache.size > CHALLENGE_CACHE_MAX) {
    const oldestKey = challengeCache.keys().next().value
    if (oldestKey === undefined) break
    challengeCache.delete(oldestKey)
  }
}

function getChallenge(id: string): SentenceBuilderChallenge | undefined {
  const entry = challengeCache.get(id)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > CHALLENGE_TTL_MS) {
    challengeCache.delete(id)
    return undefined
  }
  // Bump recency
  challengeCache.delete(id)
  challengeCache.set(id, entry)
  return entry
}

/**
 * Client-facing view of a challenge. `correctOrdering` is intentionally
 * withheld so the puzzle stays a puzzle.
 */
export type PublicChallenge = {
  id: string
  nativeSentence: string
  tiles: string[]
}

function toPublic(challenge: SentenceBuilderChallenge): PublicChallenge {
  return {
    id: challenge.id,
    nativeSentence: challenge.nativeSentence,
    tiles: challenge.tiles,
  }
}

/**
 * Deterministic Fisher-Yates shuffle over a fresh array copy. The shuffle
 * itself is non-deterministic (uses Math.random), but it never mutates the
 * caller's input, so re-running generation on the same concept won't
 * accidentally scramble the server-side `correctOrdering`.
 */
function shuffle<T>(input: readonly T[]): T[] {
  const out = [...input]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * Build the LLM prompt for a sentence-builder challenge. Kept deterministic
 * where possible — the model still has freedom over wording, but the
 * constraints pin down length, JSON shape, and required distractor count.
 */
function buildSentencePrompt(params: {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
}): string {
  const { concept, translation, sourceLanguage, targetLanguage } = params
  return `You are helping a language learner practice a vocabulary word through a sentence-builder exercise.

The user is learning this word:
- Source (${sourceLanguage}): "${concept}"
- Target (${targetLanguage}): "${translation}"

Task:
1. Write ONE short, natural sentence in ${targetLanguage} that uses "${translation}" as one of its words. The sentence must be 4 to 7 words long and suitable for a beginner-to-intermediate learner.
2. Provide the same sentence translated into ${sourceLanguage} (the "native" prompt the user reads).
3. Split the target-language sentence into individual word tiles, in the correct order, with no punctuation attached.
4. Suggest exactly 3 plausible distractor tiles in ${targetLanguage}: words that could grammatically fit into a similar sentence but do NOT belong in this one. Distractors must not duplicate any tile in the correct sentence.

Respond with JSON ONLY — no prose, no code fences, no explanation:

{
  "nativeSentence": "<full sentence in ${sourceLanguage}>",
  "correctOrdering": ["<tile1>", "<tile2>", "..."],
  "distractorTiles": ["<d1>", "<d2>", "<d3>"]
}`
}

/**
 * Resolve an LLM model for the given authenticated user, honoring BYOK
 * settings when present. Throws if no model can be resolved — callers
 * should translate that into a 503-ish response.
 */
async function resolveModelForUser(userEmail: string) {
  const settings = await userContextData.retrieveUserContext(userEmail)
  const model = resolveModel(settings)
  if (!model) {
    throw new Error('No LLM model available — configure GEMINI_API_KEY or a BYOK provider')
  }
  return model
}

/**
 * Generate a fresh sentence-builder challenge for the given concept.
 * Caches the full (with `correctOrdering`) challenge in-memory and
 * returns the public projection the client is allowed to see.
 */
export async function generateSentenceChallenge(params: {
  conceptId: number
  userId: number
  userEmail: string
}): Promise<PublicChallenge> {
  const { conceptId, userId, userEmail } = params
  const concept = await conceptsData.findConceptById(conceptId, userId)
  if (!concept) {
    throw new Error('Concept not found')
  }

  const model = await resolveModelForUser(userEmail)
  const prompt = buildSentencePrompt({
    concept: concept.concept,
    translation: concept.translation,
    sourceLanguage: concept.sourceLanguage,
    targetLanguage: concept.targetLanguage,
  })

  const { text } = await generateText({ model, prompt, temperature: 0.2 })
  const parsed = extractJSON(text) as {
    nativeSentence?: unknown
    correctOrdering?: unknown
    distractorTiles?: unknown
  }

  if (
    typeof parsed.nativeSentence !== 'string' ||
    !Array.isArray(parsed.correctOrdering) ||
    !Array.isArray(parsed.distractorTiles)
  ) {
    throw new Error('LLM returned an unexpected sentence-builder shape')
  }

  const correctOrdering = parsed.correctOrdering
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0)
  const distractorTiles = parsed.distractorTiles
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => t.length > 0)

  if (correctOrdering.length < 3) {
    throw new Error('Generated sentence was too short to build a challenge')
  }

  const challenge: SentenceBuilderChallenge = {
    id: randomUUID(),
    conceptId,
    userId,
    nativeSentence: parsed.nativeSentence.trim(),
    tiles: shuffle([...correctOrdering, ...distractorTiles]),
    correctOrdering,
    createdAt: Date.now(),
  }

  putChallenge(challenge)
  return toPublic(challenge)
}

/**
 * Compare a user-submitted ordering against the cached correct answer.
 *
 * Cases:
 *   - unknown / expired challengeId → return `cached: false` so the client
 *     can choose to regenerate instead of scoring a stale attempt
 *   - wrong user → pretend not found to avoid leaking that the id exists
 *   - correct ordering → `{ correct: true }`
 *   - wrong ordering → `{ correct: false, correctOrdering: [...] }` so the
 *     web UI can show the intended answer after submission
 */
export function validateSentenceAnswer(params: {
  challengeId: string
  userOrdering: string[]
  userId: number
}): {
  cached: boolean
  correct?: boolean
  correctOrdering?: string[]
  conceptId?: number
} {
  const { challengeId, userOrdering, userId } = params
  const cached = getChallenge(challengeId)
  if (!cached || cached.userId !== userId) {
    return { cached: false }
  }

  const expected = cached.correctOrdering
  const correct =
    userOrdering.length === expected.length &&
    userOrdering.every((tile, i) => tile === expected[i])

  return {
    cached: true,
    correct,
    correctOrdering: expected,
    conceptId: cached.conceptId,
  }
}
