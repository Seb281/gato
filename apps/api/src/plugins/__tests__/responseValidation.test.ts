import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'
import { z } from 'zod'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { registerResponseValidation } from '../responseValidation.ts'

describe('responseValidation plugin', () => {
  const originalStrict = process.env.RESPONSE_VALIDATION

  beforeEach(() => {
    delete process.env.RESPONSE_VALIDATION
  })

  afterEach(() => {
    if (originalStrict === undefined) delete process.env.RESPONSE_VALIDATION
    else process.env.RESPONSE_VALIDATION = originalStrict
  })

  function makeApp() {
    const app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>()
    app.setValidatorCompiler(validatorCompiler)
    app.setSerializerCompiler(() => (data) => JSON.stringify(data))
    return app
  }

  it('passes through when payload matches schema (warn mode)', async () => {
    const app = makeApp()
    registerResponseValidation(app)
    app.get('/ok', {
      schema: { response: { 200: z.object({ value: z.number() }) } },
    }, async () => ({ value: 42 }))

    const res = await app.inject({ method: 'GET', url: '/ok' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ value: 42 })
    await app.close()
  })

  it('logs warning but does not 500 on drift (warn mode)', async () => {
    const app = makeApp()
    const warnSpy = vi.fn()
    // Attach a log wrapper
    app.addHook('onRequest', async (request) => {
      request.log.warn = warnSpy
    })
    registerResponseValidation(app)
    app.get('/drift', {
      schema: { response: { 200: z.object({ value: z.number() }) } },
    }, async () => ({ value: 'not-a-number' } as any))

    const res = await app.inject({ method: 'GET', url: '/drift' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ value: 'not-a-number' })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    await app.close()
  })

  it('500s on drift in strict mode', async () => {
    process.env.RESPONSE_VALIDATION = 'strict'
    const app = makeApp()
    registerResponseValidation(app)
    app.get('/drift', {
      schema: { response: { 200: z.object({ value: z.number() }) } },
    }, async () => ({ value: 'not-a-number' } as any))

    const res = await app.inject({ method: 'GET', url: '/drift' })
    expect(res.statusCode).toBe(500)
    await app.close()
  })

  it('ignores non-JSON payloads gracefully', async () => {
    const app = makeApp()
    registerResponseValidation(app)
    app.get('/text', {
      schema: { response: { 200: z.object({ value: z.number() }) } },
    }, async (_req, reply) => {
      ;(reply as any).type('text/plain').send('plain text')
    })

    const res = await app.inject({ method: 'GET', url: '/text' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('plain text')
    await app.close()
  })
})
