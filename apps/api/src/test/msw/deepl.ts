/**
 * MSW handlers for DeepL. The test env sets `DEEPL_API_URL=http://msw.local/deepl`
 * so the real `translateWithDeepL()` hits `http://msw.local/deepl/v2/translate`.
 *
 * Upstream docs: https://developers.deepl.com/docs/api-reference/translate
 * We mirror only the fields the orchestrator reads: `translations[0].text`
 * and `translations[0].detected_source_language`.
 */
import { http, HttpResponse } from 'msw'

export const deeplHandlers = [
  http.post('http://msw.local/deepl/v2/translate', async ({ request }) => {
    const body = (await request.json()) as {
      text: string[]
      target_lang: string
      source_lang?: string
    }
    const input = body.text[0] ?? ''
    // Deterministic canned translation: prefix with "[DL]" so tests can assert.
    return HttpResponse.json({
      translations: [
        {
          detected_source_language: body.source_lang ?? 'DE',
          text: `[DL] ${input}`,
        },
      ],
    })
  }),
]

/** Override factory — use in a test via `server.use(deeplError5xxHandler())`. */
export function deeplError5xxHandler() {
  return http.post('http://msw.local/deepl/v2/translate', () =>
    HttpResponse.text('service unavailable', { status: 503 })
  )
}
