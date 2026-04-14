export type {
  RelatedWord,
  TranslationRequest,
  TranslationResponse,
  EnrichmentRequest,
  EnrichmentResponse,
  SaveConceptRequest,
} from './translation/types.ts'

export { parseRelatedWords } from './translation/parseRelatedWords.ts'
export { normalizeFrequency } from './translation/frequency.ts'
export type { FrequencyLabel } from './translation/frequency.ts'

export { UI_STRINGS, STRINGS_VERSION } from './i18n/strings.ts'
export type { StringKey } from './i18n/strings.ts'
