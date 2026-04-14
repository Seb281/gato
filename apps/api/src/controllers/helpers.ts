/**
 * Extracts a JSON object from an LLM response string.
 * Strips markdown code fences and finds the first `{...}` block.
 */
export function extractJSON(apiResponse: string): object {
  // Remove markdown code blocks if present
  const cleanedResponse = apiResponse.replace(/```json\n?|\n?```/g, '').trim()

  const match = cleanedResponse.match(/\{[\s\S]*\}/)
  if (match) {
    try {
      return JSON.parse(match[0])
    } catch (e) {
      console.error('Failed to parse JSON:', match[0], e)
      throw new Error('Invalid JSON format in response')
    }
  }
  throw new Error('No valid JSON found in response')
}

/**
 * Builds the LLM translation prompt.
 *
 * @param selection  - The word or phrase the user selected.
 * @param targetLanguage - Language to translate into.
 * @param sourceLanguage - Source language (empty / "UNKNOWN" = auto-detect).
 * @param personalContext - Optional personal context to guide translation style.
 * @param context - Optional surrounding text that provides sentence context.
 */
export function promptBuilder(
  selection: string,
  targetLanguage: string,
  sourceLanguage: string,
  personalContext: string,
  context?: string,
): string {
  let unknownSourceLang: boolean = false
  if (!sourceLanguage || sourceLanguage === 'UNKNOWN') {
    unknownSourceLang = true
  }

  const selectionLength = selection.trim().split(/\s+/).length
  const hasContext = !!context && context !== selection

  let promptAdjustment: Array<string>

  const instructionFixedExpression: string =
    '"fixedExpression": "no" or the idiom/expression this word belongs to in context.'
  const commonUsage: string =
    '"commonUsage": Typical usage; note if context differs from common meaning.'
  const instructionGrammar: string =
    '"grammarRules": Relevant grammar (part of speech, agreement, irregularities).'
  const instructionCommonness: string =
    '"commonness": Exactly one of these values: "very rare" | "rare" | "uncommon" | "common" | "very common". Return the string only, no other text.'
  const instructionRelatedWords: string =
    '"relatedWords": Array of up to 5 related words as JSON: [{"word": "...", "translation": "...", "relation": "synonym|antonym|family"}]. Words in source language, translations in target language. "family" means same word family (e.g. noun/verb/adjective forms). Return empty array [] if none.'

  if (selectionLength === 1) {
    if (!hasContext) {
      promptAdjustment = [
        'do the following',
        '',
        'word',
        '',
        '',
        instructionCommonness,
        instructionRelatedWords,
      ]
    } else {
      promptAdjustment = [
        'do the following for the word marked with []',
        instructionFixedExpression,
        'word or expression',
        commonUsage,
        instructionGrammar,
        instructionCommonness,
        instructionRelatedWords,
      ]
    }
  } else if (selectionLength < 6) {
    if (!hasContext) {
      promptAdjustment = [
        'do the following',
        '',
        'phrase',
        '',
        instructionGrammar,
        instructionCommonness,
        instructionRelatedWords,
      ]
    } else {
      promptAdjustment = [
        'do the following for the snippet marked with []',
        instructionFixedExpression,
        'phrase',
        commonUsage,
        instructionGrammar,
        instructionCommonness,
        instructionRelatedWords,
      ]
    }
  } else if (selectionLength >= 6) {
    promptAdjustment = ['do the following', '', 'text', '', '', '', '']
  } else {
    throw new Error('No selection identified')
  }

  const lang = unknownSourceLang
    ? 'Detect and state the language of the given Text.'
    : sourceLanguage
  const optField1 = promptAdjustment[1] ? `\n${promptAdjustment[1]}` : ''
  const optField3 = promptAdjustment[3] ? `\n${promptAdjustment[3]}` : ''
  const optField4 = promptAdjustment[4] ? `\n${promptAdjustment[4]}` : ''
  const optField5 = promptAdjustment[5] ? `\n${promptAdjustment[5]}` : ''
  const optField6 = promptAdjustment[6] ? `\n${promptAdjustment[6]}` : ''
  const personalCtx = personalContext
    ? `\nIf it makes sense, take into account this context about me: ${personalContext}.`
    : ''
  const resolvedTarget = targetLanguage ?? 'English'

  // Reconstruct bracket format only for the LLM prompt text, not the API contract
  const promptText = hasContext
    ? context!.replace(selection, `[${selection}]`)
    : `[${selection}]`

  const promptContents = `For the text I provide, ${promptAdjustment[0]}:

Translate to ${resolvedTarget} and return a JSON object with these keys. Write all field values in ${resolvedTarget}:

"language": ${lang}${optField1}
"contextualTranslation": Best ${resolvedTarget} translation of the marked ${promptAdjustment[2]} in this context.
"phoneticApproximation": Phonetic approximation of the ORIGINAL ${promptAdjustment[2]} (NOT the translation), written using ${resolvedTarget} sounds so a ${resolvedTarget} speaker can pronounce it.${optField3}${optField4}${optField5}${optField6}${personalCtx}

Text: ${promptText}`

  return promptContents
}

export function enrichmentPromptBuilder(
  text: string,
  translation: string,
  targetLanguage: string,
  sourceLanguage: string,
  personalContext: string,
  contextBefore: string = '',
  contextAfter: string = '',
): string {
  const wordCount = text.trim().split(/\s+/).length
  const resolvedTarget = targetLanguage || 'English'
  const resolvedSource = sourceLanguage || 'the source language'

  const fields: string[] = []

  fields.push(
    `"phoneticApproximation": Phonetic approximation of "${text}" (the ORIGINAL word, NOT the translation "${translation}"), written using ${resolvedTarget} sounds so a ${resolvedTarget} speaker can pronounce it.`
  )

  if (wordCount <= 5) {
    fields.push(
      `"fixedExpression": "no" or the idiom/expression "${text}" belongs to, if any.`
    )
    fields.push(
      `"commonUsage": Typical usage of "${text}"; note if context differs from common meaning.`
    )
    fields.push(
      `"grammarRules": Relevant grammar (part of speech, agreement, irregularities).`
    )
    fields.push(
      `"commonness": Exactly one of these values: "very rare" | "rare" | "uncommon" | "common" | "very common". Return the string only, no other text.`
    )
    fields.push(
      `"relatedWords": Array of up to 5 related words as JSON: [{"word": "...", "translation": "...", "relation": "synonym|antonym|family"}]. Words in ${resolvedSource}, translations in ${resolvedTarget}. "family" means same word family (e.g. noun/verb/adjective forms). Return empty array [] if none.`
    )
  } else {
    // Longer text: only phonetics (already added above)
  }

  const personalCtx = personalContext
    ? `\nIf it makes sense, take into account this context about me: ${personalContext}.`
    : ''

  const sentenceCtx = (contextBefore || contextAfter)
    ? `\nIt appears in this context: "${contextBefore} [${text}] ${contextAfter}". Use this context to inform your answers (e.g. usage notes, meaning, grammar).`
    : ''

  return `The ${resolvedSource} text "${text}" has been translated to ${resolvedTarget} as "${translation}".${sentenceCtx}

Provide additional linguistic information. Return a JSON object with these keys. Write all field values in ${resolvedTarget}:

${fields.join('\n')}${personalCtx}`
}
