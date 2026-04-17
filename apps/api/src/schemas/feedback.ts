import { z } from 'zod'

/**
 * POST /feedback body.
 * `website` is a honeypot — legitimate clients leave it blank and bots fill it.
 * The handler short-circuits to success (200) when `website` is set, so zod
 * cannot require `category`/`message` at the schema level — bots that fill
 * only the honeypot would otherwise 400 and learn the trap. Handler retains
 * a `category`/`message` presence check on the real-submission path.
 */
export const FeedbackBodySchema = z.object({
  category: z.string().min(1).optional(),
  message: z.string().min(1).max(2000).optional(),
  email: z.email().optional(),
  website: z.string().optional(),
}).meta({ id: 'FeedbackBody' })

export const FeedbackResponseSchema = z.object({
  message: z.string(),
})
