import { describe, expect, it, afterAll } from 'vitest'
import { buildApp } from '../../app.ts'

describe('swagger plugin', () => {
  const appPromise = buildApp({ logger: false })

  afterAll(async () => {
    const app = await appPromise
    await app.close()
  })

  it('serves OpenAPI JSON at /docs/json', async () => {
    const app = await appPromise
    const res = await app.inject({ method: 'GET', url: '/docs/json' })
    expect(res.statusCode).toBe(200)
    const spec = res.json()
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('Gato API')
  })

  it('declares bearerAuth security scheme', async () => {
    const app = await appPromise
    const res = await app.inject({ method: 'GET', url: '/docs/json' })
    const spec = res.json()
    expect(spec.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    })
  })

  it('serves Swagger UI HTML at /docs', async () => {
    const app = await appPromise
    const res = await app.inject({ method: 'GET', url: '/docs' })
    // Swagger UI plugin may 302 to /docs/ — follow it.
    const finalRes = res.statusCode === 302
      ? await app.inject({ method: 'GET', url: res.headers.location as string })
      : res
    expect(finalRes.statusCode).toBe(200)
    expect(finalRes.headers['content-type']).toMatch(/html/)
  })
})
