import { translateWithDeepL, isDeepLConfigured } from './deeplService.ts'
import { resolveDeepLTarget, resolveDeepLSource, deepLDetectedToName } from '../utils/languageCodes.ts'
import { generateText } from 'ai'
import { extractJSON, promptBuilder } from '../controllers/helpers.ts'

interface TranslateParams {
  selection: string
  context?: string | undefined
  targetLanguage: string
  sourceLanguage: string
  personalContext?: string | undefined
  /** Pre-resolved AI model for LLM fallback */
  model: any
}

interface TranslateResult {
  contextualTranslation: string
  language: string
  provider: 'deepl' | 'llm'
  /** Present only when LLM fallback was used (all enrichment fields in one shot) */
  phoneticApproximation?: string
  fixedExpression?: string
  commonUsage?: string
  grammarRules?: string
  commonness?: string
  relatedWords?: string | Array<{ word: string; translation: string; relation: string }>
}

export async function translateText(params: TranslateParams): Promise<TranslateResult> {
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
          provider: 'deepl',
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

async function translateWithLLM(params: TranslateParams): Promise<TranslateResult> {
  if (!params.model) {
    throw new Error('No LLM model configured for translation fallback')
  }

  // Reconstruct the bracket format the LLM promptBuilder expects
  let text: string
  if (params.context) {
    const idx = params.context.indexOf(params.selection)
    if (idx >= 0) {
      const before = params.context.slice(0, idx)
      const after = params.context.slice(idx + params.selection.length)
      text = `${before}[${params.selection}] ${after}`.trim()
    } else {
      text = `[${params.selection}]`
    }
  } else {
    text = `[${params.selection}]`
  }

  const prompt = promptBuilder(
    text,
    params.targetLanguage,
    params.sourceLanguage,
    params.personalContext || ''
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
    provider: 'llm',
    phoneticApproximation: result.phoneticApproximation,
    fixedExpression: result.fixedExpression,
    commonUsage: result.commonUsage,
    grammarRules: result.grammarRules,
    commonness: result.commonness,
    relatedWords: result.relatedWords,
  }
}
