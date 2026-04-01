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

export interface EnrichmentResponse {
  phoneticApproximation?: string
  fixedExpression?: string
  commonUsage?: string
  grammarRules?: string
  commonness?: string
  relatedWords?: Array<{ word: string; translation: string; relation: string }>
}
