import { describe, it, expect } from 'vitest'
import { translateWithDeepL } from '../../../services/deeplService.ts'

describe('MSW DeepL handler', () => {
  it('returns the canned translation payload', async () => {
    const result = await translateWithDeepL({
      text: 'Hallo',
      targetLang: 'EN-US',
      sourceLang: 'DE',
    })
    expect(result.translatedText).toBe('[DL] Hallo')
    expect(result.detectedSourceLang).toBe('DE')
  })
})
