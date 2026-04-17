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

import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
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
import {
  GenerateBodySchema,
  GenerateResponseSchema,
  ValidateBodySchema,
  ValidateResponseSchema,
} from '../schemas/sentenceBuilder.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

export async function sentenceBuilderRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  // POST /review/sentence-builder/generate
  fastify.post('/review/sentence-builder/generate', {
    schema: {
      tags: ['sentence-builder'],
      summary: 'Generate a sentence-reconstruction challenge for a concept',
      security: [{ bearerAuth: [] }],
      body: GenerateBodySchema,
      response: {
        200: GenerateResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    const userEmail = await getAuthenticatedUserEmail(request)
    if (!supabaseId || !userEmail) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) return reply.code(401).send({ error: 'User not found' })

      const challenge = await generateSentenceChallenge({
        conceptId: request.body.conceptId,
        userId: user.id,
        userEmail,
      })
      return reply.send({ challenge })
    } catch (error) {
      request.log.error(error, 'Failed to generate sentence challenge')
      return reply.code(500).send({ error: 'Failed to generate sentence challenge' })
    }
  })

  // POST /review/sentence-builder/validate
  fastify.post('/review/sentence-builder/validate', {
    schema: {
      tags: ['sentence-builder'],
      summary: "Validate a user's sentence tile ordering",
      security: [{ bearerAuth: [] }],
      body: ValidateBodySchema,
      response: {
        200: ValidateResponseSchema,
        401: ErrorResponseSchema,
        410: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) return reply.code(401).send({ error: 'User not found' })

      const result = validateSentenceAnswer({
        challengeId: request.body.challengeId,
        userOrdering: request.body.ordering,
        userId: user.id,
      })

      if (!result.cached) {
        // Challenge expired or never existed — let the client regenerate
        // instead of silently scoring a stale submission.
        return reply.code(410).send({ error: 'Challenge expired' })
      }

      // Controller return type marks these fields optional on the union;
      // the cached-branch guarantees they are set.
      return reply.send({
        correct: result.correct!,
        correctOrdering: result.correctOrdering!,
        conceptId: result.conceptId!,
      })
    } catch (error) {
      request.log.error(error, 'Failed to validate sentence answer')
      return reply.code(500).send({ error: 'Failed to validate sentence answer' })
    }
  })
}
