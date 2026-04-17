import type { FastifyInstance } from 'fastify'
import type { ZodType } from 'zod'

/**
 * Attaches an onSend hook that validates outgoing JSON payloads against the
 * zod schema declared in `schema.response[statusCode]` on the route.
 *
 * Behavior:
 * - By default: on validation failure, log a warning and send the payload
 *   unchanged. Prod keeps working even if the handler drifts from the spec.
 * - When `process.env.RESPONSE_VALIDATION === 'strict'`: throw on failure.
 *   Fastify's error handler turns this into a 500. Used in CI to catch drift.
 *
 * Non-JSON payloads (html, plain text, binary) are ignored — some plugins
 * like @fastify/rate-limit emit plaintext error bodies.
 */
export function registerResponseValidation(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply, payload) => {
    const routeSchema = (request.routeOptions as any)?.schema?.response?.[reply.statusCode] as
      | ZodType
      | undefined
    if (!routeSchema || typeof payload !== 'string') return payload

    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      return payload
    }

    const result = routeSchema.safeParse(parsed)
    if (result.success) return payload

    const strict = process.env.RESPONSE_VALIDATION === 'strict'
    const context = {
      url: request.url,
      method: request.method,
      status: reply.statusCode,
      issues: result.error.issues,
    }

    if (strict) {
      throw new Error(
        `Response shape drift at ${request.method} ${request.url}: ${JSON.stringify(result.error.issues)}`,
      )
    }

    request.log.warn(context, 'Response shape drifted from declared schema')
    return payload
  })
}
