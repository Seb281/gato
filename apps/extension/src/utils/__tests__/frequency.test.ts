/**
 * Tests for the shared `normalizeFrequency` helper. Lives in the extension
 * test suite because the extension is the primary consumer and the shared
 * package has no standalone test runner.
 */
import { describe, expect, it } from 'vitest'
import { normalizeFrequency } from '@gato/shared'

describe('normalizeFrequency', () => {
  describe('exact enum matches', () => {
    it.each([
      ['very rare', 'frequency.veryRare'],
      ['rare', 'frequency.rare'],
      ['uncommon', 'frequency.uncommon'],
      ['common', 'frequency.common'],
      ['very common', 'frequency.veryCommon'],
    ] as const)('maps %s → %s', (input, expected) => {
      expect(normalizeFrequency(input)).toBe(expected)
    })

    it('is case-insensitive and whitespace-tolerant', () => {
      expect(normalizeFrequency('  VERY   COMMON  ')).toBe(
        'frequency.veryCommon',
      )
    })
  })

  describe('numeric forms', () => {
    it.each([
      ['1', 'frequency.veryRare'],
      ['2', 'frequency.rare'],
      ['3', 'frequency.uncommon'],
      ['4', 'frequency.common'],
      ['5', 'frequency.veryCommon'],
    ] as const)('maps bare integer %s → %s', (input, expected) => {
      expect(normalizeFrequency(input)).toBe(expected)
    })

    it.each([
      ['4/5', 'frequency.common'],
      ['1 / 5', 'frequency.veryRare'],
      ['5/5', 'frequency.veryCommon'],
    ] as const)('maps N/5 form %s → %s', (input, expected) => {
      expect(normalizeFrequency(input)).toBe(expected)
    })

    it('rejects out-of-range integers', () => {
      expect(normalizeFrequency('0')).toBe(null)
      expect(normalizeFrequency('6')).toBe(null)
    })
  })

  describe('legacy free-text', () => {
    it.each([
      ['Very common in everyday Spanish', 'frequency.veryCommon'],
      ['Moderately common, humorous register', 'frequency.common'],
      ['Common in informal Italian', 'frequency.common'],
      ['Extremely common in daily German', 'frequency.veryCommon'],
      ['Very common, culturally defining', 'frequency.veryCommon'],
      ['Common in everyday speech', 'frequency.common'],
      ['Common, especially among younger Germans', 'frequency.common'],
    ] as const)('maps "%s" → %s', (input, expected) => {
      expect(normalizeFrequency(input)).toBe(expected)
    })

    it('does not confuse "very common" for plain "common"', () => {
      expect(normalizeFrequency('very common usage')).toBe(
        'frequency.veryCommon',
      )
    })

    it('does not confuse "uncommon" for "common"', () => {
      expect(normalizeFrequency('Somewhat uncommon')).toBe(
        'frequency.uncommon',
      )
    })
  })

  describe('unmappable input', () => {
    it.each([
      ['culturally defining'],
      [''],
      ['   '],
      [null],
      [undefined],
    ] as const)('returns null for %p', (input) => {
      expect(normalizeFrequency(input)).toBe(null)
    })
  })
})
