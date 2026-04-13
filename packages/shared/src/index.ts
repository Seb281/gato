export type {
  RelatedWord,
  TranslationRequest,
  TranslationResponse,
  EnrichmentRequest,
  EnrichmentResponse,
  SaveConceptRequest,
} from './translation/types.js'

export { parseRelatedWords } from './translation/parseRelatedWords.js'

export { UI_STRINGS, STRINGS_VERSION } from './i18n/strings.js'
export type { StringKey } from './i18n/strings.js'
