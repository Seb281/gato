import { describe, it, expect } from 'vitest'
import { extractJSON, promptBuilder, enrichmentPromptBuilder } from '../helpers.ts'

// ---------- extractJSON ----------

describe('extractJSON', () => {
  it('parses plain JSON object', () => {
    const result = extractJSON('{"key": "value"}')
    expect(result).toEqual({ key: 'value' })
  })

  it('strips markdown code fences', () => {
    const input = '```json\n{"key": "value"}\n```'
    expect(extractJSON(input)).toEqual({ key: 'value' })
  })

  it('extracts JSON from surrounding text', () => {
    const input = 'Here is the result: {"translation": "hello"} end'
    expect(extractJSON(input)).toEqual({ translation: 'hello' })
  })

  it('handles nested objects', () => {
    const input = '{"outer": {"inner": 42}}'
    expect(extractJSON(input)).toEqual({ outer: { inner: 42 } })
  })

  it('throws on no JSON found', () => {
    expect(() => extractJSON('no json here')).toThrow('No valid JSON found')
  })

  it('throws on malformed JSON', () => {
    expect(() => extractJSON('{broken: json}')).toThrow()
  })

  it('handles code fence without json label', () => {
    const input = '```\n{"a": 1}\n```'
    // The regex only strips ```json fences, but the {..} match still works
    expect(extractJSON(input)).toEqual({ a: 1 })
  })
})

// ---------- promptBuilder ----------

describe('promptBuilder', () => {
  it('builds a single-word prompt without context', () => {
    const result = promptBuilder('bonjour', 'English', 'French', '')
    expect(result).toContain('Translate to English')
    expect(result).toContain('[bonjour]')
    expect(result).toContain('word')
    expect(result).not.toContain('fixedExpression')
  })

  it('builds a single-word prompt with context', () => {
    const result = promptBuilder('bonjour', 'English', 'French', '', 'Dire bonjour au monde')
    expect(result).toContain('[bonjour]')
    expect(result).toContain('fixedExpression')
    expect(result).toContain('commonUsage')
    expect(result).toContain('grammarRules')
  })

  it('builds a short phrase prompt (2-5 words)', () => {
    const result = promptBuilder('au revoir', 'English', 'French', '')
    expect(result).toContain('phrase')
  })

  it('builds a long text prompt (6+ words)', () => {
    const result = promptBuilder('one two three four five six', 'English', 'French', '')
    expect(result).toContain('text')
    expect(result).not.toContain('grammarRules')
  })

  it('auto-detects language when sourceLanguage is empty', () => {
    const result = promptBuilder('hola', 'English', '', '')
    expect(result).toContain('Detect and state the language')
  })

  it('auto-detects language when sourceLanguage is UNKNOWN', () => {
    const result = promptBuilder('hola', 'English', 'UNKNOWN', '')
    expect(result).toContain('Detect and state the language')
  })

  it('includes personal context when provided', () => {
    const result = promptBuilder('café', 'English', 'French', 'I am a barista')
    expect(result).toContain('I am a barista')
  })

  it('omits personal context when empty', () => {
    const result = promptBuilder('café', 'English', 'French', '')
    expect(result).not.toContain('take into account this context about me')
  })

  it('defaults target to English when null', () => {
    const result = promptBuilder('test', null as any, 'French', '')
    expect(result).toContain('Translate to English')
  })

  it('includes relatedWords instruction for single words', () => {
    const result = promptBuilder('chat', 'English', 'French', '', 'Le chat dort')
    expect(result).toContain('relatedWords')
  })
})

// ---------- enrichmentPromptBuilder ----------

describe('enrichmentPromptBuilder', () => {
  it('includes all fields for short text (≤5 words)', () => {
    const result = enrichmentPromptBuilder('chat', 'cat', 'English', 'French', '')
    expect(result).toContain('phoneticApproximation')
    expect(result).toContain('fixedExpression')
    expect(result).toContain('commonUsage')
    expect(result).toContain('grammarRules')
    expect(result).toContain('commonness')
    expect(result).toContain('relatedWords')
  })

  it('constrains commonness to the 5-level enum', () => {
    const result = enrichmentPromptBuilder('chat', 'cat', 'English', 'French', '')
    expect(result).toContain('"very rare"')
    expect(result).toContain('"very common"')
  })

  it('only includes phonetics for long text (>5 words)', () => {
    const longText = 'one two three four five six seven'
    const result = enrichmentPromptBuilder(longText, 'translation', 'English', 'French', '')
    expect(result).toContain('phoneticApproximation')
    expect(result).not.toContain('fixedExpression')
    expect(result).not.toContain('grammarRules')
  })

  it('includes sentence context when provided', () => {
    const result = enrichmentPromptBuilder('chat', 'cat', 'English', 'French', '', 'Le', 'dort')
    expect(result).toContain('Le [chat] dort')
  })

  it('omits context line when no before/after', () => {
    const result = enrichmentPromptBuilder('chat', 'cat', 'English', 'French', '')
    expect(result).not.toContain('appears in this context')
  })

  it('includes personal context when provided', () => {
    const result = enrichmentPromptBuilder('chat', 'cat', 'English', 'French', 'I love cats')
    expect(result).toContain('I love cats')
  })
})
