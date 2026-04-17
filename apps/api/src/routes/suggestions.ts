/**
 * Vocabulary suggestion routes.
 *
 *   GET /suggestions/word-of-the-day       — deterministic per (user, day)
 *   GET /suggestions/related-to-vocab      — on-demand, uncached
 *
 * Both are auth-gated and shaped so the dashboard card can render with a
 * single fetch. Generation work lives in
 * {@link ../controllers/suggestionsController.ts} — this module is just
 * HTTP wiring.
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
  getOrCreateWordOfTheDay,
  getRelatedSuggestions,
} from '../controllers/suggestionsController.ts'
import {
  WordOfTheDayResponseSchema,
  RelatedSuggestionsQuerySchema,
  RelatedSuggestionsResponseSchema,
} from '../schemas/suggestions.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

export async function suggestionsRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  // GET /suggestions/word-of-the-day
  fastify.get('/suggestions/word-of-the-day', {
    schema: {
      tags: ['suggestions'],
      summary: "Today's suggested vocabulary word",
      security: [{ bearerAuth: [] }],
      response: {
        200: WordOfTheDayResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
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

      const suggestion = await getOrCreateWordOfTheDay({
        userId: user.id,
        userEmail,
      })
      if (!suggestion) {
        return reply.code(404).send({ error: 'No suggestion available' })
      }
      return reply.send({ suggestion })
    } catch (error) {
      request.log.error(error, 'Failed to load word of the day')
      return reply.code(500).send({ error: 'Failed to load word of the day' })
    }
  })

  // GET /suggestions/related-to-vocab
  fastify.get('/suggestions/related-to-vocab', {
    schema: {
      tags: ['suggestions'],
      summary: 'Vocabulary suggestions related to saved concepts',
      security: [{ bearerAuth: [] }],
      querystring: RelatedSuggestionsQuerySchema,
      response: {
        200: RelatedSuggestionsResponseSchema,
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

      const limit = request.query.limit ?? 5
      const suggestions = await getRelatedSuggestions({
        userId: user.id,
        userEmail,
        limit,
      })
      return reply.send({ suggestions })
    } catch (error) {
      request.log.error(error, 'Failed to load related suggestions')
      return reply.code(500).send({ error: 'Failed to load related suggestions' })
    }
  })
}
