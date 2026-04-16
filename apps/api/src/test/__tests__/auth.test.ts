import { describe, it, expect } from 'vitest'
import { buildApp } from '../../app.ts'
import { createUser } from '../db/factories.ts'
import { TOKENS } from '../fixtures/users.ts'

describe('requireAuth via MSW GoTrue', () => {
  it('rejects missing Authorization header with 401', async () => {
    const app = await buildApp({ logger: false })
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/review/due',
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('rejects unknown token with 401', async () => {
    const app = await buildApp({ logger: false })
    try {
      const res = await app.inject({
        method: 'GET',
        url: '/review/due',
        headers: { authorization: `Bearer ${TOKENS.invalid}` },
      })
      expect(res.statusCode).toBe(401)
    } finally {
      await app.close()
    }
  })

  it('accepts known token and returns empty due list for user without concepts', async () => {
    const app = await buildApp({ logger: false })
    try {
      await createUser({ supabaseId: 'sb-alice', email: 'alice@test.local' })
      const res = await app.inject({
        method: 'GET',
        url: '/review/due',
        headers: { authorization: `Bearer ${TOKENS.alice}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ concepts: [], dueCount: 0 })
    } finally {
      await app.close()
    }
  })
})
