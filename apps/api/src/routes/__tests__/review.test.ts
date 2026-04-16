/**
 * Review session integration tests.
 *
 * Covers:
 *   1. GET /review/due seeds schedules + returns due items
 *   2. POST /review/:id/result quality='good' → SM-2, daily activity, event log
 *   3. POST /review/:id/result quality=5 → numeric mapping → rating 'easy'
 *   4. Invalid quality → 400
 *   5. Invalid conceptId → 400
 *   6. POST /review/sessions happy path
 *   7. POST /review/sessions missing required fields → 400
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { buildApp } from '../../app.ts'
import { db } from '../../db/index.ts'
import {
  reviewScheduleTable,
  reviewEventsTable,
  dailyActivityTable,
} from '../../db/schema.ts'
import {
  createConcept,
  createSchedule,
  createUser,
} from '../../test/db/factories.ts'
import { TOKENS } from '../../test/fixtures/users.ts'

let app: FastifyInstance
let appClosed = false

beforeEach(async () => {
  app = await buildApp({ logger: false })
  appClosed = false
})

afterEach(async () => {
  if (!appClosed) await app.close()
})

/** Seeds Alice user with the supabaseId matching the MSW GoTrue fixture. */
async function seedAlice() {
  return createUser({ supabaseId: 'sb-alice', email: 'alice@test.local' })
}

describe('GET /review/due', () => {
  it('returns due concepts and auto-creates missing schedules', async () => {
    const user = await seedAlice()
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // Two concepts with no schedule (will be auto-created due), one explicitly future.
    const c1 = await createConcept({ userId: user.id, concept: 'c1' })
    const c2 = await createConcept({ userId: user.id, concept: 'c2' })
    const c3 = await createConcept({ userId: user.id, concept: 'c3' })
    await createSchedule({
      conceptId: c3.id,
      userId: user.id,
      nextReviewAt: futureDate,
    })

    const res = await app.inject({
      method: 'GET',
      url: '/review/due',
      headers: { authorization: `Bearer ${TOKENS.alice}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.dueCount).toBe(2)
    const returnedIds = body.concepts.map((c: { id: number }) => c.id).sort()
    expect(returnedIds).toEqual([c1.id, c2.id].sort())
  })
})

describe('POST /review/:conceptId/result', () => {
  it("label 'good' → SM-2 advances, daily activity + event logged", async () => {
    const user = await seedAlice()
    const concept = await createConcept({ userId: user.id })
    await createSchedule({
      conceptId: concept.id,
      userId: user.id,
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
    })

    const res = await app.inject({
      method: 'POST',
      url: `/review/${concept.id}/result`,
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: { quality: 'good' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.message).toBe('Review recorded')
    expect(body.interval).toBe(1) // SM-2 first success → 1 day
    expect(body.conceptState).toBe('learning')

    // Drain background writes.
    // logReviewEvent and updateDailyActivity are fire-and-forget (no await in handler).
    // app.close() alone is not sufficient — give the micro-task queue a moment to settle.
    await app.close()
    appClosed = true
    await new Promise((r) => setTimeout(r, 300))

    const schedules = await db
      .select()
      .from(reviewScheduleTable)
      .where(eq(reviewScheduleTable.conceptId, concept.id))
    expect(schedules[0]?.repetitions).toBe(1)
    expect(schedules[0]?.totalReviews).toBe(1)
    expect(schedules[0]?.correctReviews).toBe(1)

    const events = await db
      .select()
      .from(reviewEventsTable)
      .where(eq(reviewEventsTable.conceptId, concept.id))
    expect(events.length).toBe(1)
    expect(events[0]?.rating).toBe('good')
    expect(events[0]?.correct).toBe(1)

    const activity = await db
      .select()
      .from(dailyActivityTable)
      .where(eq(dailyActivityTable.userId, user.id))
    expect(activity[0]?.reviewsCompleted).toBe(1)
    expect(activity[0]?.correctReviews).toBe(1)
  })

  it('numeric quality=5 maps to rating "easy"', async () => {
    const user = await seedAlice()
    const concept = await createConcept({ userId: user.id })
    await createSchedule({ conceptId: concept.id, userId: user.id })

    const res = await app.inject({
      method: 'POST',
      url: `/review/${concept.id}/result`,
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: { quality: 5 },
    })

    expect(res.statusCode).toBe(200)
    await app.close()
    appClosed = true
    await new Promise((r) => setTimeout(r, 300))

    const events = await db
      .select()
      .from(reviewEventsTable)
      .where(eq(reviewEventsTable.conceptId, concept.id))
    expect(events[0]?.rating).toBe('easy')
  })

  it('invalid quality value → 400', async () => {
    const user = await seedAlice()
    const concept = await createConcept({ userId: user.id })

    const res = await app.inject({
      method: 'POST',
      url: `/review/${concept.id}/result`,
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: { quality: 99 },
    })

    expect(res.statusCode).toBe(400)
  })

  it('non-numeric conceptId → 400', async () => {
    await seedAlice()

    const res = await app.inject({
      method: 'POST',
      url: `/review/notanumber/result`,
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: { quality: 'good' },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('POST /review/sessions', () => {
  it('saves a completed session', async () => {
    await seedAlice()

    const res = await app.inject({
      method: 'POST',
      url: '/review/sessions',
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: {
        mode: 'flashcard',
        totalItems: 10,
        correctItems: 8,
        accuracy: 80,
        durationSeconds: 300,
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.message).toBe('Session saved')
    expect(body.session.mode).toBe('flashcard')
    expect(body.session.totalItems).toBe(10)
  })

  it('rejects when required field is missing', async () => {
    await seedAlice()

    const res = await app.inject({
      method: 'POST',
      url: '/review/sessions',
      headers: { authorization: `Bearer ${TOKENS.alice}`, 'content-type': 'application/json' },
      payload: {
        mode: 'flashcard',
        totalItems: 10,
        correctItems: 8,
        // accuracy missing
      },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toMatch(/Missing required fields/i)
  })
})
