/**
 * Normalization for the `commonness` (word-frequency) field returned by the
 * translation enrichment LLM.
 *
 * The LLM is instructed to return one of a fixed 5-level enum, but historical
 * rows and model drift may produce free-text ("Very common in everyday Spanish")
 * or numeric forms ("3", "4/5"). This module maps any recognizable input to a
 * stable i18n key; unrecognizable input returns `null` so the caller can render
 * the raw text instead of hiding data.
 */

/** Canonical i18n key for each frequency level. */
export type FrequencyLabel =
  | 'frequency.veryRare'
  | 'frequency.rare'
  | 'frequency.uncommon'
  | 'frequency.common'
  | 'frequency.veryCommon'

/** Lowercase enum strings as stored in the DB and emitted by the LLM. */
const ENUM_TO_KEY: Record<string, FrequencyLabel> = {
  'very rare': 'frequency.veryRare',
  rare: 'frequency.rare',
  uncommon: 'frequency.uncommon',
  common: 'frequency.common',
  'very common': 'frequency.veryCommon',
}

/** 1..5 numeric buckets mapped onto the 5-level enum. */
const NUMERIC_TO_KEY: Record<number, FrequencyLabel> = {
  1: 'frequency.veryRare',
  2: 'frequency.rare',
  3: 'frequency.uncommon',
  4: 'frequency.common',
  5: 'frequency.veryCommon',
}

/**
 * Map a raw `commonness` value to a stable i18n key.
 *
 * Rules (first match wins):
 *   1. Exact enum match (case-insensitive, whitespace-collapsed).
 *   2. Numeric form: bare integer 1..5 or "N/5".
 *   3. Keyword search for phrases like "very common" / "extremely common" /
 *      "very rare" / "rare" / "uncommon" / "common" in the normalized string.
 *   4. No match → `null` (caller falls back to raw display).
 */
export function normalizeFrequency(
  raw: string | null | undefined,
): FrequencyLabel | null {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase().replace(/\s+/g, ' ')
  if (!s) return null

  // 1. Exact enum match.
  const enumHit = ENUM_TO_KEY[s]
  if (enumHit) return enumHit

  // 2. Numeric forms — "3", "4/5", "1 / 5".
  const numericMatch = s.match(/^(\d+)\s*(?:\/\s*5)?$/)
  if (numericMatch) {
    const n = Number(numericMatch[1])
    const numericHit = NUMERIC_TO_KEY[n]
    if (numericHit) return numericHit
  }

  // 3. Keyword search — order matters: "very"/"extremely" modifiers first,
  //    so "very common" doesn't get picked up as plain "common".
  if (/\bvery\s+rare\b/.test(s)) return 'frequency.veryRare'
  if (/\b(?:very|extremely)\s+common\b/.test(s)) return 'frequency.veryCommon'
  if (/\buncommon\b/.test(s)) return 'frequency.uncommon'
  if (/\brare\b/.test(s)) return 'frequency.rare'
  if (/\bcommon\b/.test(s)) return 'frequency.common'

  // 4. Unmappable — caller renders raw.
  return null
}
