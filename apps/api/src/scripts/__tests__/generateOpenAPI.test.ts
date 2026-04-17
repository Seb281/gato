import { describe, expect, it, afterAll } from 'vitest'
import { buildApp } from '../../app.ts'

describe('OpenAPI spec generation', () => {
  const appPromise = buildApp({ logger: false })
  afterAll(async () => (await appPromise).close())

  it('emits a valid OpenAPI 3.1 document with Gato info', async () => {
    const app = await appPromise
    await app.ready()
    const spec = app.swagger() as any
    expect(spec.openapi).toBe('3.1.0')
    expect(spec.info.title).toBe('Gato API')
    expect(spec.info.version).toBeDefined()
  })

  it('declares the full tag list', async () => {
    const app = await appPromise
    await app.ready()
    const spec = app.swagger() as any
    const tagNames = (spec.tags as Array<{ name: string }>).map((t) => t.name).sort()
    expect(tagNames).toEqual([
      'concepts',
      'i18n',
      'quiz',
      'review',
      'sentence-builder',
      'stats',
      'suggestions',
      'tags',
      'translation',
      'user',
    ])
  })
})
