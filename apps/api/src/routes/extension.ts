import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { generateText } from 'ai'
import { translate, enrichConceptInBackground, resolveModel } from '../controllers/translationController.ts'
import {
  requireAuth,
  getAuthenticatedUserEmail,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import conceptsData from '../data/conceptsData.ts'
import tagsData from '../data/tagsData.ts'
import { usersData, userContextData } from '../data/usersData.ts'

type SaveConceptBody = {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
}

type UpdateConceptBody = {
  translation?: string
  userNotes?: string | null
  exampleSentence?: string | null
  state?: string
}

type ConceptsQuerystring = {
  search?: string
  language?: string
  state?: string
  tags?: string
  sortBy?: 'date' | 'alpha'
  sortOrder?: 'asc' | 'desc'
  page?: string
  limit?: string
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

      // Enrich with rich translation data in background (non-blocking)
      const saved = savedConcept[0]
      if (saved) {
        enrichConceptInBackground(saved.id, concept, sourceLanguage, targetLanguage, email)
      }

      return reply.code(201).send({
        message: 'Concept saved',
        concept: saved,
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

  // Protected endpoint - get distinct language pairs for filter dropdown
  fastify.get(
    '/saved-concepts/languages',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ languages: [] })
      }

      const languages = await conceptsData.getLanguagePairs(user.id)
      return reply.send({ languages })
    }
  )

  // Protected endpoint - get saved concepts with search/filter/sort
  fastify.get<{ Querystring: ConceptsQuerystring }>(
    '/saved-concepts',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Querystring: ConceptsQuerystring }>, reply: FastifyReply) => {
      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ message: 'Concepts retrieved', concepts: [], total: 0 })
      }

      const { search, language, state, tags, sortBy, sortOrder, page, limit } = request.query

      // If tag filter is provided, resolve matching concept IDs first
      let tagConceptIds: number[] | undefined
      if (tags) {
        const tagIds = tags.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
        if (tagIds.length > 0) {
          tagConceptIds = await tagsData.getConceptIdsWithAllTags(tagIds)
          if (tagConceptIds.length === 0) {
            return reply.send({ message: 'Concepts retrieved', concepts: [], total: 0 })
          }
        }
      }

      const result = await conceptsData.searchConcepts(user.id, {
        search,
        language,
        state,
        conceptIds: tagConceptIds,
        sortBy,
        sortOrder,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      })

      // Batch-load tags for returned concepts
      const conceptIds = result.concepts.map((c) => c.id)
      const tagsMap = await tagsData.getTagsForConcepts(conceptIds)

      const conceptsWithTags = result.concepts.map((c) => ({
        ...c,
        tags: tagsMap.get(c.id) ?? [],
      }))

      return reply.send({
        message: 'Concepts retrieved',
        concepts: conceptsWithTags,
        total: result.total,
      })
    }
  )

  // Protected endpoint - update a concept (translation, notes, state)
  fastify.patch<{ Params: { id: string }; Body: UpdateConceptBody }>(
    '/saved-concepts/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateConceptBody }>, reply: FastifyReply) => {
      const conceptId = parseInt(request.params.id, 10)
      if (isNaN(conceptId)) {
        return reply.code(400).send({ error: 'Invalid concept ID' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const { translation, userNotes, exampleSentence, state } = request.body

      const validStates = ['new', 'learning', 'familiar', 'mastered']
      if (state !== undefined && !validStates.includes(state)) {
        return reply.code(400).send({ error: `Invalid state. Must be one of: ${validStates.join(', ')}` })
      }

      // Build fields object with only provided values
      const fields: Record<string, string | null> = {}
      if (translation !== undefined) fields.translation = translation
      if (userNotes !== undefined) fields.userNotes = userNotes
      if (exampleSentence !== undefined) fields.exampleSentence = exampleSentence
      if (state !== undefined) fields.state = state

      if (Object.keys(fields).length === 0) {
        return reply.code(400).send({ error: 'At least one field must be provided' })
      }

      const updated = await conceptsData.updateConcept(conceptId, user.id, fields)
      if (!updated) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      return reply.send({ message: 'Concept updated', concept: updated })
    }
  )

  // Protected endpoint - AI-generated example sentence for a concept
  fastify.post<{ Params: { id: string } }>(
    '/saved-concepts/:id/suggest-example',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const conceptId = parseInt(request.params.id, 10)
      if (isNaN(conceptId)) {
        return reply.code(400).send({ error: 'Invalid concept ID' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const concept = await conceptsData.findConceptById(conceptId, user.id)
      if (!concept) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      const settings = await userContextData.retrieveUserContext(email)
      const model = resolveModel(settings)

      const prompt = `Generate a natural, everyday example sentence using the word/phrase "${concept.concept}" (${concept.sourceLanguage}).
Include the translation in ${concept.targetLanguage}.
Format your response as JSON: { "exampleSentence": "<sentence in ${concept.sourceLanguage}> — <translation in ${concept.targetLanguage}>" }
Keep it simple and practical. Only return the JSON, nothing else.`

      const { text } = await generateText({ model, prompt, temperature: 0.7 })

      let exampleSentence: string
      try {
        const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
        exampleSentence = parsed.exampleSentence
      } catch {
        exampleSentence = text.trim()
      }

      return reply.send({ exampleSentence })
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