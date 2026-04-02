import type { FastifyInstance } from 'fastify'
import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { uiTranslationsTable } from '../db/schema.ts'
import { UI_STRINGS } from './i18n-strings.ts'
import { batchTranslateWithDeepL, isDeepLConfigured } from '../services/deeplService.ts'
import { resolveDeepLTarget } from '../utils/languageCodes.ts'

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
})

export async function i18nRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { language: string; version: string }
  }>('/i18n/translations', async (request, reply) => {
    const { language, version } = request.query

    if (!language || !version) {
      return reply.status(400).send({ error: 'Missing language or version' })
    }

    // English is the default — no translation needed
    if (language === 'English') {
      return reply.send({ translations: null, isDefault: true })
    }

    // Check DB cache
    const [cached] = await db
      .select()
      .from(uiTranslationsTable)
      .where(
        and(
          eq(uiTranslationsTable.language, language),
          eq(uiTranslationsTable.version, version)
        )
      )
      .limit(1)

    if (cached) {
      return reply.send({ translations: JSON.parse(cached.translations) })
    }

    // Cache miss — translate via DeepL (primary) or AI (fallback)
    try {
      let translations: Record<string, string>

      const deepLTarget = resolveDeepLTarget(language)
      if (isDeepLConfigured() && deepLTarget) {
        const keys = Object.keys(UI_STRINGS)
        const values = Object.values(UI_STRINGS)
        const protectedValues = values.map((v) =>
          v.replace(/\{(\w+)\}/g, '<x id="$1"/>'),
        )
        const translated = await batchTranslateWithDeepL(
          protectedValues,
          deepLTarget,
          'EN',
        )
        const restored = translated.map((t) =>
          t.replace(/<x id="(\w+)"\/>/g, '{$1}'),
        )
        translations = Object.fromEntries(keys.map((k, i) => [k, restored[i] ?? '']))
      } else {
        // Fallback to LLM
        const prompt = `You are a professional translator. Translate the following JSON object of UI strings from English to ${language}.

Rules:
- Return ONLY a valid JSON object with the same keys
- Preserve all {placeholder} tokens exactly as-is (e.g. {name}, {count}, {items})
- Keep translations natural and concise — these are UI labels
- Do not translate proper nouns or brand names
- Do not add any explanation, markdown, or extra text

JSON to translate:
${JSON.stringify(UI_STRINGS, null, 2)}`

        const { text } = await generateText({
          model: google('gemini-2.0-flash-lite'),
          prompt,
          temperature: 0,
        })

        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('AI response did not contain valid JSON')
        translations = JSON.parse(jsonMatch[0])
      }

      await db.insert(uiTranslationsTable).values({
        language,
        version,
        translations: JSON.stringify(translations),
      }).onConflictDoNothing()

      return reply.send({ translations })
    } catch (err) {
      request.log.error(err, 'Failed to generate translations')
      return reply.status(500).send({ error: 'Translation generation failed' })
    }
  })
}
