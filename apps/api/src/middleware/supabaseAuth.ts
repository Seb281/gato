import type { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseSecretKey)

/**
 * Middleware that requires authentication.
 * Returns 401 if user is not authenticated.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Missing Authorization header',
    })
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    })
  }

  // Attach user to request for downstream use
  ;(request as any).user = user
}

/**
 * Middleware that optionally authenticates.
 * Attaches user to request if valid token present, otherwise continues without user.
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader) return

  const token = authHeader.replace('Bearer ', '')
  const { data: { user } } = await supabase.auth.getUser(token)

  if (user) {
    ;(request as any).user = user
  }
}

/**
 * Get the authenticated user's email from Supabase.
 */
export async function getAuthenticatedUserEmail(
  request: FastifyRequest
): Promise<string | null> {
  const user = (request as any).user
  return user?.email ?? null
}

/**
 * Get the authenticated user's Supabase ID.
 */
export function getAuthenticatedUserId(request: FastifyRequest): string | null {
  const user = (request as any).user
  return user?.id ?? null
}
