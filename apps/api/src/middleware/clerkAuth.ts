import type { FastifyRequest, FastifyReply } from 'fastify'
import { getAuth, createClerkClient } from '@clerk/fastify'

const clerkSecretKey = process.env.CLERK_SECRET_KEY
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY

if (!clerkSecretKey || !clerkPublishableKey) {
  throw new Error('Missing CLERK_SECRET_KEY or CLERK_PUBLISHABLE_KEY')
}

const clerkClient = createClerkClient({
  secretKey: clerkSecretKey,
  publishableKey: clerkPublishableKey,
})

/**
 * Middleware that requires authentication.
 * Returns 401 if user is not authenticated.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const { userId } = getAuth(request)

  if (!userId) {
    return reply.code(401).send({
      error: 'Unauthorized',
      message: 'You must be signed in to access this resource',
    })
  }
}

/**
 * Get the authenticated user's email from Clerk.
 * Returns null if user is not authenticated or has no email.
 */
export async function getAuthenticatedUserEmail(
  request: FastifyRequest
): Promise<string | null> {
  const { userId } = getAuth(request)

  if (!userId) {
    return null
  }

  try {
    const user = await clerkClient.users.getUser(userId)
    return user.emailAddresses[0]?.emailAddress ?? null
  } catch (error) {
    console.error('Failed to get user from Clerk:', error)
    return null
  }
}

/**
 * Get the authenticated user's Clerk ID.
 * Returns null if user is not authenticated.
 */
export function getAuthenticatedUserId(request: FastifyRequest): string | null {
  const { userId } = getAuth(request)
  return userId
}

export { getAuth, clerkClient }
