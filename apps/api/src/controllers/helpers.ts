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

export function getSelectionLength(text: string): number {
  const match = text.match(/\[([^\]]+)\]/)
  const selection: string = match?.[1] ?? ''

  return selection.split(' ').length
}

export function promptBuilder(
  text: string,
  targetLanguage: string,
  sourceLanguage: string,
  personalContext: string
): string {
  let unknownSourceLang: boolean = false
  if (!sourceLanguage || sourceLanguage === 'UNKNOWN') {
    unknownSourceLang = true
  }

  const selectionLength: number = getSelectionLength(text)
  const textLengh: number = text.split(' ').length

  let promptAdjustment: Array<string>

  const instructionFixedExpression: string =
    '"fixedExpression": "no" or the idiom/expression this word belongs to in context.'
  const commonUsage: string =
    '"commonUsage": Typical usage; note if context differs from common meaning.'
  const instructionGrammar: string =
    '"grammarRules": Relevant grammar (part of speech, agreement, irregularities).'
  const instructionCommonness: string =
    '"commonness": Frequency in everyday speech (≤5 words).'

  if (selectionLength === 1) {
    if (textLengh === selectionLength) {
      promptAdjustment = [
        'do the following',
        '',
        'word',
        '',
        '',
        instructionCommonness,
      ]
    } else {
      promptAdjustment = [
        'do the following for the word marked with []',
        instructionFixedExpression,
        'word or expression',
        commonUsage,
        instructionGrammar,
        instructionCommonness,
      ]
    }
  } else if (selectionLength < 6) {
    if (textLengh === selectionLength) {
      promptAdjustment = [
        'do the following',
        '',
        'phrase',
        '',
        instructionGrammar,
        instructionCommonness,
      ]
    } else {
      promptAdjustment = [
        'do the following for the snippet marked with []',
        instructionFixedExpression,
        'phrase',
        commonUsage,
        instructionGrammar,
        instructionCommonness,
      ]
    }
  } else if (selectionLength >= 6) {
    promptAdjustment = ['do the following', '', 'text', '', '', '']
  } else {
    throw new Error('No selection identified')
  }

  const lang = unknownSourceLang ? 'Detect and state the source language.' : sourceLanguage
  const optField1 = promptAdjustment[1] ? `\n${promptAdjustment[1]}` : ''
  const optField3 = promptAdjustment[3] ? `\n${promptAdjustment[3]}` : ''
  const optField4 = promptAdjustment[4] ? `\n${promptAdjustment[4]}` : ''
  const optField5 = promptAdjustment[5] ? `\n${promptAdjustment[5]}` : ''
  const personalCtx = personalContext
    ? `\nIf it makes sense, take into account this context about me: ${personalContext}.`
    : ''
  const resolvedTarget = targetLanguage ?? 'English'

  const promptContents = `For the text I provide, ${promptAdjustment[0]}:

Translate to ${resolvedTarget} and return a JSON object with these keys. Write all field values in ${resolvedTarget}:

"language": ${lang}${optField1}
"contextualTranslation": Best ${resolvedTarget} translation of the marked ${promptAdjustment[2]} in this context.
"phoneticApproximation": ${resolvedTarget}-sound phonetic approximation.${optField3}${optField4}${optField5}${personalCtx}

Text: ${text}`

  return promptContents
}
