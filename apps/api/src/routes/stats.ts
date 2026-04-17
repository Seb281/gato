import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  requireAuth,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import { usersData } from '../data/usersData.ts'
import statsData from '../data/statsData.ts'
import {
  OverviewStatsResponseSchema,
  ActivityQuerySchema,
  ActivityResponseSchema,
} from '../schemas/stats.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

export async function statsRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  // GET /stats/overview
  fastify.get('/stats/overview', {
    schema: {
      tags: ['stats'],
      summary: 'Aggregate stats for the dashboard header',
      security: [{ bearerAuth: [] }],
      response: {
        200: OverviewStatsResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({
          totalConcepts: 0,
          currentStreak: 0,
          longestStreak: 0,
          avgAccuracy: 0,
          conceptsByState: {},
          streakFreezes: 0,
          freezesUsed: 0,
          dailyGoal: 10,
          todayReviews: 0,
          todayGoalMet: false,
        })
      }
      const stats = await statsData.getOverviewStats(user.id)
      return reply.send(stats)
    } catch (error) {
      request.log.error(error, 'Failed to retrieve overview stats')
      return reply.code(500).send({ error: 'Failed to retrieve overview stats' })
    }
  })

  // GET /stats/activity
  fastify.get('/stats/activity', {
    schema: {
      tags: ['stats'],
      summary: 'Per-day activity history',
      security: [{ bearerAuth: [] }],
      querystring: ActivityQuerySchema,
      response: {
        200: ActivityResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) return reply.send({ activity: [] })
      const days = request.query.days ?? 90
      const activity = await statsData.getActivityHistory(user.id, days)
      return reply.send({ activity })
    } catch (error) {
      request.log.error(error, 'Failed to retrieve activity history')
      return reply.code(500).send({ error: 'Failed to retrieve activity history' })
    }
  })
}
