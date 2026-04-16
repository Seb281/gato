import { describe, it, expect, beforeEach } from 'vitest'
import { truncateAll } from '../truncate.ts'
import { createUser, createConcept, createSchedule, createTag } from '../factories.ts'

describe('db factories', () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it('creates a user with sensible defaults', async () => {
    const user = await createUser()
    expect(user.id).toBeGreaterThan(0)
    expect(user.supabaseId).toMatch(/^sb-/)
    expect(user.email).toMatch(/@test\.local$/)
  })

  it('creates a concept for a user', async () => {
    const user = await createUser()
    const concept = await createConcept({ userId: user.id })
    expect(concept.userId).toBe(user.id)
    expect(concept.state).toBe('new')
  })

  it('creates a schedule due now by default', async () => {
    const user = await createUser()
    const concept = await createConcept({ userId: user.id })
    const schedule = await createSchedule({ conceptId: concept.id, userId: user.id })
    expect(schedule.nextReviewAt.getTime()).toBe(0)
  })

  it('creates a tag scoped to a user', async () => {
    const user = await createUser()
    const tag = await createTag({ userId: user.id })
    expect(tag.userId).toBe(user.id)
  })

  it('truncateAll clears rows between runs', async () => {
    const { db } = await import('../../../db/index.ts')
    const { usersTable } = await import('../../../db/schema.ts')
    await createUser()
    await truncateAll()
    const rows = await db.select().from(usersTable)
    expect(rows.length).toBe(0)
  })
})
