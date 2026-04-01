import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { extensionRoutes } from './routes/extension.ts'
import { tagRoutes } from './routes/tags.ts'
import { reviewRoutes } from './routes/review.ts'
import { statsRoutes } from './routes/stats.ts'
import { i18nRoutes } from './routes/i18n.ts'

const PORT = parseInt(process.env.PORT || '3001', 10)

const app = Fastify({
  logger: true,
})

export async function startServer() {
  try {
    // Register CORS
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
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

    // Global error handlers
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

    // Register routes
    await app.register(extensionRoutes)
    await app.register(tagRoutes)
    await app.register(reviewRoutes)
    await app.register(statsRoutes)
    await app.register(i18nRoutes)

    // Start server
    await app.listen({ port: PORT, host: '0.0.0.0' })
    app.log.info(`Server is running on port ${PORT}`)

    // Graceful shutdown
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

export default app