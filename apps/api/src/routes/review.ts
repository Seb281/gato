import { z } from 'zod'
import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  requireAuth,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import { usersData } from '../data/usersData.ts'
import reviewData, { numericQualityToRating } from '../data/reviewData.ts'
import type { ReviewRating } from '../data/reviewData.ts'
import conceptsData from '../data/conceptsData.ts'
import { sm2, QUALITY_MAP } from '../utils/sm2.ts'
import type { QualityLabel } from '../utils/sm2.ts'
import statsData from '../data/statsData.ts'
import {
  DueQuerySchema,
  DueResponseSchema,
  DueCountResponseSchema,
  ConceptIdParamSchema,
  ReviewResultBodySchema,
  ReviewResultResponseSchema,
  ReviewHistoryResponseSchema,
  ReviewStatsResponseSchema,
  QuizQuerySchema,
  QuizResponseSchema,
  SessionBodySchema,
  SessionPostResponseSchema,
  SessionQuerySchema,
  SessionHistoryResponseSchema,
} from '../schemas/review.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

export async function reviewRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  // GET /review/due
  fastify.get('/review/due', {
    schema: {
      tags: ['review'],
      summary: 'Get concepts due for review',
      security: [{ bearerAuth: [] }],
      querystring: DueQuerySchema,
      response: {
        200: z.union([DueResponseSchema, DueCountResponseSchema]),
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ concepts: [], dueCount: 0 })
      }

      await reviewData.ensureSchedulesExist(user.id)

      if (request.query.countOnly === 'true') {
        const dueCount = await reviewData.getDueCount(user.id)
        return reply.send({ dueCount })
      }

      const limit = request.query.limit ?? 20
      const concepts = await reviewData.getDueConcepts(user.id, limit)
      const dueCount = await reviewData.getDueCount(user.id)

      // Pass-through serialiser (JSON.stringify) converts Date fields to ISO strings at the wire
      // layer; the TS types can't reconcile DB Date objects with the Zod schema's string | Date.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return reply.send({ concepts, dueCount } as any)
    } catch (error) {
      request.log.error(error, 'Failed to retrieve due items')
      return reply.code(500).send({ error: 'Failed to retrieve due items' })
    }
  })

  // POST /review/:conceptId/result
  fastify.post('/review/:conceptId/result', {
    schema: {
      tags: ['review'],
      summary: 'Record a review result and advance the SM-2 schedule',
      security: [{ bearerAuth: [] }],
      params: ConceptIdParamSchema,
      body: ReviewResultBodySchema,
      response: {
        200: ReviewResultResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { conceptId } = request.params
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      let quality: number
      let rating: ReviewRating
      const rawQuality = request.body.quality
      if (typeof rawQuality === 'string' && rawQuality in QUALITY_MAP) {
        rating = rawQuality as ReviewRating
        quality = QUALITY_MAP[rawQuality as QualityLabel]
      } else {
        // Must be number (zod already constrained it to 0..5).
        quality = rawQuality as number
        rating = numericQualityToRating(quality)
      }

      const schedule = await reviewData.getOrCreateSchedule(conceptId, user.id)

      const result = sm2({
        quality,
        easeFactor: schedule.easeFactor,
        interval: schedule.interval,
        repetitions: schedule.repetitions,
      })

      await reviewData.updateSchedule(schedule.id, {
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: new Date(),
        totalReviews: schedule.totalReviews + 1,
        correctReviews: schedule.correctReviews + (quality >= 3 ? 1 : 0),
      })

      await conceptsData.updateConcept(conceptId, user.id, {
        state: result.conceptState,
      })

      statsData.updateDailyActivity(user.id, 'reviewsCompleted').catch(console.error)
      if (quality >= 3) {
        statsData.updateDailyActivity(user.id, 'correctReviews').catch(console.error)
      }

      reviewData
        .logReviewEvent({
          userId: user.id,
          conceptId,
          rating,
          correct: quality >= 3,
        })
        .catch((err) => request.log.error(err, 'Failed to log review event'))

      return reply.send({
        message: 'Review recorded',
        nextReviewAt: result.nextReviewAt,
        interval: result.interval,
        conceptState: result.conceptState,
      })
    } catch (error) {
      request.log.error(error, 'Failed to record review result')
      return reply.code(500).send({ error: 'Failed to record review result' })
    }
  })

  // GET /review/history/:conceptId
  fastify.get('/review/history/:conceptId', {
    schema: {
      tags: ['review'],
      summary: 'Per-concept rating timeline',
      security: [{ bearerAuth: [] }],
      params: ConceptIdParamSchema,
      response: {
        200: ReviewHistoryResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { conceptId } = request.params
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ history: [] })
      }

      const history = await reviewData.getReviewHistoryForConcept(user.id, conceptId)
      return reply.send({ history })
    } catch (error) {
      request.log.error(error, 'Failed to retrieve review history')
      return reply.code(500).send({ error: 'Failed to retrieve review history' })
    }
  })

  // GET /review/stats
  fastify.get('/review/stats', {
    schema: {
      tags: ['review'],
      summary: 'Review statistics summary',
      security: [{ bearerAuth: [] }],
      response: {
        200: ReviewStatsResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ totalReviewed: 0, dueNow: 0, avgAccuracy: 0 })
      }

      const stats = await reviewData.getReviewStats(user.id)
      return reply.send(stats)
    } catch (error) {
      request.log.error(error, 'Failed to retrieve review stats')
      return reply.code(500).send({ error: 'Failed to retrieve review stats' })
    }
  })

  // GET /quiz/generate
  fastify.get('/quiz/generate', {
    schema: {
      tags: ['quiz'],
      summary: 'Generate quiz questions from due concepts',
      security: [{ bearerAuth: [] }],
      querystring: QuizQuerySchema,
      response: {
        200: QuizResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ questions: [] })
      }

      await reviewData.ensureSchedulesExist(user.id)
      const count = request.query.count ?? 10
      const type = request.query.type ?? 'flashcard'

      if (type === 'contextual-recall') {
        let dueConcepts = await reviewData.getDueConceptsWithContext(user.id, count)
        if (dueConcepts.length === 0) dueConcepts = await reviewData.getDueConcepts(user.id, count)
        if (dueConcepts.length === 0) dueConcepts = await reviewData.getAnyConcepts(user.id, count)
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

      let dueConcepts = await reviewData.getDueConcepts(user.id, count)
      if (dueConcepts.length === 0) dueConcepts = await reviewData.getAnyConcepts(user.id, count)

      if (type === 'multiple-choice') {
        const questions = await Promise.all(
          dueConcepts.map(async (concept) => {
            const distractors = await reviewData.getRandomDistractors(user.id, concept.id, 3)
            const options = [concept.translation, ...distractors].sort(() => Math.random() - 0.5)
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
          }),
        )
        return reply.send({ questions })
      }

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
    } catch (error) {
      request.log.error(error, 'Failed to generate quiz')
      return reply.code(500).send({ error: 'Failed to generate quiz' })
    }
  })

  // POST /review/sessions
  fastify.post('/review/sessions', {
    schema: {
      tags: ['review'],
      summary: 'Save a completed review session',
      security: [{ bearerAuth: [] }],
      body: SessionBodySchema,
      response: {
        200: SessionPostResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) {
      return reply.code(401).send({ error: 'User not found' })
    }

    const { mode, totalItems, correctItems, accuracy, durationSeconds } = request.body

    try {
      const session = await reviewData.saveSession(user.id, {
        mode,
        totalItems,
        correctItems,
        accuracy,
        durationSeconds: durationSeconds ?? null,
      })

      return reply.send({ message: 'Session saved', session })
    } catch (error) {
      request.log.error(error, 'Failed to save review session')
      return reply.code(500).send({ error: 'Failed to save review session' })
    }
  })

  // GET /review/sessions
  fastify.get('/review/sessions', {
    schema: {
      tags: ['review'],
      summary: 'Paginated review-session history',
      security: [{ bearerAuth: [] }],
      querystring: SessionQuerySchema,
      response: {
        200: SessionHistoryResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ sessions: [], total: 0 })
      }

      const limit = request.query.limit ?? 20
      const offset = request.query.offset ?? 0

      const result = await reviewData.getSessionHistory(user.id, limit, offset)
      return reply.send(result)
    } catch (error) {
      request.log.error(error, 'Failed to retrieve session history')
      return reply.code(500).send({ error: 'Failed to retrieve session history' })
    }
  })
}
