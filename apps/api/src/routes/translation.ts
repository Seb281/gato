import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { translate, enrich } from '../controllers/translationController.ts'
import {
  TranslationRequestSchema,
  TranslationResponseSchema,
  EnrichmentRequestSchema,
  EnrichmentResponseSchema,
} from '../schemas/translation.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

/**
 * Translation routes — DeepL-first with LLM fallback.
 *
 * Both endpoints are public (no `requireAuth` preHandler). If a bearer token is
 * present, the controller picks it up for BYOK model resolution; if not, the
 * app-level default model is used.
 */
export async function translationRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  fastify.post('/translation', {
    schema: {
      tags: ['translation'],
      summary: 'Translate a word or phrase (DeepL-first, LLM-fallback)',
      body: TranslationRequestSchema,
      response: {
        200: TranslationResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, translate)

  fastify.post('/translation/enrich', {
    schema: {
      tags: ['translation'],
      summary: 'Enrich an already-translated word with linguistic metadata',
      body: EnrichmentRequestSchema,
      response: {
        200: EnrichmentResponseSchema,
        400: ErrorResponseSchema,
        500: ErrorResponseSchema,
        503: ErrorResponseSchema,
      },
    },
  }, enrich)
}
