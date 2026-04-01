import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import {
  requireAuth,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import { usersData } from '../data/usersData.ts'
import reviewData from '../data/reviewData.ts'
import conceptsData from '../data/conceptsData.ts'
import { sm2, QUALITY_MAP } from '../utils/sm2.ts'
import type { QualityLabel } from '../utils/sm2.ts'
import statsData from '../data/statsData.ts'

type ReviewResultBody = {
  quality: number | QualityLabel
}

type DueQuerystring = {
  limit?: string
  countOnly?: string
}

type QuizQuerystring = {
  type?: 'flashcard' | 'multiple-choice' | 'type-answer' | 'contextual-recall'
  count?: string
}

type SessionBody = {
  mode: string
  totalItems: number
  correctItems: number
  accuracy: number
  durationSeconds?: number | null
}

type SessionQuerystring = {
  limit?: string
  offset?: string
}

export async function reviewRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // GET /review/due — get concepts due for review
  fastify.get<{ Querystring: DueQuerystring }>(
    '/review/due',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Querystring: DueQuerystring }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ concepts: [], dueCount: 0 })
      }

      // Ensure all concepts have schedules
      await reviewData.ensureSchedulesExist(user.id)

      if (request.query.countOnly === 'true') {
        const dueCount = await reviewData.getDueCount(user.id)
        return reply.send({ dueCount })
      }

      const limit = parseInt(request.query.limit ?? '', 10) || 20
      const concepts = await reviewData.getDueConcepts(user.id, limit)
      const dueCount = await reviewData.getDueCount(user.id)

      return reply.send({ concepts, dueCount })
    }
  )

  // POST /review/:conceptId/result — record review result
  fastify.post<{ Params: { conceptId: string }; Body: ReviewResultBody }>(
    '/review/:conceptId/result',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { conceptId: string }; Body: ReviewResultBody }>, reply: FastifyReply) => {
      const conceptId = parseInt(request.params.conceptId, 10)
      if (isNaN(conceptId)) {
        return reply.code(400).send({ error: 'Invalid concept ID' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      // Resolve quality — accept either a number or a label
      let quality: number
      const rawQuality = request.body.quality
      if (typeof rawQuality === 'string' && rawQuality in QUALITY_MAP) {
        quality = QUALITY_MAP[rawQuality as QualityLabel]
      } else if (typeof rawQuality === 'number' && rawQuality >= 0 && rawQuality <= 5) {
        quality = rawQuality
      } else {
        return reply.code(400).send({ error: 'quality must be 0-5 or one of: again, hard, good, easy' })
      }

      const schedule = await reviewData.getOrCreateSchedule(conceptId, user.id)

      const result = sm2({
        quality,
        easeFactor: schedule.easeFactor,
        interval: schedule.interval,
        repetitions: schedule.repetitions,
      })

      // Update the schedule
      await reviewData.updateSchedule(schedule.id, {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: new Date(),
        totalReviews: schedule.totalReviews + 1,
        correctReviews: schedule.correctReviews + (quality >= 3 ? 1 : 0),
      })

      // Auto-transition concept state
      await conceptsData.updateConcept(conceptId, user.id, {
        state: result.conceptState,
      })

      // Track daily activity (non-blocking)
      statsData.updateDailyActivity(user.id, 'reviewsCompleted').catch(console.error)
      if (quality >= 3) {
        statsData.updateDailyActivity(user.id, 'correctReviews').catch(console.error)
      }

      return reply.send({
        message: 'Review recorded',
        nextReviewAt: result.nextReviewAt,
        interval: result.interval,
        conceptState: result.conceptState,
      })
    }
  )

  // GET /review/stats — review statistics
  fastify.get(
    '/review/stats',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ totalReviewed: 0, dueNow: 0, avgAccuracy: 0 })
      }

      const stats = await reviewData.getReviewStats(user.id)
      return reply.send(stats)
    }
  )

  // GET /quiz/generate — generate quiz questions
  fastify.get<{ Querystring: QuizQuerystring }>(
    '/quiz/generate',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Querystring: QuizQuerystring }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ questions: [] })
      }

      // Ensure schedules exist
      await reviewData.ensureSchedulesExist(user.id)

      const count = parseInt(request.query.count ?? '', 10) || 10
      const type = request.query.type ?? 'flashcard'

      // For contextual-recall, fetch concepts with context data; fall back to due, then any
      if (type === 'contextual-recall') {
        let dueConcepts = await reviewData.getDueConceptsWithContext(user.id, count)
        if (dueConcepts.length === 0) {
          dueConcepts = await reviewData.getDueConcepts(user.id, count)
        }
        if (dueConcepts.length === 0) {
          dueConcepts = await reviewData.getAnyConcepts(user.id, count)
        }
        const questions = dueConcepts.map((concept) => ({
          conceptId: concept.id,
          concept: concept.concept,
          translation: concept.translation,
          contextBefore: concept.contextBefore,
          contextAfter: concept.contextAfter,
          sourceLanguage: concept.sourceLanguage,
          targetLanguage: concept.targetLanguage,
          phoneticApproximation: concept.phoneticApproximation,
          schedule: concept.schedule,
        }))
        return reply.send({ questions })
      }

      // Fetch due concepts, falling back to any concepts if none are due
      let dueConcepts = await reviewData.getDueConcepts(user.id, count)
      if (dueConcepts.length === 0) {
        dueConcepts = await reviewData.getAnyConcepts(user.id, count)
      }

      if (type === 'multiple-choice') {
        // For each concept, generate distractors
        const questions = await Promise.all(
          dueConcepts.map(async (concept) => {
            const distractors = await reviewData.getRandomDistractors(
              user.id,
              concept.id,
              3
            )
            // Combine correct answer with distractors and shuffle
            const options = [concept.translation, ...distractors]
              .sort(() => Math.random() - 0.5)

            return {
              conceptId: concept.id,
              concept: concept.concept,
              sourceLanguage: concept.sourceLanguage,
              targetLanguage: concept.targetLanguage,
              phoneticApproximation: concept.phoneticApproximation,
              correctAnswer: concept.translation,
              options,
              schedule: concept.schedule,
            }
          })
        )
        return reply.send({ questions })
      }

      // Flashcard or type-answer — just return concepts with schedule info
      const questions = dueConcepts.map((concept) => ({
        conceptId: concept.id,
        concept: concept.concept,
        translation: concept.translation,
        sourceLanguage: concept.sourceLanguage,
        targetLanguage: concept.targetLanguage,
        phoneticApproximation: concept.phoneticApproximation,
        commonUsage: concept.commonUsage,
        schedule: concept.schedule,
      }))

      return reply.send({ questions })
    }
  )

  // POST /review/sessions — save a completed review session
  fastify.post<{ Body: SessionBody }>(
    '/review/sessions',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: SessionBody }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const { mode, totalItems, correctItems, accuracy, durationSeconds } = request.body

      if (!mode || totalItems == null || correctItems == null || accuracy == null) {
        return reply.code(400).send({ error: 'Missing required fields: mode, totalItems, correctItems, accuracy' })
      }

      const session = await reviewData.saveSession(user.id, {
        mode,
        totalItems,
        correctItems,
        accuracy,
        durationSeconds: durationSeconds ?? null,
      })

      return reply.send({ message: 'Session saved', session })
    }
  )

  // GET /review/sessions — paginated session history
  fastify.get<{ Querystring: SessionQuerystring }>(
    '/review/sessions',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Querystring: SessionQuerystring }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ sessions: [], total: 0 })
      }

      const limit = parseInt(request.query.limit ?? '', 10) || 20
      const offset = parseInt(request.query.offset ?? '', 10) || 0

      const result = await reviewData.getSessionHistory(user.id, limit, offset)
      return reply.send(result)
    }
  )
}
