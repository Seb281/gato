import { z } from 'zod'

/**
 * POST /translation request body.
 *
 * Mirrors `TranslationRequest` in @gato/shared. The legacy pre-v2 extension
 * sent `text` instead of `selection`; handler falls back when `selection`
 * is absent, so both fields are kept optional-ish here:
 *   - selection:  min(1) when present
 *   - text:       optional legacy field
 * The handler still returns 400 if neither resolves.
 */
export const TranslationRequestSchema = z.object({
  selection: z.string().min(1).optional(),
  targetLanguage: z.string().min(1),
  sourceLanguage: z.string().optional(),
  personalContext: z.string().optional(),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
  text: z.string().optional(),
}).meta({ id: 'TranslationRequest' })

export const RelatedWordSchema = z.object({
  word: z.string(),
  translation: z.string(),
  relation: z.string(),
}).meta({ id: 'RelatedWord' })

/** POST /translation response. Fields past the first two are LLM-only (DeepL returns just the translation). */
export const TranslationResponseSchema = z.object({
  contextualTranslation: z.string(),
  language: z.string(),
  provider: z.enum(['deepl', 'llm']),
  phoneticApproximation: z.string().optional(),
  fixedExpression: z.string().nullish(),
  commonUsage: z.string().optional(),
  grammarRules: z.string().optional(),
  commonness: z.string().optional(),
  relatedWords: z.array(RelatedWordSchema).optional(),
}).meta({ id: 'TranslationResponse' })

/** POST /translation/enrich request body — separate enrichment pass after DeepL translation. */
export const EnrichmentRequestSchema = z.object({
  text: z.string().min(1),
  translation: z.string().min(1),
  targetLanguage: z.string().min(1),
  sourceLanguage: z.string().optional(),
  personalContext: z.string().optional(),
  contextBefore: z.string().optional(),
  contextAfter: z.string().optional(),
}).meta({ id: 'EnrichmentRequest' })

export const EnrichmentResponseSchema = z.object({
  phoneticApproximation: z.string().optional(),
  fixedExpression: z.string().nullish(),
  commonUsage: z.string().optional(),
  grammarRules: z.string().optional(),
  commonness: z.string().optional(),
  relatedWords: z.array(RelatedWordSchema).optional(),
}).meta({ id: 'EnrichmentResponse' })
