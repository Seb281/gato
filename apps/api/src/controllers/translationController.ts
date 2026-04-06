import type { FastifyRequest, FastifyReply } from 'fastify'
import { generateText } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createOpenAI } from '@ai-sdk/openai'
import { extractJSON, promptBuilder, enrichmentPromptBuilder } from './helpers.ts'
import { getAuthenticatedUserEmail, supabase } from '../middleware/supabaseAuth.ts'
import { userContextData } from '../data/usersData.ts'
import conceptsData from '../data/conceptsData.ts'
import { translateText } from '../services/translationOrchestrator.ts'
import 'dotenv/config'

const systemGeminiKey = process.env.GEMINI_API_KEY
if (!systemGeminiKey) {
  console.warn('GEMINI_API_KEY not set — LLM enrichment and fallback translation will be unavailable')
}

// System default provider (may be null if GEMINI_API_KEY is not set)
const google = systemGeminiKey
  ? createGoogleGenerativeAI({ apiKey: systemGeminiKey })
  : null

export function resolveModel(settings: { customApiKey: string | null; preferredProvider: string | null }) {
  let model: any = google ? google('gemini-3.1-flash-lite-preview') : null

  if (settings.customApiKey && settings.preferredProvider) {
    if (settings.preferredProvider === 'openai') {
      const openai = createOpenAI({ apiKey: settings.customApiKey })
      model = openai('gpt-4o')
    } else if (settings.preferredProvider === 'google') {
      const customGoogle = createGoogleGenerativeAI({ apiKey: settings.customApiKey })
      model = customGoogle('gemini-2.5-flash')
    } else if (settings.preferredProvider === 'anthropic') {
      const anthropic = createAnthropic({ apiKey: settings.customApiKey })
      model = anthropic('claude-sonnet-4-5')
    } else if (settings.preferredProvider === 'mistral') {
      const mistral = createMistral({ apiKey: settings.customApiKey })
      model = mistral('mistral-large-latest')
    }
  }

  return model
}

export async function enrichConceptInBackground(
  conceptId: number,
  concept: string,
  sourceLanguage: string,
  targetLanguage: string,
  userEmail?: string
) {
  try {
    let model: any = google ? google('gemini-3.1-flash-lite-preview') : null

    if (userEmail) {
      const settings = await userContextData.retrieveUserContext(userEmail)
      model = resolveModel(settings)
    }

    if (!model) {
      console.warn(`Skipping enrichment for concept ${conceptId}: no LLM configured`)
      return
    }

    const prompt = promptBuilder(
      `[${concept}]`,
      targetLanguage,
      sourceLanguage,
      ''
    )

    const { text } = await generateText({ model, prompt, temperature: 0 })
    const result = extractJSON(text) as Record<string, any>

    // Serialize relatedWords array to JSON string if present
    let relatedWordsJson: string | null = null
    if (Array.isArray(result.relatedWords) && result.relatedWords.length > 0) {
      relatedWordsJson = JSON.stringify(result.relatedWords)
    }

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

type TranslationRequest = {
  text: string
  targetLanguage: string
  sourceLanguage: string
  personalContext: string
  selection?: string
  contextBefore?: string
  contextAfter?: string
}

export async function translate(
  request: FastifyRequest<{ Body: TranslationRequest }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { text, targetLanguage, sourceLanguage, personalContext, selection, contextBefore, contextAfter } =
      request.body

    if ((!text && !selection) || !targetLanguage) {
      console.error(
        'Validation error: missing required fields: text/selection, targetLanguage'
      )
      return reply.status(400).send({
        error: 'Missing required fields: text/selection, targetLanguage',
      })
    }

    // Resolve the model for LLM fallback
    let model: any = google ? google('gemini-3.1-flash-lite-preview') : null

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

    // Determine selection and context
    let resolvedSelection: string
    let resolvedContext: string | undefined

    if (selection) {
      // New format: separated fields
      resolvedSelection = selection
      resolvedContext = [contextBefore, selection, contextAfter].filter(Boolean).join(' ')
    } else {
      // Legacy format: extract selection from [brackets]
      const bracketMatch = text.match(/\[([^\]]+)\]/)
      resolvedSelection = (bracketMatch && bracketMatch[1]) ? bracketMatch[1] : text
      resolvedContext = bracketMatch ? text : undefined
    }

    const translationResult = await translateText({
      selection: resolvedSelection,
      context: resolvedContext,
      targetLanguage,
      sourceLanguage,
      personalContext,
      model,
    })

    return reply.status(200).send(translationResult)

  } catch (error) {
    console.error('Translation error:', error)
    return reply.status(500).send({
      error: 'Translation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

type EnrichRequest = {
  text: string
  translation: string
  targetLanguage: string
  sourceLanguage: string
  personalContext?: string
  contextBefore?: string
  contextAfter?: string
}

export async function enrich(
  request: FastifyRequest<{ Body: EnrichRequest }>,
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
    let model: any = google ? google('gemini-3.1-flash-lite-preview') : null

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

    const enrichmentResult = extractJSON(responseText)
    return reply.status(200).send(enrichmentResult)

  } catch (error) {
    console.error('Enrichment error:', error)
    return reply.status(500).send({
      error: 'Enrichment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
