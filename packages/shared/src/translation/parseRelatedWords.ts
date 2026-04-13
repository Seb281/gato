import type { RelatedWord } from './types.js'

/**
 * Normalizes relatedWords from any shape the API/LLM might return
 * into a clean RelatedWord[]. Handles: array (pass-through),
 * JSON string, malformed input. Returns empty array on failure.
 */
export function parseRelatedWords(
  raw: string | RelatedWord[] | undefined | null
): RelatedWord[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw

  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
