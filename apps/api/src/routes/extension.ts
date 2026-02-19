import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { translate } from '../controllers/translationController.ts'
import {
  requireAuth,
  getAuthenticatedUserEmail,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import conceptsData from '../data/conceptsData.ts'
import { usersData, userContextData } from '../data/usersData.ts'

type SaveConceptBody = {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
}

type UpdateConceptBody = {
  translation: string
}

type LookupQuerystring = {
  concept: string
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

      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      // Find or create user in database
      // With Supabase, we already have the user object in the request from middleware
      const userFromAuth = (request as any).user
      const name = userFromAuth.user_metadata?.full_name ?? userFromAuth.user_metadata?.name
      
      const user = await usersData.findOrCreateUser({
        supabaseId: userId,
        email,
        ...(name && { name }),
      })

      const { concept, translation, sourceLanguage, targetLanguage } = request.body

      if (!concept || !translation || !sourceLanguage || !targetLanguage) {
        return reply.code(400).send({
          error: 'Missing required fields: concept, translation, sourceLanguage, targetLanguage',
        })
      }

      const existing = await conceptsData.findExistingConcept(
        user.id,
        concept,
        translation,
        sourceLanguage,
        targetLanguage
      )

      if (existing) {
        return reply.code(409).send({ error: 'Concept already exists', concept: existing })
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

  // Protected endpoint - lookup a concept by text (cache check)
  fastify.get<{ Querystring: LookupQuerystring }>(
    '/saved-concepts/lookup',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Querystring: LookupQuerystring }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { concept, sourceLanguage, targetLanguage } = request.query
      if (!concept || !sourceLanguage || !targetLanguage) {
        return reply.code(400).send({ error: 'Missing required query params: concept, sourceLanguage, targetLanguage' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ found: false })
      }

      const found = await conceptsData.findConceptByText(user.id, concept, sourceLanguage, targetLanguage)

      if (found) {
        return reply.send({ found: true, concept: found })
      }
      return reply.send({ found: false })
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

  // Protected endpoint - update a concept's translation
  fastify.patch<{ Params: { id: string }; Body: UpdateConceptBody }>(
    '/saved-concepts/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateConceptBody }>, reply: FastifyReply) => {
      const conceptId = parseInt(request.params.id, 10)
      if (isNaN(conceptId)) {
        return reply.code(400).send({ error: 'Invalid concept ID' })
      }

      const { translation } = request.body
      if (!translation) {
        return reply.code(400).send({ error: 'Missing required field: translation' })
      }

      const updated = await conceptsData.updateConceptTranslation(conceptId, translation)
      if (!updated) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      return reply.send({ message: 'Concept updated', concept: updated })
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
      const userFromAuth = (request as any).user
      const name = userFromAuth.user_metadata?.full_name ?? userFromAuth.user_metadata?.name
      await usersData.findOrCreateUser({
        supabaseId: userId,
        email,
        ...(name && { name }),
      })

      const { targetLanguage, personalContext, customApiKey, preferredProvider } = request.body
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