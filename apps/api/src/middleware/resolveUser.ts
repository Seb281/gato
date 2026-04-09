// TODO: Migrate existing routes (extension, tags, review, stats) to use
// this middleware instead of the getAuthenticatedUserId() + retrieveUserBySupabaseId() pattern.

import type { FastifyRequest, FastifyReply } from 'fastify'
import { usersData } from '../data/usersData.ts'
import type { User } from '../db/schema.ts'

/**
 * Augments FastifyRequest with the internal database user.
 * Must run after requireAuth, which attaches the Supabase user.
 */
declare module 'fastify' {
  interface FastifyRequest {
    dbUser: User
  }
}

/**
 * Middleware that resolves the Supabase user (attached by requireAuth)
 * to the internal users table row. Attaches it as request.dbUser.
 * Returns 404 if no matching internal user exists.
 */
export async function resolveUser(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const supabaseUser = (request as any).user
  if (!supabaseUser?.id) {
    return reply.code(401).send({ error: 'Unauthorized', message: 'No authenticated user' })
  }

  const user = await usersData.retrieveUserBySupabaseId(supabaseUser.id)
  if (!user) {
    return reply.code(404).send({ error: 'User not found', message: 'No internal user record for this account' })
  }

  request.dbUser = user
}
