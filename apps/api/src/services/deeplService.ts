import 'dotenv/config'

const DEEPL_API_KEY = process.env.DEEPL_API_KEY
const DEEPL_API_URL = process.env.DEEPL_API_URL || 'https://api-free.deepl.com'

export function isDeepLConfigured(): boolean {
  return !!DEEPL_API_KEY
}

interface DeepLTranslation {
  detected_source_language: string
  text: string
}

interface DeepLResponse {
  translations: DeepLTranslation[]
}

export async function translateWithDeepL(params: {
  text: string
  targetLang: string
  sourceLang?: string | undefined
  context?: string | undefined
}): Promise<{ translatedText: string; detectedSourceLang: string }> {
  if (!DEEPL_API_KEY) {
    throw new Error('DeepL API key not configured')
  }

  const body: Record<string, unknown> = {
    text: [params.text],
    target_lang: params.targetLang,
  }

  if (params.sourceLang) {
    body.source_lang = params.sourceLang
  }

  if (params.context) {
    body.context = params.context
  }

  const response = await fetch(`${DEEPL_API_URL}/v2/translate`, {
    method: 'POST',
    headers: {
      'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (response.status === 403) {
      throw new Error('DeepL authentication failed: invalid API key')
    }
    if (response.status === 456) {
      throw new Error('DeepL quota exceeded')
    }
    throw new Error(`DeepL API error ${response.status}: ${errorText}`)
  }

  const data = (await response.json()) as DeepLResponse

  const first = data.translations?.[0]
  if (!first) {
    throw new Error('DeepL returned empty translations')
  }

  return {
    translatedText: first.text,
    detectedSourceLang: first.detected_source_language,
  }
}

export async function batchTranslateWithDeepL(
  texts: string[],
  targetLang: string,
  sourceLang: string = 'EN',
): Promise<string[]> {
  if (!isDeepLConfigured()) {
    throw new Error('DeepL is not configured')
  }

  const response = await fetch(`${DEEPL_API_URL}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: texts,
      target_lang: targetLang,
      source_lang: sourceLang,
    }),
  })

  if (!response.ok) {
    throw new Error(`DeepL batch translate failed: ${response.status}`)
  }

  const data = await response.json() as { translations: Array<{ text: string }> }
  const result = data.translations.map((t) => t.text)
  if (result.length !== texts.length) {
    throw new Error(`DeepL returned ${result.length} translations for ${texts.length} inputs`)
  }
  return result
}
