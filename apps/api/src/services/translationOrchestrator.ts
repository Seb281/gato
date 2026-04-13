import { translateWithDeepL, isDeepLConfigured } from './deeplService.ts'
import { resolveDeepLTarget, resolveDeepLSource, deepLDetectedToName } from '../utils/languageCodes.ts'
import { generateText } from 'ai'
import { extractJSON, promptBuilder } from '../controllers/helpers.ts'

/** Parameters for the translation orchestrator. */
interface TranslateParams {
  selection: string
  context?: string | undefined
  targetLanguage: string
  sourceLanguage: string
  personalContext?: string | undefined
  /** Pre-resolved AI model for LLM fallback */
  model: any
}

/**
 * Translates text using DeepL as the primary provider and LLM as fallback.
 * Returns the raw translation result — callers are responsible for
 * normalizing fields like relatedWords before sending to clients.
 */
export async function translateText(params: TranslateParams) {
  // --- Try DeepL first ---
  if (isDeepLConfigured()) {
    const targetCode = resolveDeepLTarget(params.targetLanguage)

    if (targetCode) {
      try {
        const sourceCode = params.sourceLanguage
          ? resolveDeepLSource(params.sourceLanguage) ?? undefined
          : undefined

        const result = await translateWithDeepL({
          text: params.selection,
          targetLang: targetCode,
          sourceLang: sourceCode,
          context: params.context,
        })

        const detectedLanguage = params.sourceLanguage || deepLDetectedToName(result.detectedSourceLang)

        return {
          contextualTranslation: result.translatedText,
          language: detectedLanguage,
          provider: 'deepl' as const,
        }
      } catch (error) {
        console.warn('DeepL translation failed, falling back to LLM:', error)
      }
    } else {
      console.warn(`Language "${params.targetLanguage}" not supported by DeepL, falling back to LLM`)
    }
  }

  // --- LLM fallback ---
  return translateWithLLM(params)
}

/**
 * Translates using an LLM model. Builds a prompt with selection + optional
 * context and returns the full enrichment payload in one shot.
 */
async function translateWithLLM(params: TranslateParams) {
  if (!params.model) {
    throw new Error('No LLM model configured for translation fallback')
  }

  const prompt = promptBuilder(
    params.selection,
    params.targetLanguage,
    params.sourceLanguage,
    params.personalContext || '',
    params.context,
  )

  let result: Record<string, any>
  try {
    const { text: responseText } = await generateText({
      model: params.model,
      prompt,
      temperature: 0,
    })

    result = extractJSON(responseText) as Record<string, any>
  } catch (error) {
    throw new Error('LLM translation failed: ' + (error instanceof Error ? error.message : 'unknown error'))
  }

  return {
    contextualTranslation: result.contextualTranslation,
    language: result.language || params.sourceLanguage || 'Unknown',
    provider: 'llm' as const,
    phoneticApproximation: result.phoneticApproximation,
    fixedExpression: result.fixedExpression,
    commonUsage: result.commonUsage,
    grammarRules: result.grammarRules,
    commonness: result.commonness,
    relatedWords: result.relatedWords,
  }
}
