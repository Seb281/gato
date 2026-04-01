/**
 * Mapping between human-readable language names (used throughout the app)
 * and DeepL API language codes (uppercase ISO 639-1, with variants).
 *
 * DeepL docs: https://developers.deepl.com/docs/resources/supported-languages
 */

export const nameToDeepLTarget: Record<string, string> = {
  Arabic: 'AR',
  Bulgarian: 'BG',
  Chinese: 'ZH-HANS',
  Czech: 'CS',
  Danish: 'DA',
  Dutch: 'NL',
  English: 'EN-US',
  Finnish: 'FI',
  French: 'FR',
  German: 'DE',
  Greek: 'EL',
  Hindi: 'HI',
  Hungarian: 'HU',
  Indonesian: 'ID',
  Italian: 'IT',
  Japanese: 'JA',
  Korean: 'KO',
  Malay: 'MS',
  Norwegian: 'NB',
  Polish: 'PL',
  Portuguese: 'PT-BR',
  Romanian: 'RO',
  Russian: 'RU',
  Slovak: 'SK',
  Spanish: 'ES',
  Swedish: 'SV',
  Thai: 'TH',      // DeepL extended language
  Turkish: 'TR',
  Ukrainian: 'UK',
  Vietnamese: 'VI', // DeepL extended language
}

// Source language codes (no regional variants)
export const nameToDeepLSource: Record<string, string> = {
  Arabic: 'AR',
  Bulgarian: 'BG',
  Chinese: 'ZH',
  Czech: 'CS',
  Danish: 'DA',
  Dutch: 'NL',
  English: 'EN',
  Finnish: 'FI',
  French: 'FR',
  German: 'DE',
  Greek: 'EL',
  Hindi: 'HI',
  Hungarian: 'HU',
  Indonesian: 'ID',
  Italian: 'IT',
  Japanese: 'JA',
  Korean: 'KO',
  Malay: 'MS',
  Norwegian: 'NB',
  Polish: 'PL',
  Portuguese: 'PT',
  Romanian: 'RO',
  Russian: 'RU',
  Slovak: 'SK',
  Spanish: 'ES',
  Swedish: 'SV',
  Thai: 'TH',
  Turkish: 'TR',
  Ukrainian: 'UK',
  Vietnamese: 'VI',
}

// Reverse mapping: DeepL detected_source_language code → human-readable name
const deepLCodeToName: Record<string, string> = {}
for (const [name, code] of Object.entries(nameToDeepLSource)) {
  deepLCodeToName[code] = name
}

export function deepLDetectedToName(code: string): string {
  return deepLCodeToName[code.toUpperCase()] || code
}

export function resolveDeepLTarget(languageName: string): string | null {
  return nameToDeepLTarget[languageName] ?? null
}

export function resolveDeepLSource(languageName: string): string | null {
  return nameToDeepLSource[languageName] ?? null
}
