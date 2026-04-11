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
  getOrCreateWordOfTheDay,
  getRelatedSuggestions,
} from '../controllers/suggestionsController.ts'

type RelatedQuery = {
  limit?: string
}

export async function suggestionsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.get(
    '/suggestions/word-of-the-day',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
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

        const suggestion = await getOrCreateWordOfTheDay({
          userId: user.id,
          userEmail,
        })
        if (!suggestion) {
          // No target language configured and no vocab — client should
          // render the empty state prompting the user to save a word or
          // set a target language in settings.
          return reply.code(404).send({ error: 'No suggestion available' })
        }
        return reply.send({ suggestion })
      } catch (error) {
        request.log.error(error, 'Failed to load word of the day')
        return reply
          .code(500)
          .send({ error: 'Failed to load word of the day' })
      }
    }
  )

  fastify.get<{ Querystring: RelatedQuery }>(
    '/suggestions/related-to-vocab',
    { preHandler: [requireAuth] },
    async (
      request: FastifyRequest<{ Querystring: RelatedQuery }>,
      reply: FastifyReply
    ) => {
      const parsedLimit = Number(request.query?.limit ?? '5')
      const limit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 && parsedLimit <= 20
          ? Math.floor(parsedLimit)
          : 5

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

        const suggestions = await getRelatedSuggestions({
          userId: user.id,
          userEmail,
          limit,
        })
        return reply.send({ suggestions })
      } catch (error) {
        request.log.error(error, 'Failed to load related suggestions')
        return reply
          .code(500)
          .send({ error: 'Failed to load related suggestions' })
      }
    }
  )
}
