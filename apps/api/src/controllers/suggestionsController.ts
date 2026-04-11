/**
 * Vocabulary suggestion controller.
 *
 * Two flows:
 *   - `getOrCreateWordOfTheDay` returns a single LLM-generated suggestion
 *     that is deterministic per (user, calendar day). The first caller of
 *     the day pays the LLM round-trip and persists the result to
 *     `daily_suggestions`; every subsequent visit reads straight from
 *     Postgres. This matches how a language app "word of the day" card is
 *     supposed to feel — stable across navigations and refreshes.
 *   - `getRelatedSuggestions` is on-demand and uncached. It asks the LLM
 *     for a small batch of words adjacent to the user's existing vocab.
 *
 * Both flows honor BYOK via the shared `resolveModel` helper — no new
 * provider plumbing lives here.
 *
 * Empty-vocab handling: the LLM still gets called, but the prompt is
 * rewritten to request a beginner-appropriate "starter word" for the
 * user's target language so the card never shows a blank state as long
 * as a target language is set. If the user has neither concepts nor a
 * target language, the route layer returns 404 and the client renders
 * the empty state instead.
 */

import { generateText } from 'ai'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.ts'
import {
  conceptsTable,
  dailySuggestionsTable,
  usersTable,
} from '../db/schema.ts'
import type { DailySuggestion } from '../db/schema.ts'
import { extractJSON } from './helpers.ts'
import { resolveModel } from './translationController.ts'
import { userContextData } from '../data/usersData.ts'

/**
 * Public shape returned to the web client. Mirrors the persisted row
 * minus audit/id fields the UI doesn't need.
 */
export type WordOfTheDaySuggestion = {
  word: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  rationale: string | null
  exampleSentence: string | null
  date: string
}

export type RelatedSuggestion = {
  word: string
  translation: string
  rationale: string
  exampleSentence: string
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function toPublic(row: DailySuggestion): WordOfTheDaySuggestion {
  return {
    word: row.word,
    translation: row.translation,
    sourceLanguage: row.sourceLanguage,
    targetLanguage: row.targetLanguage,
    rationale: row.rationale,
    exampleSentence: row.exampleSentence,
    date: row.date,
  }
}

/**
 * Summarize the user's vocabulary well enough for the LLM to avoid
 * duplicates and to bias suggestions toward the user's current level.
 * Returns a compact, token-friendly view — we deliberately cap sample
 * size so the prompt stays predictable and cheap.
 */
async function summarizeUserVocab(userId: number): Promise<{
  sample: Array<{ concept: string; translation: string; state: string }>
  targetLanguage: string | null
  sourceLanguage: string | null
  total: number
  stateCounts: Record<string, number>
}> {
  const rows = await db
    .select({
      concept: conceptsTable.concept,
      translation: conceptsTable.translation,
      state: conceptsTable.state,
      sourceLanguage: conceptsTable.sourceLanguage,
      targetLanguage: conceptsTable.targetLanguage,
      createdAt: conceptsTable.createdAt,
    })
    .from(conceptsTable)
    .where(eq(conceptsTable.userId, userId))
    .orderBy(desc(conceptsTable.createdAt))
    .limit(100)

  const stateCounts: Record<string, number> = {}
  for (const row of rows) {
    stateCounts[row.state] = (stateCounts[row.state] ?? 0) + 1
  }

  const sample = rows.slice(0, 25).map((r) => ({
    concept: r.concept,
    translation: r.translation,
    state: r.state,
  }))

  return {
    sample,
    targetLanguage: rows[0]?.targetLanguage ?? null,
    sourceLanguage: rows[0]?.sourceLanguage ?? null,
    total: rows.length,
    stateCounts,
  }
}

/**
 * Ask the LLM for one fresh word. `avoid` lists existing concepts the
 * LLM is told not to repeat; the prompt is explicit about returning
 * strict JSON so `extractJSON` can parse without a fenced block.
 */
function buildWordOfTheDayPrompt(params: {
  sourceLanguage: string
  targetLanguage: string
  avoid: string[]
  stateCounts: Record<string, number>
}): string {
  const { sourceLanguage, targetLanguage, avoid, stateCounts } = params
  const avoidList = avoid.length > 0 ? avoid.join(', ') : '(none yet)'
  const levelSummary = Object.keys(stateCounts).length > 0
    ? Object.entries(stateCounts)
        .map(([state, count]) => `${state}: ${count}`)
        .join(', ')
    : 'beginner, no words yet'

  return `You suggest one useful new vocabulary word for a language learner.

Learner profile:
- Studying: ${targetLanguage}
- Native/source language: ${sourceLanguage}
- Current vocabulary distribution: ${levelSummary}
- Words they already know (do NOT suggest any of these): ${avoidList}

Pick ONE useful, high-frequency word in ${targetLanguage} that fits their level
and is NOT in their known list. Avoid proper nouns. Prefer concrete words a
learner can immediately use.

Respond with JSON ONLY — no prose, no code fences:

{
  "word": "<the new word in ${targetLanguage}>",
  "translation": "<its translation in ${sourceLanguage}>",
  "rationale": "<one short sentence explaining why this word is useful for this learner>",
  "exampleSentence": "<a short natural sentence in ${targetLanguage} that uses the word>"
}`
}

function buildRelatedSuggestionsPrompt(params: {
  sourceLanguage: string
  targetLanguage: string
  sample: Array<{ concept: string; translation: string }>
  limit: number
}): string {
  const { sourceLanguage, targetLanguage, sample, limit } = params
  const vocabList = sample
    .map((s) => `- ${s.concept} → ${s.translation}`)
    .join('\n')

  return `You suggest vocabulary adjacent to what a learner already knows.

Learner is studying ${targetLanguage} (source language: ${sourceLanguage}).

Words they already know:
${vocabList}

Suggest exactly ${limit} new words in ${targetLanguage} that are thematically
or grammatically related to the known list. Do NOT repeat any known word.

Respond with JSON ONLY — no prose, no code fences:

{
  "suggestions": [
    {
      "word": "<${targetLanguage} word>",
      "translation": "<${sourceLanguage} translation>",
      "rationale": "<one short sentence linking it to the known list>",
      "exampleSentence": "<short ${targetLanguage} sentence using the word>"
    }
  ]
}`
}

async function resolveModelForUser(userEmail: string) {
  const settings = await userContextData.retrieveUserContext(userEmail)
  const model = resolveModel(settings)
  if (!model) {
    throw new Error(
      'No LLM model available — configure GEMINI_API_KEY or a BYOK provider'
    )
  }
  return model
}

/**
 * Read today's row if it exists, otherwise ask the LLM, persist, and
 * return. Returns `null` if we have no target language to work with —
 * the caller should render an empty state in that case.
 */
export async function getOrCreateWordOfTheDay(params: {
  userId: number
  userEmail: string
}): Promise<WordOfTheDaySuggestion | null> {
  const { userId, userEmail } = params
  const date = todayStr()

  const existing = await db.query.dailySuggestionsTable.findFirst({
    where: and(
      eq(dailySuggestionsTable.userId, userId),
      eq(dailySuggestionsTable.date, date)
    ),
  })
  if (existing) return toPublic(existing)

  const vocab = await summarizeUserVocab(userId)

  // Fall back to the user's saved target language preference if they
  // have no concepts yet, so a brand-new user can still see a card on
  // their first dashboard visit.
  let targetLanguage = vocab.targetLanguage
  let sourceLanguage = vocab.sourceLanguage
  if (!targetLanguage) {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    })
    targetLanguage = user?.targetLanguage ?? null
    sourceLanguage = sourceLanguage ?? 'English'
  }
  if (!targetLanguage || !sourceLanguage) return null

  const model = await resolveModelForUser(userEmail)
  const prompt = buildWordOfTheDayPrompt({
    sourceLanguage,
    targetLanguage,
    avoid: vocab.sample.map((s) => s.concept),
    stateCounts: vocab.stateCounts,
  })

  const { text } = await generateText({ model, prompt, temperature: 0.3 })
  const parsed = extractJSON(text) as {
    word?: unknown
    translation?: unknown
    rationale?: unknown
    exampleSentence?: unknown
  }

  if (
    typeof parsed.word !== 'string' ||
    typeof parsed.translation !== 'string'
  ) {
    throw new Error('LLM returned an unexpected word-of-the-day shape')
  }

  // Persist so subsequent visits today return the same card. The unique
  // (user_id, date) index means a race loses gracefully via onConflictDoNothing.
  const rows = await db
    .insert(dailySuggestionsTable)
    .values({
      userId,
      date,
      word: parsed.word.trim(),
      translation: parsed.translation.trim(),
      sourceLanguage,
      targetLanguage,
      rationale:
        typeof parsed.rationale === 'string' ? parsed.rationale.trim() : null,
      exampleSentence:
        typeof parsed.exampleSentence === 'string'
          ? parsed.exampleSentence.trim()
          : null,
    })
    .onConflictDoNothing({
      target: [dailySuggestionsTable.userId, dailySuggestionsTable.date],
    })
    .returning()

  if (rows[0]) return toPublic(rows[0])

  // Another request raced us — re-read the row it just wrote.
  const raced = await db.query.dailySuggestionsTable.findFirst({
    where: and(
      eq(dailySuggestionsTable.userId, userId),
      eq(dailySuggestionsTable.date, date)
    ),
  })
  return raced ? toPublic(raced) : null
}

/**
 * Uncached batch of related suggestions. Returns an empty array if the
 * user has no vocabulary yet — there's nothing to "relate to".
 */
export async function getRelatedSuggestions(params: {
  userId: number
  userEmail: string
  limit: number
}): Promise<RelatedSuggestion[]> {
  const { userId, userEmail, limit } = params
  const vocab = await summarizeUserVocab(userId)
  if (vocab.sample.length === 0) return []
  if (!vocab.sourceLanguage || !vocab.targetLanguage) return []

  const model = await resolveModelForUser(userEmail)
  const prompt = buildRelatedSuggestionsPrompt({
    sourceLanguage: vocab.sourceLanguage,
    targetLanguage: vocab.targetLanguage,
    sample: vocab.sample,
    limit,
  })

  const { text } = await generateText({ model, prompt, temperature: 0.4 })
  const parsed = extractJSON(text) as { suggestions?: unknown }
  if (!Array.isArray(parsed.suggestions)) {
    throw new Error('LLM returned an unexpected related-suggestions shape')
  }

  return parsed.suggestions
    .map((s): RelatedSuggestion | null => {
      if (!s || typeof s !== 'object') return null
      const obj = s as Record<string, unknown>
      if (
        typeof obj.word !== 'string' ||
        typeof obj.translation !== 'string'
      ) {
        return null
      }
      return {
        word: obj.word.trim(),
        translation: obj.translation.trim(),
        rationale:
          typeof obj.rationale === 'string' ? obj.rationale.trim() : '',
        exampleSentence:
          typeof obj.exampleSentence === 'string'
            ? obj.exampleSentence.trim()
            : '',
      }
    })
    .filter((s): s is RelatedSuggestion => s !== null)
    .slice(0, limit)
}
