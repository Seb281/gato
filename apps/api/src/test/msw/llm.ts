/**
 * MSW handlers for the four LLM providers the API talks to via the AI SDK.
 *
 * Each handler returns a response envelope the respective provider SDK
 * knows how to unwrap, with a `text` field containing a JSON payload that
 * the orchestrator's `extractJSON()` helper can parse.
 *
 * A single canned payload is used across providers — tests that need to
 * differentiate providers assert on request URL or request body, not on
 * response content.
 *
 * Upstream doc links:
 * - Gemini: https://ai.google.dev/api/generate-content
 * - OpenAI: https://platform.openai.com/docs/api-reference/chat
 * - Anthropic: https://docs.anthropic.com/en/api/messages
 * - Mistral: https://docs.mistral.ai/api/#tag/chat
 */
import { http, HttpResponse } from 'msw'

export const CANNED_LLM_JSON = {
  contextualTranslation: '[LLM] translation',
  language: 'German',
  phoneticApproximation: 'HAH-loh',
  fixedExpression: 'no',
  commonUsage: 'Everyday greeting.',
  grammarRules: 'Interjection.',
  commonness: 'very common',
  relatedWords: [
    { word: 'Hi', translation: 'hi', relation: 'synonym' },
  ],
}

const CANNED_TEXT = '```json\n' + JSON.stringify(CANNED_LLM_JSON) + '\n```'

/** Track which providers were called; tests read this to assert routing. */
export const providerCallLog: string[] = []
export function clearProviderCallLog() {
  providerCallLog.length = 0
}

export const llmHandlers = [
  // Google Gemini: POST generative-language .../models/...:generateContent
  http.post(
    /generativelanguage\.googleapis\.com.*:generateContent/,
    () => {
      providerCallLog.push('google')
      return HttpResponse.json({
        candidates: [{ content: { parts: [{ text: CANNED_TEXT }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      })
    }
  ),

  // OpenAI Responses API (ai-sdk/openai v3+ uses /v1/responses, not /v1/chat/completions).
  // Schema requires: output[].type='message', content[].type='output_text', content[].annotations=[].
  http.post('https://api.openai.com/v1/responses', () => {
    providerCallLog.push('openai')
    return HttpResponse.json({
      id: 'resp-test',
      created_at: Math.floor(Date.now() / 1000),
      model: 'gpt-test',
      output: [
        {
          type: 'message',
          role: 'assistant',
          id: 'msg-test',
          content: [{ type: 'output_text', text: CANNED_TEXT, annotations: [] }],
        },
      ],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
  }),

  // Anthropic Messages
  http.post('https://api.anthropic.com/v1/messages', () => {
    providerCallLog.push('anthropic')
    return HttpResponse.json({
      id: 'msg-test',
      type: 'message',
      role: 'assistant',
      model: 'claude-test',
      content: [{ type: 'text', text: CANNED_TEXT }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    })
  }),

  // Mistral Chat Completions
  http.post('https://api.mistral.ai/v1/chat/completions', () => {
    providerCallLog.push('mistral')
    return HttpResponse.json({
      id: 'mistral-test',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'mistral-test',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: CANNED_TEXT },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    })
  }),
]

/** Override factory: Gemini returns invalid JSON to exercise extractJSON() failure path. */
export function geminiMalformedHandler() {
  return http.post(
    /generativelanguage\.googleapis\.com.*:generateContent/,
    () =>
      HttpResponse.json({
        candidates: [{ content: { parts: [{ text: 'not really json at all' }] } }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      })
  )
}
