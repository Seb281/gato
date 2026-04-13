// ---------- Pure helpers (exported for testing) ----------

const WORD_CHAR_RE = /^[\p{L}\p{N}]$/u
const DIGIT_RE = /^[\p{N}]$/u
const APOSTROPHES = new Set(["'", "\u2018", "\u2019"])

/** Returns true if the character is a Unicode letter or digit. */
export function isWordChar(ch: string): boolean {
  if (ch.length !== 1) return false
  return WORD_CHAR_RE.test(ch)
}

/**
 * Returns true if `ch` is a word-internal character — joins word characters
 * but cannot start or end a word.
 *
 * Rules:
 * - Apostrophes (' \u2018 \u2019): letter on both sides (don't, l'homme)
 * - Hyphen (-): letter on both sides (well-known)
 * - Period (.): digit on both sides (3.14)
 * - Comma (,): digit on both sides (1,000)
 */
export function isWordInternal(ch: string, before: string, after: string): boolean {
  if (APOSTROPHES.has(ch) || ch === '-') {
    return isWordChar(before) && isWordChar(after)
  }
  if (ch === '.' || ch === ',') {
    return DIGIT_RE.test(before) && DIGIT_RE.test(after)
  }
  return false
}

/**
 * Walks from `pos` in the given direction until hitting a word boundary.
 * Returns the index of the boundary:
 * - 'left': the index of the first word character (inclusive start)
 * - 'right': the index past the last word character (exclusive end)
 */
export function findWordBoundary(text: string, pos: number, direction: 'left' | 'right'): number {
  if (direction === 'left') {
    let i = pos
    while (i > 0) {
      const prev = text[i - 1]
      if (isWordChar(prev)) {
        i--
      } else if (i >= 2 && isWordInternal(prev, text[i - 2] ?? '', text[i] ?? '')) {
        i--
      } else {
        break
      }
    }
    return i
  } else {
    let i = pos
    while (i < text.length) {
      const ch = text[i]
      if (isWordChar(ch)) {
        i++
      } else if (isWordInternal(ch, text[i - 1] ?? '', text[i + 1] ?? '')) {
        i++
      } else {
        break
      }
    }
    return i
  }
}

/**
 * Given text and a selection range [start, end), returns the expanded [start, end).
 * Only expands when the selection starts/ends mid-word.
 * Does not cross hyphens at the selection edge (respects user intent).
 * Trims leading/trailing non-word characters after expansion.
 */
export function expandSelection(
  text: string,
  start: number,
  end: number,
): [number, number] {
  let newStart = start
  let newEnd = end

  // Expand left only if previous char is a word char (mid-word)
  if (start > 0 && isWordChar(text[start - 1])) {
    // Don't cross a hyphen sitting at the selection's left edge
    if (text[start] !== '-') {
      newStart = findWordBoundary(text, start, 'left')
    }
  }

  // Expand right only if next char is a word char (mid-word)
  if (end < text.length && isWordChar(text[end])) {
    // Don't cross a hyphen sitting at the selection's right edge
    if (text[end - 1] !== '-') {
      newEnd = findWordBoundary(text, end, 'right')
    }
  }

  // Post-expansion trim: strip leading non-word characters
  while (newStart < newEnd && !isWordChar(text[newStart])) {
    newStart++
  }

  // Strip trailing non-word characters
  while (newEnd > newStart && !isWordChar(text[newEnd - 1])) {
    newEnd--
  }

  return [newStart, newEnd]
}

// ---------- Context extraction helpers ----------

/**
 * Returns the per-side character budget for context extraction,
 * scaled by how many words are in the selection.
 * Short selections get more context (higher ambiguity).
 */
export function computeContextBudget(wordCount: number): number {
  if (wordCount <= 3) return 400
  if (wordCount <= 10) return 250
  return 100
}

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
  'st', 'inc', 'ltd', 'vs', 'etc', 'approx', 'dept',
])

/**
 * Returns true if the character at `pos` in `text` is a real sentence boundary.
 * Filters out abbreviations, decimals, and periods not followed by uppercase.
 */
export function isSentenceBoundary(text: string, pos: number): boolean {
  const ch = text[pos]
  if (ch !== '.' && ch !== '!' && ch !== '?') return false

  // Period between digits = decimal / IP / version number
  if (ch === '.') {
    const before = text[pos - 1] ?? ''
    const after = text[pos + 1] ?? ''
    if (DIGIT_RE.test(before) && DIGIT_RE.test(after)) return false
  }

  // Must be followed by space+uppercase OR end of text to be a sentence boundary
  const afterBoundary = text.substring(pos + 1)
  const isEndOfText = afterBoundary.trimEnd().length === 0
  const followedByUppercase = /^\s+[\p{Lu}]/u.test(afterBoundary)

  if (!isEndOfText && !followedByUppercase) return false

  // Check for known abbreviations (word before the period)
  if (ch === '.') {
    let wordStart = pos - 1
    while (wordStart >= 0 && /[\p{L}]/u.test(text[wordStart])) {
      wordStart--
    }
    const wordBefore = text.substring(wordStart + 1, pos).toLowerCase()

    if (ABBREVIATIONS.has(wordBefore)) return false

    // Single uppercase letter abbreviation (U.S., A.M.)
    if (wordBefore.length === 1 && /[\p{Lu}]/u.test(text[pos - 1])) return false
  }

  return true
}

/**
 * Extracts before-context: walks back up to `budget` chars from `pos`,
 * then snaps forward to the earliest sentence boundary within that window.
 */
export function findContextBefore(text: string, pos: number, budget: number): string {
  const windowStart = Math.max(0, pos - budget)
  const window = text.substring(windowStart, pos)

  // Find the earliest sentence boundary in the window
  for (let i = 0; i < window.length; i++) {
    const textPos = windowStart + i
    if (isSentenceBoundary(text, textPos)) {
      const afterBoundary = window.substring(i + 1)
      const leadingWhitespace = afterBoundary.match(/^\s*/)![0].length
      const snapPos = i + 1 + leadingWhitespace
      if (snapPos < window.length) {
        return window.substring(snapPos)
      }
    }
  }

  return window
}

/**
 * Extracts after-context: walks forward up to `budget` chars from `pos`,
 * then snaps back to the latest sentence boundary within that window.
 */
export function findContextAfter(text: string, pos: number, budget: number): string {
  const windowEnd = Math.min(text.length, pos + budget)
  const window = text.substring(pos, windowEnd)

  // Find the latest sentence boundary in the window (scan right to left)
  for (let i = window.length - 1; i >= 0; i--) {
    const textPos = pos + i
    if (isSentenceBoundary(text, textPos)) {
      return window.substring(0, i + 1)
    }
  }

  return window
}

// ---------- DOM-facing exports (unchanged interface) ----------

const handleSelection = {
  selectionRect: null as DOMRect | null,

  /** Expands the user's selection to word boundaries when it starts/ends mid-word. */
  getExpandedSelection(): Range | null {
    const selection: Selection | null = window.getSelection()
    if (!selection || selection.rangeCount === 0) return null

    const selectedText: string = selection.toString().trim()
    if (!selectedText) return null

    const range: Range = selection.getRangeAt(0)
    const expandedRange: Range = range.cloneRange()

    this.selectionRect = expandedRange.getBoundingClientRect()

    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const text = range.startContainer.textContent!
      const endInSameNode = range.startContainer === range.endContainer
      const effEnd = endInSameNode ? range.endOffset : text.length
      const [newStart] = expandSelection(text, range.startOffset, effEnd)
      expandedRange.setStart(range.startContainer, newStart)
    }

    if (range.endContainer.nodeType === Node.TEXT_NODE) {
      const text = range.endContainer.textContent!
      const startInSameNode = range.startContainer === range.endContainer
      const effStart = startInSameNode ? range.startOffset : 0
      const [, newEnd] = expandSelection(text, effStart, range.endOffset)
      expandedRange.setEnd(range.endContainer, newEnd)
    }

    return expandedRange
  },

  /** Extracts surrounding context with an adaptive budget and smart sentence boundaries. */
  getContextAround(range: Range): { before: string; after: string } {
    const selection = range.toString().trim()
    if (!selection) return { before: '', after: '' }

    const wordCount = selection.split(/\s+/).length
    const budget = computeContextBudget(wordCount)

    const container =
      range.startContainer.nodeType === Node.TEXT_NODE
        ? range.startContainer.parentNode!
        : range.startContainer
    const fullText = container.textContent ?? ''

    // Find the selection's position within the parent text
    const beforeRange = range.cloneRange()
    beforeRange.setStart(container, 0)
    beforeRange.setEnd(range.startContainer, range.startOffset)
    const beforeOffset = beforeRange.toString().length

    const afterOffset = beforeOffset + range.toString().length

    const before = findContextBefore(fullText, beforeOffset, budget)
    const after = findContextAfter(fullText, afterOffset, budget)

    return {
      before: before.trim(),
      after: after.trim(),
    }
  },
}

export default handleSelection
