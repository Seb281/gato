import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  optionalAuth,
  getAuthenticatedUserEmail,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import { usersData } from '../data/usersData.ts'
import {
  FeedbackBodySchema,
  FeedbackResponseSchema,
} from '../schemas/feedback.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

/**
 * Feedback route — accepts submissions from unauthenticated visitors and
 * authenticated users alike. Uses a honeypot field (`website`) to silently
 * drop bots and forwards the message via Resend when configured.
 */
export async function feedbackRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  fastify.post('/feedback', {
    schema: {
      tags: ['user'],
      summary: 'Submit feedback (unauthenticated OK)',
      body: FeedbackBodySchema,
      response: {
        200: FeedbackResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [optionalAuth],
  }, async (request, reply) => {
      const { category, message, email: bodyEmail, website } = request.body

      // Honeypot — bots fill hidden fields, humans don't
      if (website) {
        return reply.send({ message: 'Feedback submitted. Thank you!' })
      }

      if (!category || !message?.trim()) {
        return reply.code(400).send({ error: 'category and message are required' })
      }

      // Length cap (zod already enforces max(2000), but handler keeps its
      // own check for defensive clarity — same 400 response code.)
      if (message.trim().length > 2000) {
        return reply.code(400).send({ error: 'message must be 2000 characters or less' })
      }

      try {
        // Resolve sender identity — prefer authenticated user, fall back to body email
        let senderName = 'anonymous'
        let senderEmail = bodyEmail || 'no email provided'

        const supabaseId = getAuthenticatedUserId(request)
        if (supabaseId) {
          const user = await usersData.retrieveUserBySupabaseId(supabaseId)
          if (user) {
            senderName = user.name ?? 'unknown'
            senderEmail = (await getAuthenticatedUserEmail(request)) ?? senderEmail
          }
        }

        // Send email notification via Resend
        const resendKey = process.env.RESEND_API_KEY
        if (resendKey) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: 'Gato <feedback@resend.dev>',
              to: 'sebastian.giupana@gmail.com',
              subject: `[From-Gato] Message from ${senderName} <${senderEmail}>`,
              text: `Category: ${category}\nFrom: ${senderName} <${senderEmail}>\n\n${message.trim()}`,
            }),
          }).catch((err) => request.log.error(err, 'Failed to send feedback email'))
        }

        return reply.send({ message: 'Feedback submitted. Thank you!' })
      } catch (error) {
        request.log.error(error, 'Failed to submit feedback')
        return reply.code(500).send({ error: 'Failed to submit feedback' })
      }
    }
  )
}
