import { db } from '../db/index.ts'
import { and, eq, lte, gte, lt, sql, ne, inArray, isNull, desc, or, isNotNull } from 'drizzle-orm'
import {
  reviewScheduleTable,
  conceptsTable,
  reviewSessionsTable,
  reviewEventsTable,
} from '../db/schema.ts'
import type { ReviewSchedule, Concept, ReviewSession, ReviewEvent } from '../db/schema.ts'

/**
 * Labels stored in `review_events.rating`. Keeping this as a const tuple
 * gives us a compile-time union for the logging helper and a runtime array
 * for validation.
 */
export const REVIEW_RATINGS = ['again', 'hard', 'good', 'easy'] as const
export type ReviewRating = (typeof REVIEW_RATINGS)[number]

/**
 * Convert an SM-2 numeric quality (0-5) into one of the four review rating
 * labels the event log stores. Used when the client submits a numeric
 * `quality` instead of a label — keeps the log shape consistent.
 */
export function numericQualityToRating(quality: number): ReviewRating {
  if (quality >= 5) return 'easy'
  if (quality === 4) return 'good'
  if (quality === 3) return 'hard'
  return 'again'
}

const reviewData = {
  async getDueConcepts(
    userId: number,
    limit: number = 20
  ): Promise<(Concept & { schedule: ReviewSchedule })[]> {
    const now = new Date()

    const schedules = await db
      .select()
      .from(reviewScheduleTable)
      .innerJoin(conceptsTable, eq(reviewScheduleTable.conceptId, conceptsTable.id))
      .where(
        and(
          eq(reviewScheduleTable.userId, userId),
          lte(reviewScheduleTable.nextReviewAt, now)
        )
      )
      .orderBy(reviewScheduleTable.nextReviewAt)
      .limit(limit)

    return schedules.map((row) => ({
      ...row.concepts,
      schedule: row.review_schedule,
    }))
  },

  async getAnyConcepts(
    userId: number,
    limit: number = 20
  ): Promise<(Concept & { schedule: ReviewSchedule })[]> {
    const schedules = await db
      .select()
      .from(reviewScheduleTable)
      .innerJoin(conceptsTable, eq(reviewScheduleTable.conceptId, conceptsTable.id))
      .where(eq(reviewScheduleTable.userId, userId))
      .orderBy(sql`RANDOM()`)
      .limit(limit)

    return schedules.map((row) => ({
      ...row.concepts,
      schedule: row.review_schedule,
    }))
  },

  async getDueConceptsWithContext(
    userId: number,
    limit: number = 20
  ): Promise<(Concept & { schedule: ReviewSchedule })[]> {
    const now = new Date()

    const schedules = await db
      .select()
      .from(reviewScheduleTable)
      .innerJoin(conceptsTable, eq(reviewScheduleTable.conceptId, conceptsTable.id))
      .where(
        and(
          eq(reviewScheduleTable.userId, userId),
          lte(reviewScheduleTable.nextReviewAt, now),
          or(
            isNotNull(conceptsTable.contextBefore),
            isNotNull(conceptsTable.contextAfter)
          )
        )
      )
      .orderBy(reviewScheduleTable.nextReviewAt)
      .limit(limit)

    return schedules.map((row) => ({
      ...row.concepts,
      schedule: row.review_schedule,
    }))
  },

  async getDueCount(userId: number): Promise<number> {
    const now = new Date()
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewScheduleTable)
      .where(
        and(
          eq(reviewScheduleTable.userId, userId),
          lte(reviewScheduleTable.nextReviewAt, now)
        )
      )
    return result[0]?.count ?? 0
  },

  async getOrCreateSchedule(
    conceptId: number,
    userId: number
  ): Promise<ReviewSchedule> {
    const existing = await db.query.reviewScheduleTable.findFirst({
      where: and(
        eq(reviewScheduleTable.conceptId, conceptId),
        eq(reviewScheduleTable.userId, userId)
      ),
    })

    if (existing) return existing

    const result = await db
      .insert(reviewScheduleTable)
      .values({ conceptId, userId })
      .onConflictDoNothing()
      .returning()

    // Handle race condition — if onConflictDoNothing returns nothing, re-fetch
    if (result.length === 0) {
      const refetched = await db.query.reviewScheduleTable.findFirst({
        where: and(
          eq(reviewScheduleTable.conceptId, conceptId),
          eq(reviewScheduleTable.userId, userId)
        ),
      })
      if (!refetched) throw new Error('Failed to create review schedule')
      return refetched
    }

    return result[0]!
  },

  async updateSchedule(
    scheduleId: number,
    fields: {
      easeFactor: number
      interval: number
      repetitions: number
      nextReviewAt: Date
      lastReviewedAt: Date
      totalReviews: number
      correctReviews: number
    }
  ): Promise<ReviewSchedule | undefined> {
    const result = await db
      .update(reviewScheduleTable)
      .set(fields)
      .where(eq(reviewScheduleTable.id, scheduleId))
      .returning()
    return result[0]
  },

  async getReviewStats(
    userId: number
  ): Promise<{ totalReviewed: number; dueNow: number; avgAccuracy: number }> {
    const now = new Date()

    const [statsResult, dueResult] = await Promise.all([
      db
        .select({
          totalReviewed: sql<number>`coalesce(sum(${reviewScheduleTable.totalReviews}), 0)::int`,
          totalCorrect: sql<number>`coalesce(sum(${reviewScheduleTable.correctReviews}), 0)::int`,
        })
        .from(reviewScheduleTable)
        .where(eq(reviewScheduleTable.userId, userId)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewScheduleTable)
        .where(
          and(
            eq(reviewScheduleTable.userId, userId),
            lte(reviewScheduleTable.nextReviewAt, now)
          )
        ),
    ])

    const totalReviewed = statsResult[0]?.totalReviewed ?? 0
    const totalCorrect = statsResult[0]?.totalCorrect ?? 0
    const dueNow = dueResult[0]?.count ?? 0
    const avgAccuracy = totalReviewed > 0 ? Math.round((totalCorrect / totalReviewed) * 100) : 0

    return { totalReviewed, dueNow, avgAccuracy }
  },

  async getRandomDistractors(
    userId: number,
    excludeConceptId: number,
    count: number = 3
  ): Promise<string[]> {
    const rows = await db
      .select({ translation: conceptsTable.translation })
      .from(conceptsTable)
      .where(
        and(
          eq(conceptsTable.userId, userId),
          ne(conceptsTable.id, excludeConceptId)
        )
      )
      .orderBy(sql`random()`)
      .limit(count)

    return rows.map((r) => r.translation)
  },

  async getReviewSchedulesForConcepts(
    conceptIds: number[]
  ): Promise<Map<number, { nextReviewAt: Date | null }>> {
    if (conceptIds.length === 0) return new Map()

    const rows = await db
      .select({
        conceptId: reviewScheduleTable.conceptId,
        nextReviewAt: reviewScheduleTable.nextReviewAt,
      })
      .from(reviewScheduleTable)
      .where(inArray(reviewScheduleTable.conceptId, conceptIds))

    const map = new Map<number, { nextReviewAt: Date | null }>()
    for (const row of rows) {
      map.set(row.conceptId, { nextReviewAt: row.nextReviewAt })
    }
    return map
  },

  async getConceptIdsByReviewStatus(
    userId: number,
    status: 'overdue' | 'due-today' | 'reviewed' | 'new'
  ): Promise<number[]> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

    if (status === 'new') {
      // Concepts with no review_schedule entry
      const rows = await db
        .select({ id: conceptsTable.id })
        .from(conceptsTable)
        .leftJoin(reviewScheduleTable, eq(conceptsTable.id, reviewScheduleTable.conceptId))
        .where(
          and(
            eq(conceptsTable.userId, userId),
            isNull(reviewScheduleTable.id)
          )
        )
      return rows.map((r) => r.id)
    }

    if (status === 'overdue') {
      const rows = await db
        .select({ conceptId: reviewScheduleTable.conceptId })
        .from(reviewScheduleTable)
        .where(
          and(
            eq(reviewScheduleTable.userId, userId),
            lt(reviewScheduleTable.nextReviewAt, startOfDay)
          )
        )
      return rows.map((r) => r.conceptId)
    }

    if (status === 'due-today') {
      const rows = await db
        .select({ conceptId: reviewScheduleTable.conceptId })
        .from(reviewScheduleTable)
        .where(
          and(
            eq(reviewScheduleTable.userId, userId),
            gte(reviewScheduleTable.nextReviewAt, startOfDay),
            lt(reviewScheduleTable.nextReviewAt, endOfDay)
          )
        )
      return rows.map((r) => r.conceptId)
    }

    // status === 'reviewed' (up to date: next review is after today)
    const rows = await db
      .select({ conceptId: reviewScheduleTable.conceptId })
      .from(reviewScheduleTable)
      .where(
        and(
          eq(reviewScheduleTable.userId, userId),
          gte(reviewScheduleTable.nextReviewAt, endOfDay)
        )
      )
    return rows.map((r) => r.conceptId)
  },

  async getScheduleForConcept(
    conceptId: number,
    userId: number
  ): Promise<ReviewSchedule | undefined> {
    return db.query.reviewScheduleTable.findFirst({
      where: and(
        eq(reviewScheduleTable.conceptId, conceptId),
        eq(reviewScheduleTable.userId, userId)
      ),
    })
  },

  async ensureSchedulesExist(userId: number): Promise<void> {
    // Create review schedules for all concepts that don't have one yet
    await db.execute(sql`
      INSERT INTO review_schedule (concept_id, user_id)
      SELECT c.id, c.user_id
      FROM concepts c
      LEFT JOIN review_schedule rs ON rs.concept_id = c.id
      WHERE c.user_id = ${userId} AND rs.id IS NULL
    `)
  },

  async saveSession(
    userId: number,
    data: {
      mode: string
      totalItems: number
      correctItems: number
      accuracy: number
      durationSeconds?: number | null
    }
  ): Promise<ReviewSession> {
    const result = await db
      .insert(reviewSessionsTable)
      .values({
        userId,
        mode: data.mode,
        totalItems: data.totalItems,
        correctItems: data.correctItems,
        accuracy: data.accuracy,
        durationSeconds: data.durationSeconds ?? null,
      })
      .returning()
    return result[0]!
  },

  /**
   * Append a single rating event to the review log. Non-blocking callers
   * should wrap this in `.catch(...)` — we never want a failed log to take
   * down the main rating path. `sessionId` is optional because it isn't
   * known at the time the handler fires.
   */
  async logReviewEvent(data: {
    userId: number
    conceptId: number
    rating: ReviewRating
    correct: boolean
    sessionId?: number | null
  }): Promise<ReviewEvent> {
    const result = await db
      .insert(reviewEventsTable)
      .values({
        userId: data.userId,
        conceptId: data.conceptId,
        rating: data.rating,
        correct: data.correct ? 1 : 0,
        sessionId: data.sessionId ?? null,
      })
      .returning()
    return result[0]!
  },

  /**
   * Return every logged review event for a given concept belonging to the
   * given user, most recent first. Projected down to the minimum the web
   * history timeline needs — no need to expose internal ids.
   */
  async getReviewHistoryForConcept(
    userId: number,
    conceptId: number
  ): Promise<{ date: Date; rating: ReviewRating; correct: boolean }[]> {
    const rows = await db
      .select({
        createdAt: reviewEventsTable.createdAt,
        rating: reviewEventsTable.rating,
        correct: reviewEventsTable.correct,
      })
      .from(reviewEventsTable)
      .where(
        and(
          eq(reviewEventsTable.userId, userId),
          eq(reviewEventsTable.conceptId, conceptId)
        )
      )
      .orderBy(desc(reviewEventsTable.createdAt))

    return rows.map((r) => ({
      date: r.createdAt,
      rating: r.rating as ReviewRating,
      correct: r.correct === 1,
    }))
  },

  async getSessionHistory(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<{ sessions: ReviewSession[]; total: number }> {
    const [sessions, countResult] = await Promise.all([
      db
        .select()
        .from(reviewSessionsTable)
        .where(eq(reviewSessionsTable.userId, userId))
        .orderBy(desc(reviewSessionsTable.completedAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviewSessionsTable)
        .where(eq(reviewSessionsTable.userId, userId)),
    ])

    return {
      sessions,
      total: countResult[0]?.count ?? 0,
    }
  },
}

export default reviewData
