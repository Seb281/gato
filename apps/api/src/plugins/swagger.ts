import type { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod'

/**
 * Registers @fastify/swagger (spec emission) and @fastify/swagger-ui (docs UI).
 * In production, the UI hides the "Try it out" button by setting
 * `supportedSubmitMethods: []`, so visitors can read the spec but cannot fire
 * requests from the browser.
 */
export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Gato API',
        version: '1.0.0',
        description: 'Translation, vocabulary, and spaced-repetition API powering the Gato Chrome extension and web dashboard.',
      },
      servers: [
        { url: 'https://api.gato.app', description: 'Production' },
        { url: 'http://localhost:3001', description: 'Local development' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'translation', description: 'Translation and enrichment' },
        { name: 'concepts', description: 'Saved vocabulary CRUD' },
        { name: 'review', description: 'Spaced-repetition review flow' },
        { name: 'quiz', description: 'Quiz question generation' },
        { name: 'tags', description: 'User-defined tags' },
        { name: 'stats', description: 'Usage statistics' },
        { name: 'suggestions', description: 'Word-of-the-day and related suggestions' },
        { name: 'sentence-builder', description: 'Sentence reconstruction challenges' },
        { name: 'i18n', description: 'UI string translation' },
        { name: 'user', description: 'User settings and feedback' },
      ],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  })

  const isProd = process.env.NODE_ENV === 'production'

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      // In prod: empty array hides the "Try it out" button for every method.
      // In dev: undefined leaves the default (all methods allowed).
      supportedSubmitMethods: isProd ? [] : undefined,
    },
    staticCSP: true,
  })
}
