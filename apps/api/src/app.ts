import Fastify from 'fastify'
import cors from '@fastify/cors'
import { clerkPlugin } from '@clerk/fastify'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { extensionRoutes } from './routes/extension.ts'

const PORT = parseInt(process.env.PORT || '3001', 10)

const app = Fastify({
  logger: true,
})

const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY
const clerkSecretKey = process.env.CLERK_SECRET_KEY

if (!clerkPublishableKey || !clerkSecretKey) {
  console.error('Missing CLERK_PUBLISHABLE_KEY or CLERK_SECRET_KEY')
  process.exit(1)
}

export async function startServer() {
  try {
    // Register CORS
    await app.register(cors, {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })

    // Register Clerk plugin for JWT verification
    await app.register(clerkPlugin, {
      publishableKey: clerkPublishableKey!,
      secretKey: clerkSecretKey!,
    })

    // Register routes
    await app.register(extensionRoutes)

    // Start server
    await app.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`🧠 Server is running on http://localhost:${PORT}`)

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
