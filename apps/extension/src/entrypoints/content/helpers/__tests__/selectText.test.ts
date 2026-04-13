import { describe, it, expect } from 'vitest'
import {
  isWordChar,
  isWordInternal,
  findWordBoundary,
  expandSelection,
  computeContextBudget,
  isSentenceBoundary,
  findContextBefore,
  findContextAfter,
} from '../selectText'

// ---------- isWordChar ----------

describe('isWordChar', () => {
  it('returns true for ASCII letters', () => {
    expect(isWordChar('a')).toBe(true)
    expect(isWordChar('Z')).toBe(true)
  })

  it('returns true for digits', () => {
    expect(isWordChar('0')).toBe(true)
    expect(isWordChar('9')).toBe(true)
  })

  it('returns true for accented Latin characters', () => {
    expect(isWordChar('é')).toBe(true)
    expect(isWordChar('ñ')).toBe(true)
    expect(isWordChar('ü')).toBe(true)
    expect(isWordChar('ø')).toBe(true)
  })

  it('returns true for Cyrillic letters', () => {
    expect(isWordChar('я')).toBe(true)
    expect(isWordChar('Б')).toBe(true)
  })

  it('returns false for punctuation and whitespace', () => {
    expect(isWordChar(' ')).toBe(false)
    expect(isWordChar('.')).toBe(false)
    expect(isWordChar(',')).toBe(false)
    expect(isWordChar(':')).toBe(false)
    expect(isWordChar('"')).toBe(false)
    expect(isWordChar('(')).toBe(false)
    expect(isWordChar('-')).toBe(false)
    expect(isWordChar("'")).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isWordChar('')).toBe(false)
  })
})

// ---------- isWordInternal ----------

describe('isWordInternal', () => {
  it('treats apostrophe as word-internal between letters', () => {
    expect(isWordInternal("'", 'n', 't')).toBe(true)
    expect(isWordInternal('\u2019', 'n', 't')).toBe(true)
    expect(isWordInternal('\u2018', 'n', 't')).toBe(true)
  })

  it('rejects apostrophe at word edges', () => {
    expect(isWordInternal("'", ' ', 't')).toBe(false)
    expect(isWordInternal("'", 'o', ' ')).toBe(false)
    expect(isWordInternal("'", '', 't')).toBe(false)
  })

  it('treats hyphen as word-internal between letters', () => {
    expect(isWordInternal('-', 'l', 'k')).toBe(true)
  })

  it('rejects hyphen at word edges', () => {
    expect(isWordInternal('-', ' ', 'k')).toBe(false)
    expect(isWordInternal('-', 'l', ' ')).toBe(false)
  })

  it('treats period as word-internal between digits', () => {
    expect(isWordInternal('.', '3', '1')).toBe(true)
  })

  it('rejects period between letters', () => {
    expect(isWordInternal('.', 'r', 'S')).toBe(false)
  })

  it('treats comma as word-internal between digits', () => {
    expect(isWordInternal(',', '1', '0')).toBe(true)
  })

  it('rejects comma between letters', () => {
    expect(isWordInternal(',', 'a', 'b')).toBe(false)
  })

  it('rejects unrecognized characters', () => {
    expect(isWordInternal(':', 'a', 'b')).toBe(false)
    expect(isWordInternal(';', 'a', 'b')).toBe(false)
    expect(isWordInternal(' ', 'a', 'b')).toBe(false)
  })
})

// ---------- findWordBoundary ----------

describe('findWordBoundary', () => {
  it('walks left to word start', () => {
    expect(findWordBoundary('hello world', 3, 'left')).toBe(0)
  })

  it('walks right to word end', () => {
    expect(findWordBoundary('hello world', 3, 'right')).toBe(5)
  })

  it('keeps contractions together', () => {
    expect(findWordBoundary("I don't know", 4, 'left')).toBe(2)
    expect(findWordBoundary("I don't know", 4, 'right')).toBe(7)
  })

  it('keeps decimals together', () => {
    expect(findWordBoundary('costs 3.14 euros', 7, 'left')).toBe(6)
    expect(findWordBoundary('costs 3.14 euros', 7, 'right')).toBe(10)
  })

  it('keeps digit grouping commas together', () => {
    expect(findWordBoundary('about 1,000,000 people', 8, 'left')).toBe(6)
    expect(findWordBoundary('about 1,000,000 people', 8, 'right')).toBe(15)
  })

  it('stops at colons', () => {
    expect(findWordBoundary('word: next', 2, 'right')).toBe(4)
  })

  it('stops at quotes at word edge', () => {
    expect(findWordBoundary('"hello" world', 3, 'left')).toBe(1)
    expect(findWordBoundary('"hello" world', 3, 'right')).toBe(6)
  })

  it('handles hyphens between letters', () => {
    expect(findWordBoundary('a well-known fact', 6, 'left')).toBe(2)
    expect(findWordBoundary('a well-known fact', 6, 'right')).toBe(12)
  })

  it('handles accented characters', () => {
    expect(findWordBoundary('café latte', 2, 'left')).toBe(0)
    expect(findWordBoundary('café latte', 2, 'right')).toBe(4)
  })

  it('handles start of string', () => {
    expect(findWordBoundary('hello', 0, 'left')).toBe(0)
  })

  it('handles end of string', () => {
    expect(findWordBoundary('hello', 4, 'right')).toBe(5)
  })
})

// ---------- expandSelection ----------

describe('expandSelection', () => {
  it('expands partial word selection', () => {
    expect(expandSelection('hello', 1, 4)).toEqual([0, 5])
  })

  it('does not expand clean word selection', () => {
    expect(expandSelection('hello world', 0, 5)).toEqual([0, 5])
  })

  it('does not expand multi-word clean selection', () => {
    expect(expandSelection('hello world', 0, 11)).toEqual([0, 11])
  })

  it('expands and trims trailing quote', () => {
    expect(expandSelection('"hello" world', 2, 7)).toEqual([1, 6])
  })

  it('does not cross hyphen at selection edge (left)', () => {
    expect(expandSelection('well-known', 5, 10)).toEqual([5, 10])
  })

  it('expands within hyphenated word when hyphen is inside selection', () => {
    expect(expandSelection('well-known', 0, 7)).toEqual([0, 10])
  })

  it('keeps contraction together', () => {
    expect(expandSelection("I don't know", 4, 6)).toEqual([2, 7])
  })

  it('keeps decimal number together', () => {
    expect(expandSelection('is 3.14 or', 3, 6)).toEqual([3, 7])
  })

  it('stops at colon', () => {
    expect(expandSelection('word: next', 1, 3)).toEqual([0, 4])
  })

  it('handles selection at start of text', () => {
    expect(expandSelection('hello world', 0, 3)).toEqual([0, 5])
  })

  it('handles selection at end of text', () => {
    expect(expandSelection('hello world', 8, 11)).toEqual([6, 11])
  })

  it('trims leading punctuation after expansion', () => {
    expect(expandSelection('(hello)', 2, 6)).toEqual([1, 6])
  })
})

// ---------- computeContextBudget ----------

describe('computeContextBudget', () => {
  it('returns 400 for 1-word selection', () => {
    expect(computeContextBudget(1)).toBe(400)
  })

  it('returns 400 for 3-word selection', () => {
    expect(computeContextBudget(3)).toBe(400)
  })

  it('returns 250 for 5-word selection', () => {
    expect(computeContextBudget(5)).toBe(250)
  })

  it('returns 250 for 10-word selection', () => {
    expect(computeContextBudget(10)).toBe(250)
  })

  it('returns 100 for 11+ word selection', () => {
    expect(computeContextBudget(11)).toBe(100)
    expect(computeContextBudget(50)).toBe(100)
  })
})

// ---------- isSentenceBoundary ----------

describe('isSentenceBoundary', () => {
  it('detects period followed by space and uppercase', () => {
    expect(isSentenceBoundary('end. Start', 3)).toBe(true)
  })

  it('detects period at end of text', () => {
    expect(isSentenceBoundary('The end.', 7)).toBe(true)
  })

  it('detects ! and ? as boundaries', () => {
    expect(isSentenceBoundary('What! Next', 4)).toBe(true)
    expect(isSentenceBoundary('What? Next', 4)).toBe(true)
  })

  it('skips abbreviation Mr.', () => {
    expect(isSentenceBoundary('Mr. Smith went', 2)).toBe(false)
  })

  it('skips abbreviation Dr.', () => {
    expect(isSentenceBoundary('Dr. Jones said', 2)).toBe(false)
  })

  it('skips abbreviation e.g.', () => {
    expect(isSentenceBoundary('e.g. cats', 3)).toBe(false)
  })

  it('skips abbreviation i.e.', () => {
    expect(isSentenceBoundary('i.e. dogs', 3)).toBe(false)
  })

  it('skips single uppercase letter abbreviation', () => {
    expect(isSentenceBoundary('U.S. forces', 1)).toBe(false)
    expect(isSentenceBoundary('U.S. forces', 3)).toBe(false)
  })

  it('skips decimal between digits', () => {
    expect(isSentenceBoundary('costs 3.14 euros', 7)).toBe(false)
  })

  it('skips IP addresses', () => {
    expect(isSentenceBoundary('at 127.0.0.1 now', 6)).toBe(false)
    expect(isSentenceBoundary('at 127.0.0.1 now', 8)).toBe(false)
  })

  it('does not treat period followed by lowercase as boundary', () => {
    expect(isSentenceBoundary('file.txt is', 4)).toBe(false)
  })
})

// ---------- findContextBefore / findContextAfter ----------

describe('findContextBefore', () => {
  it('snaps to sentence boundary within budget', () => {
    const text = 'First sentence. Second sentence. The word'
    // pos 36 is the space before 'word'; substring(0,36) excludes it
    const result = findContextBefore(text, 36, 400)
    expect(result).toBe('Second sentence. The')
  })

  it('returns full budget when no sentence boundary found', () => {
    const text = 'this is a long clause without any sentence ending and the word'
    const result = findContextBefore(text, 57, 30)
    expect(result).toBe(text.substring(27, 57))
  })

  it('does not break on abbreviation', () => {
    const text = 'Talk to Dr. Smith about the word'
    // pos 27 is the space before 'word'; no real sentence boundary → full window
    const result = findContextBefore(text, 27, 400)
    expect(result).toBe('Talk to Dr. Smith about the')
  })
})

describe('findContextAfter', () => {
  it('snaps to latest sentence end within budget', () => {
    const text = 'word in sentence. Next sentence here.'
    // Latest boundary is 'here.' — includes all complete sentences
    const result = findContextAfter(text, 4, 400)
    expect(result).toBe(' in sentence. Next sentence here.')
  })

  it('returns full budget when no sentence boundary found', () => {
    const text = 'word and more text without ending'
    const result = findContextAfter(text, 4, 15)
    expect(result).toBe(' and more text ')
  })

  it('does not break on decimal', () => {
    const text = 'word costs 3.14 euros. Done.'
    // Latest real boundary is 'Done.' — decimal in 3.14 is skipped
    const result = findContextAfter(text, 4, 400)
    expect(result).toBe(' costs 3.14 euros. Done.')
  })
})
