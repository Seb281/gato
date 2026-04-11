/**
 * HTTP surface for the sentence-builder quiz mode.
 *
 * Two endpoints, both auth-gated and scoped by the authenticated user:
 *   POST /review/sentence-builder/generate   — mint a new challenge
 *   POST /review/sentence-builder/validate   — score a submitted ordering
 *
 * No DB writes live here — challenges are held in-memory by
 * {@link ./controllers/sentenceBuilderController.ts}. Logging the rating
 * after a validated submission is still the web client's responsibility
 * and flows through the existing POST /review/:conceptId/result handler,
 * so sentence-builder sessions count toward the same session stats as
 * every other quiz mode.
 */

import type {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyRequest,
  FastifyReply,
} from 'fastify'
import {
  requireAuth,
  getAuthenticatedUserId,
  getAuthenticatedUserEmail,
} from '../middleware/supabaseAuth.ts'
import { usersData } from '../data/usersData.ts'
import {
  generateSentenceChallenge,
  validateSentenceAnswer,
} from '../controllers/sentenceBuilderController.ts'

type GenerateBody = {
  conceptId: number
}

type ValidateBody = {
  challengeId: string
  ordering: string[]
}

export async function sentenceBuilderRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.post<{ Body: GenerateBody }>(
    '/review/sentence-builder/generate',
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Body: GenerateBody }>,
      reply: FastifyReply
    ) => {
      const conceptId = Number(request.body?.conceptId)
      if (!Number.isFinite(conceptId) || conceptId <= 0) {
        return reply.code(400).send({ error: 'conceptId must be a positive integer' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      const userEmail = await getAuthenticatedUserEmail(request)
      if (!supabaseId || !userEmail) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const user = await usersData.retrieveUserBySupabaseId(supabaseId)
        if (!user) {
          return reply.code(401).send({ error: 'User not found' })
        }

        const challenge = await generateSentenceChallenge({
          conceptId,
          userId: user.id,
          userEmail,
        })
        return reply.send({ challenge })
      } catch (error) {
        request.log.error(error, 'Failed to generate sentence challenge')
        return reply.code(500).send({ error: 'Failed to generate sentence challenge' })
      }
    }
  )

  fastify.post<{ Body: ValidateBody }>(
    '/review/sentence-builder/validate',
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Body: ValidateBody }>,
      reply: FastifyReply
    ) => {
      const { challengeId, ordering } = request.body ?? {}
      if (typeof challengeId !== 'string' || !challengeId) {
        return reply.code(400).send({ error: 'challengeId is required' })
      }
      if (!Array.isArray(ordering) || ordering.some((t) => typeof t !== 'string')) {
        return reply.code(400).send({ error: 'ordering must be an array of strings' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const user = await usersData.retrieveUserBySupabaseId(supabaseId)
        if (!user) {
          return reply.code(401).send({ error: 'User not found' })
        }

        const result = validateSentenceAnswer({
          challengeId,
          userOrdering: ordering,
          userId: user.id,
        })

        if (!result.cached) {
          // Challenge expired or never existed — let the client regenerate
          // instead of silently scoring a stale submission.
          return reply.code(410).send({ error: 'Challenge expired' })
        }

        return reply.send({
          correct: result.correct,
          correctOrdering: result.correctOrdering,
          conceptId: result.conceptId,
        })
      } catch (error) {
        request.log.error(error, 'Failed to validate sentence answer')
        return reply.code(500).send({ error: 'Failed to validate sentence answer' })
      }
    }
  )
}
