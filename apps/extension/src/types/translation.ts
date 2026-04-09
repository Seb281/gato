export interface TranslationResponse {
  language: string
  contextualTranslation: string
  provider?: 'deepl' | 'llm'
  // Present only when LLM fallback was used (all fields in one shot):
  phoneticApproximation?: string
  fixedExpression?: string
  commonUsage?: string
  grammarRules?: string
  commonness?: string
  relatedWords?: string | Array<{ word: string; translation: string; relation: string }>
}

export interface SidepanelTranslationSignal {
  inputText: string
  result: TranslationResponse
  fromCache: boolean
  cachedConceptId?: number
  contextBefore: string
  contextAfter: string
  sourceUrl: string
  timestamp: number
}

export interface EnrichmentResponse {
  phoneticApproximation?: string
  fixedExpression?: string
  commonUsage?: string
  grammarRules?: string
  commonness?: string
  relatedWords?: Array<{ word: string; translation: string; relation: string }>
}
