import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { translate } from '../controllers/translationController.ts'
import {
  requireAuth,
  getAuthenticatedUserEmail,
  getAuthenticatedUserId,
  clerkClient,
} from '../middleware/clerkAuth.ts'
import conceptsData from '../data/conceptsData.ts'
import { usersData, userContextData } from '../data/usersData.ts'

type SaveConceptBody = {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
}

type UserSettingsBody = {
  targetLanguage: string | null
  personalContext: string | null
  customApiKey?: string | null
  preferredProvider?: string | null
}

export async function extensionRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // Public endpoint - no auth required
  fastify.post('/translation', translate)

  // Protected endpoint - save a concept
  fastify.post<{ Body: SaveConceptBody }>(
    '/saved-concepts',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: SaveConceptBody }>, reply: FastifyReply) => {
      const userId = getAuthenticatedUserId(request)
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      // Get user email from Clerk
      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      // Get Clerk user info for name
      const clerkUser = await clerkClient.users.getUser(userId)

      // Find or create user in database
      const name = clerkUser.firstName ?? clerkUser.username
      const user = await usersData.findOrCreateUser({
        clerkId: userId,
        email,
        ...(name && { name }),
      })

      const { concept, translation, sourceLanguage, targetLanguage } = request.body

      if (!concept || !translation || !sourceLanguage || !targetLanguage) {
        return reply.code(400).send({
          error: 'Missing required fields: concept, translation, sourceLanguage, targetLanguage',
        })
      }

      const savedConcept = await conceptsData.saveNewConcept({
        userId: user.id,
        concept,
        translation,
        sourceLanguage,
        targetLanguage,
      })

      return reply.code(201).send({
        message: 'Concept saved',
        concept: savedConcept[0],
      })
    }
  )

  // Protected endpoint - get saved concepts
  fastify.get(
    '/saved-concepts',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      const concepts = await conceptsData.retrieveUserConcepts(email)

      return reply.send({
        message: 'Concepts retrieved',
        concepts,
      })
    }
  )

  // Protected endpoint - delete a concept
  fastify.delete<{ Params: { id: string } }>(
    '/saved-concepts/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const conceptId = parseInt(request.params.id, 10)

      if (isNaN(conceptId)) {
        return reply.code(400).send({ error: 'Invalid concept ID' })
      }

      const deletedConcept = await conceptsData.deleteConcept(conceptId)

      if (deletedConcept.length === 0) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      return reply.send({
        message: 'Concept deleted',
        concept: deletedConcept[0],
      })
    }
  )

  // Protected endpoint - get user settings
  fastify.get(
    '/user/settings',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      const settings = await userContextData.retrieveUserContext(email)

      // Mask API key for security
      let maskedKey = null
      if (settings.customApiKey) {
        const key = settings.customApiKey
        if (key.length > 8) {
          maskedKey = `${key.slice(0, 3)}...${key.slice(-4)}`
        } else {
          maskedKey = '***'
        }
      }

      return reply.send({
        targetLanguage: settings.targetLanguage,
        personalContext: settings.context,
        preferredProvider: settings.preferredProvider,
        maskedApiKey: maskedKey,
        hasCustomApiKey: !!settings.customApiKey
      })
    }
  )

  // Protected endpoint - update user settings
  fastify.put<{ Body: UserSettingsBody }>(
    '/user/settings',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: UserSettingsBody }>, reply: FastifyReply) => {
      const userId = getAuthenticatedUserId(request)
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      // Ensure user exists in database
      const clerkUser = await clerkClient.users.getUser(userId)
      const name = clerkUser.firstName ?? clerkUser.username
      await usersData.findOrCreateUser({
        clerkId: userId,
        email,
        ...(name && { name }),
      })

      const { targetLanguage, personalContext, customApiKey, preferredProvider } = request.body

      // If customApiKey is undefined (not sent), we don't update it. 
      // If it is null or empty string, we might want to clear it.
      // But we need to handle "don't change if not provided" vs "clear".
      // Let's retrieve existing to merge if needed, or just trust the body.
      // A better pattern for "Settings" forms is usually sending the whole state.
      // However, for secrets, we often only send if changed.
      
      const currentSettings = await userContextData.retrieveUserContext(email)
      
      let newApiKey = currentSettings.customApiKey
      if (customApiKey !== undefined) {
         newApiKey = customApiKey
      }

      let newProvider = currentSettings.preferredProvider
      if (preferredProvider !== undefined) {
        newProvider = preferredProvider
      }

      const updatedSettings = await userContextData.saveNewContext(
        email,
        personalContext ?? currentSettings.context,
        targetLanguage ?? currentSettings.targetLanguage,
        newApiKey,
        newProvider
      )

      // Mask key for response
      let maskedKey = null
      if (updatedSettings.customApiKey) {
        const key = updatedSettings.customApiKey
        if (key.length > 8) {
          maskedKey = `${key.slice(0, 3)}...${key.slice(-4)}`
        } else {
          maskedKey = '***'
        }
      }

      return reply.send({
        message: 'Settings updated',
        targetLanguage: updatedSettings.targetLanguage,
        personalContext: updatedSettings.context,
        preferredProvider: updatedSettings.preferredProvider,
        maskedApiKey: maskedKey,
        hasCustomApiKey: !!updatedSettings.customApiKey
      })
    }
  )
}
