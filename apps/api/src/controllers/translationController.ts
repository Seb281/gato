import type { FastifyRequest, FastifyReply } from 'fastify'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { extractJSON, promptBuilder, enrichmentPromptBuilder } from './helpers.ts'
import { MODELS } from '../config/models.ts'
import { getAuthenticatedUserEmail, supabase } from '../middleware/supabaseAuth.ts'
import { userContextData } from '../data/usersData.ts'
import conceptsData from '../data/conceptsData.ts'
import { translateText } from '../services/translationOrchestrator.ts'
import { parseRelatedWords } from '@gato/shared'
import type { TranslationRequest, EnrichmentRequest } from '@gato/shared'
import 'dotenv/config'

const systemGeminiKey = process.env.GEMINI_API_KEY
if (!systemGeminiKey) {
  console.warn('GEMINI_API_KEY not set — LLM enrichment and fallback translation will be unavailable')
}

// System default provider (may be null if GEMINI_API_KEY is not set)
const google = systemGeminiKey
  ? createGoogleGenerativeAI({ apiKey: systemGeminiKey })
  : null

/**
 * Resolves the AI model to use based on user settings.
 * Supports BYOK (bring-your-own-key) for OpenAI, Google, Anthropic, and Mistral.
 * Falls back to the system-level Gemini model when no custom key is set.
 */
export function resolveModel(settings: { customApiKey: string | null; preferredProvider: string | null }) {
  let model: any = google ? google(MODELS.system) : null

  if (settings.customApiKey && settings.preferredProvider) {
    if (settings.preferredProvider === 'openai') {
      const openai = createOpenAI({ apiKey: settings.customApiKey })
      model = openai(MODELS.openai)
    } else if (settings.preferredProvider === 'google') {
      const customGoogle = createGoogleGenerativeAI({ apiKey: settings.customApiKey })
      model = customGoogle(MODELS.google)
    } else if (settings.preferredProvider === 'anthropic') {
      const anthropic = createAnthropic({ apiKey: settings.customApiKey })
      model = anthropic(MODELS.anthropic)
    } else if (settings.preferredProvider === 'mistral') {
      const mistral = createMistral({ apiKey: settings.customApiKey })
      model = mistral(MODELS.mistral)
    }
  }

  return model
}

/**
 * Background enrichment for a saved concept.
 * Runs an LLM call to populate linguistic metadata (phonetics, usage, grammar, etc.)
 * and persists the result to the database.
 */
export async function enrichConceptInBackground(
  conceptId: number,
  concept: string,
  sourceLanguage: string,
  targetLanguage: string,
  userEmail?: string
) {
  try {
    let model: any = google ? google(MODELS.system) : null

    if (userEmail) {
      const settings = await userContextData.retrieveUserContext(userEmail)
      model = resolveModel(settings)
    }

    if (!model) {
      console.warn(`Skipping enrichment for concept ${conceptId}: no LLM configured`)
      return
    }

    const prompt = promptBuilder(
      concept,
      targetLanguage,
      sourceLanguage,
      '',
    )

    const { text } = await generateText({ model, prompt, temperature: 0 })
    const result = extractJSON(text) as Record<string, any>

    // Normalize and serialize relatedWords for DB storage
    const normalized = parseRelatedWords(result.relatedWords)
    const relatedWordsJson: string | null = normalized.length > 0
      ? JSON.stringify(normalized)
      : null

    await conceptsData.enrichConcept(conceptId, {
      phoneticApproximation: result.phoneticApproximation ?? null,
      commonUsage: result.commonUsage ?? null,
      grammarRules: result.grammarRules ?? null,
      commonness: result.commonness ?? null,
      fixedExpression: result.fixedExpression === 'no' ? null : result.fixedExpression ?? null,
      relatedWords: relatedWordsJson,
    })
  } catch (error) {
    console.error(`Failed to enrich concept ${conceptId}:`, error)
  }
}

/**
 * POST /translation handler.
 * Translates a user-selected word/phrase, optionally using surrounding context.
 * Normalizes relatedWords in the response before sending.
 */
export async function translate(
  request: FastifyRequest<{ Body: TranslationRequest }>,
  reply: FastifyReply
): Promise<void> {
  const { selection, targetLanguage, sourceLanguage, personalContext, contextBefore, contextAfter } =
    request.body

  // TODO: Remove `text` fallback once the new extension (v2 with `selection` field) ships to CWS.
  // Live extension sends `text` (plain string) when no expanded selection is available.
  const resolvedSelection = selection || (request.body as unknown as Record<string, unknown>).text as string | undefined

  if (!resolvedSelection || !targetLanguage) {
    return reply.status(400).send({
      error: 'Missing required fields: selection, targetLanguage',
    })
  }

  try {
    // Resolve the model for LLM fallback
    let model: any = google ? google(MODELS.system) : null

    try {
      const authHeader = request.headers.authorization
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)

        if (user?.email) {
          const settings = await userContextData.retrieveUserContext(user.email)
          model = resolveModel(settings)
        }
      }
    } catch (authError) {
      console.warn('Failed to resolve user settings for translation:', authError)
    }

    // Build context from surrounding text segments
    const resolvedContext = [contextBefore, resolvedSelection, contextAfter].filter(Boolean).join(' ')

    const translationResult = await translateText({
      selection: resolvedSelection,
      context: resolvedContext,
      targetLanguage,
      sourceLanguage: sourceLanguage || '',
      personalContext: personalContext || '',
      model,
    })

    // Normalize relatedWords before sending to the client.
    // The result is a union — relatedWords only exists on the LLM branch.
    const raw = translationResult as Record<string, unknown>
    const response = {
      ...translationResult,
      relatedWords: raw.relatedWords
        ? parseRelatedWords(raw.relatedWords as any)
        : undefined,
    }
    return reply.status(200).send(response)

  } catch (error) {
    request.log.error(error, 'Translation error')
    return reply.status(500).send({
      error: 'Translation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * POST /translation/enrich handler.
 * Enriches an already-translated word with linguistic metadata (phonetics, grammar, etc.).
 * Normalizes relatedWords in the response before sending.
 */
export async function enrich(
  request: FastifyRequest<{ Body: EnrichmentRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { text, translation, targetLanguage, sourceLanguage, personalContext, contextBefore, contextAfter } =
      request.body

    if (!text || !translation || !targetLanguage) {
      return reply.status(400).send({
        error: 'Missing required fields: text, translation, targetLanguage',
      })
    }

    // Resolve LLM model
    let model: any = google ? google(MODELS.system) : null

    try {
      const authHeader = request.headers.authorization
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)

        if (user?.email) {
          const settings = await userContextData.retrieveUserContext(user.email)
          model = resolveModel(settings)
        }
      }
    } catch (authError) {
      console.warn('Failed to resolve user settings for enrichment:', authError)
    }

    if (!model) {
      return reply.status(503).send({
        error: 'LLM not available — no API key configured for enrichment',
      })
    }

    const prompt = enrichmentPromptBuilder(
      text,
      translation,
      targetLanguage,
      sourceLanguage || '',
      personalContext || '',
      contextBefore || '',
      contextAfter || '',
    )

    const { text: responseText } = await generateText({
      model,
      prompt,
      temperature: 0,
    })

    // Normalize relatedWords before sending to the client
    const enrichmentResult = extractJSON(responseText) as Record<string, any>
    const response = {
      ...enrichmentResult,
      relatedWords: enrichmentResult.relatedWords
        ? parseRelatedWords(enrichmentResult.relatedWords)
        : undefined,
    }
    return reply.status(200).send(response)

  } catch (error) {
    request.log.error(error, 'Enrichment error')
    return reply.status(500).send({
      error: 'Enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
