import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { extensionRoutes } from './routes/extension.ts'
import { tagRoutes } from './routes/tags.ts'

const PORT = parseInt(process.env.PORT || '3001', 10)

const app = Fastify({
  logger: true,
})

export async function startServer() {
  try {
    // Register CORS
    const allowedOrigins = process.env.ALLOWED_ORIGINS!.split(',').map(o => o.trim())
    await app.register(cors, {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })

    // Register routes
    await app.register(extensionRoutes)
    await app.register(tagRoutes)

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