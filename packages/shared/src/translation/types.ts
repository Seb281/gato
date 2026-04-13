/** A single related word returned by enrichment. */
export interface RelatedWord {
  word: string
  translation: string
  relation: string
}

/** POST /translation — request body. */
export interface TranslationRequest {
  /** The word or phrase to translate. */
  selection: string
  /** Target language for the translation. */
  targetLanguage: string
  /** Source language. Empty string or omitted = auto-detect. */
  sourceLanguage?: string
  /** User's personal context to guide translation style. */
  personalContext?: string
  /** Text appearing before the selection on the page. */
  contextBefore?: string
  /** Text appearing after the selection on the page. */
  contextAfter?: string
}

/** POST /translation — response body. */
export interface TranslationResponse {
  /** The translated word or phrase. */
  contextualTranslation: string
  /** Detected or echoed source language. */
  language: string
  /** Which translation engine produced this result. */
  provider: 'deepl' | 'llm'

  // Present only when provider === 'llm' (enrichment baked into the single LLM call):
  phoneticApproximation?: string
  fixedExpression?: string
  commonUsage?: string
  grammarRules?: string
  commonness?: string
  relatedWords?: RelatedWord[]
}

/** POST /translation/enrich — request body. */
export interface EnrichmentRequest {
  /** The original word or phrase. */
  text: string
  /** The already-computed translation. */
  translation: string
  /** Target language. */
  targetLanguage: string
  /** Source language (optional). */
  sourceLanguage?: string
  /** User's personal context. */
  personalContext?: string
  /** Text appearing before the selection on the page. */
  contextBefore?: string
  /** Text appearing after the selection on the page. */
  contextAfter?: string
}

/** POST /translation/enrich — response body. */
export interface EnrichmentResponse {
  phoneticApproximation?: string
  fixedExpression?: string
  commonUsage?: string
  grammarRules?: string
  commonness?: string
  relatedWords?: RelatedWord[]
}

/** POST /saved-concepts — request body (translation flow subset). */
export interface SaveConceptRequest {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  contextBefore?: string
  contextAfter?: string
  sourceUrl?: string
}
