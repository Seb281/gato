import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { registerSwagger } from './plugins/swagger.ts'
import { registerResponseValidation } from './plugins/responseValidation.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { translationRoutes } from './routes/translation.ts'
import { conceptRoutes } from './routes/concepts.ts'
import { userSettingsRoutes } from './routes/userSettings.ts'
import { feedbackRoutes } from './routes/feedback.ts'
import { tagRoutes } from './routes/tags.ts'
import { reviewRoutes } from './routes/review.ts'
import { statsRoutes } from './routes/stats.ts'
import { i18nRoutes } from './routes/i18n.ts'
import { sentenceBuilderRoutes } from './routes/sentenceBuilder.ts'
import { suggestionsRoutes } from './routes/suggestions.ts'

const PORT = parseInt(process.env.PORT || '3001', 10)

export async function buildApp(opts?: { logger?: boolean }): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts?.logger ?? true }).withTypeProvider<ZodTypeProvider>()

  // Request-body/query/params validation via zod schemas on route options.
  app.setValidatorCompiler(validatorCompiler)

  // Pass-through serializer — DO NOT use fastify-type-provider-zod's serializerCompiler here.
  // We intentionally skip response validation via the serializer so response-shape drift
  // never 500s a live request. Response validation is performed warn-only by the onSend
  // hook registered in plugins/responseValidation.ts.
  app.setSerializerCompiler(() => (data) => JSON.stringify(data))

  await registerSwagger(app)
  registerResponseValidation(app)

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (origin.startsWith('chrome-extension://')) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  app.setErrorHandler((error: { statusCode?: number; message: string }, request, reply) => {
    request.log.error(error)
    const statusCode = error.statusCode ?? 500
    reply.code(statusCode).send({
      error: statusCode < 500 ? error.message : 'Internal Server Error',
    })
  })

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'Route not found' })
  })

  await app.register(translationRoutes)
  await app.register(conceptRoutes)
  await app.register(userSettingsRoutes)
  await app.register(feedbackRoutes)
  await app.register(tagRoutes)
  await app.register(reviewRoutes)
  await app.register(sentenceBuilderRoutes)
  await app.register(suggestionsRoutes)
  await app.register(statsRoutes)
  await app.register(i18nRoutes)

  return app
}

export async function startServer() {
  const app = await buildApp()

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    app.log.info(`Server is running on port ${PORT}`)

    const shutdown = async () => {
      await app.close()
      process.exit(0)
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

export default buildApp
