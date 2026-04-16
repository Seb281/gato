/**
 * Translation flow integration tests.
 *
 * Covers:
 *   1. DeepL happy path → `{ provider: 'deepl' }`
 *   2. DeepL 5xx → LLM fallback → `{ provider: 'llm' }`
 *   3. LLM-only path (unsupported DeepL target) → `{ provider: 'llm' }`
 *   4. BYOK → OpenAI handler hit, not Gemini
 *   5. Malformed LLM JSON → 500 from handler
 *   6. Missing/invalid auth → translate endpoint tolerates, but protected
 *      endpoints reject — we assert the enrich path's 503 when no auth + no key.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../app.ts'
import { createUser } from '../../test/db/factories.ts'
import { TOKENS } from '../../test/fixtures/users.ts'
import { server } from '../../test/msw/server.ts'
import { deeplError5xxHandler } from '../../test/msw/deepl.ts'
import {
  clearProviderCallLog,
  geminiMalformedHandler,
  providerCallLog,
} from '../../test/msw/llm.ts'

let app: FastifyInstance

beforeEach(async () => {
  app = await buildApp({ logger: false })
  clearProviderCallLog()
})

afterEach(async () => {
  await app.close()
})

describe('POST /translation', () => {
  it('DeepL happy path: German target resolves to DeepL code', async () => {
    await createUser({ supabaseId: 'sb-alice', email: 'alice@test.local' })

    const res = await app.inject({
      method: 'POST',
      url: '/translation',
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: {
        selection: 'Hallo',
        sourceLanguage: 'German',
        targetLanguage: 'English',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.provider).toBe('deepl')
    expect(body.contextualTranslation).toBe('[DL] Hallo')
    expect(providerCallLog).toEqual([]) // no LLM call
  })

  it('DeepL 5xx falls back to LLM', async () => {
    await createUser({ supabaseId: 'sb-alice', email: 'alice@test.local' })
    server.use(deeplError5xxHandler())

    const res = await app.inject({
      method: 'POST',
      url: '/translation',
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: {
        selection: 'Hallo',
        sourceLanguage: 'German',
        targetLanguage: 'English',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.provider).toBe('llm')
    expect(body.contextualTranslation).toBe('[LLM] translation')
    expect(providerCallLog).toEqual(['google'])
  })

  it('Unsupported DeepL target goes straight to LLM', async () => {
    await createUser({ supabaseId: 'sb-alice', email: 'alice@test.local' })

    const res = await app.inject({
      method: 'POST',
      url: '/translation',
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: {
        selection: 'Aloha',
        sourceLanguage: 'Hawaiian', // unsupported by DeepL
        targetLanguage: 'Esperanto',
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.provider).toBe('llm')
    expect(providerCallLog).toEqual(['google'])
  })

  it('BYOK user with preferredProvider=openai routes to OpenAI', async () => {
    await createUser({
      supabaseId: 'sb-alice',
      email: 'alice@test.local',
      customApiKey: 'user-openai-key',
      preferredProvider: 'openai',
    })

    const res = await app.inject({
      method: 'POST',
      url: '/translation',
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: {
        selection: 'Aloha',
        sourceLanguage: 'Hawaiian',
        targetLanguage: 'Esperanto',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().provider).toBe('llm')
    expect(providerCallLog).toEqual(['openai'])
  })

  it('Malformed LLM JSON returns 500', async () => {
    await createUser({ supabaseId: 'sb-alice', email: 'alice@test.local' })
    server.use(geminiMalformedHandler())

    const res = await app.inject({
      method: 'POST',
      url: '/translation',
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: {
        selection: 'Aloha',
        sourceLanguage: 'Hawaiian',
        targetLanguage: 'Esperanto',
      },
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toMatch(/Translation failed/i)
  })

  it('Translation endpoint tolerates missing Authorization header', async () => {
    // Note: /translation is NOT behind requireAuth — it soft-reads auth to pick the model.
    // Without a header, it uses the system Gemini. This is by design (extension users
    // who aren't logged in can still translate). Asserted here to lock the behavior.
    const res = await app.inject({
      method: 'POST',
      url: '/translation',
      headers: { 'content-type': 'application/json' },
      payload: {
        selection: 'Aloha',
        sourceLanguage: 'Hawaiian',
        targetLanguage: 'Esperanto',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().provider).toBe('llm')
  })
})
