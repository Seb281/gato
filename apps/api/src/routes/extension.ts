import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import { generateText } from 'ai'
import { translate, enrich, enrichConceptInBackground, resolveModel } from '../controllers/translationController.ts'
import {
  requireAuth,
  getAuthenticatedUserEmail,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import conceptsData from '../data/conceptsData.ts'
import tagsData from '../data/tagsData.ts'
import reviewData from '../data/reviewData.ts'
import { usersData, userContextData } from '../data/usersData.ts'
import statsData from '../data/statsData.ts'
import { db } from '../db/index.ts'
import { feedbackTable } from '../db/schema.ts'

type ExportQuerystring = {
  format?: 'csv' | 'json' | 'anki'
}

type ImportConceptItem = {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  state?: string
  userNotes?: string | null
}

type ImportBody = {
  concepts: ImportConceptItem[]
}

type SaveConceptBody = {
  concept: string
  translation: string
  sourceLanguage: string
  targetLanguage: string
  contextBefore?: string
  contextAfter?: string
  sourceUrl?: string
}

type UpdateConceptBody = {
  translation?: string
  userNotes?: string | null
  exampleSentence?: string | null
  state?: string
}

type BulkDeleteBody = {
  ids: number[]
}

type BulkUpdateBody = {
  ids: number[]
  state?: string
  addTagId?: number
  removeTagId?: number
}

type ConceptsQuerystring = {
  search?: string
  language?: string
  state?: string
  tags?: string
  reviewStatus?: 'overdue' | 'due-today' | 'reviewed' | 'new'
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
  dailyGoal?: number
  name?: string | null
  theme?: string | null
  displayLanguage?: string | null
}

export async function extensionRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // Public endpoints - no auth required (but use auth if present)
  fastify.post('/translation', translate)
  fastify.post('/translation/enrich', enrich)

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

      const { concept, translation, sourceLanguage, targetLanguage, contextBefore, contextAfter, sourceUrl } = request.body

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
        ...(contextBefore && { contextBefore }),
        ...(contextAfter && { contextAfter }),
        ...(sourceUrl && { sourceUrl }),
      })

      // Enrich with rich translation data in background (non-blocking)
      const saved = savedConcept[0]
      if (saved) {
        enrichConceptInBackground(saved.id, concept, sourceLanguage, targetLanguage, email)
        // Track daily activity (non-blocking)
        statsData.updateDailyActivity(user.id, 'conceptsAdded').catch(console.error)
      }

      return reply.code(201).send({
        message: 'Concept saved',
        concept: saved,
      })
    }
  )

  // Protected endpoint - export all concepts
  fastify.get<{ Querystring: ExportQuerystring }>(
    '/saved-concepts/export',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Querystring: ExportQuerystring }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(404).send({ error: 'User not found' })
      }

      const concepts = await conceptsData.getAllConceptsForExport(user.id)
      const format = request.query.format ?? 'json'

      if (format === 'csv') {
        const header = 'concept,translation,sourceLanguage,targetLanguage,state,userNotes,createdAt'
        const rows = concepts.map((c) => {
          const escape = (v: string | null | undefined) => {
            if (!v) return ''
            // Wrap in quotes and escape internal quotes
            return `"${v.replace(/"/g, '""')}"`
          }
          return [
            escape(c.concept),
            escape(c.translation),
            escape(c.sourceLanguage),
            escape(c.targetLanguage),
            escape(c.state),
            escape(c.userNotes),
            escape(c.createdAt?.toISOString()),
          ].join(',')
        })
        const csv = [header, ...rows].join('\n')

        return reply
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="vocabulary-export.csv"')
          .send(csv)
      }

      if (format === 'anki') {
        // Anki TSV: front\tback
        const rows = concepts.map((c) => {
          const front = c.concept
          const backParts = [c.translation]
          if (c.phoneticApproximation) backParts.push(`Pronunciation: ${c.phoneticApproximation}`)
          if (c.grammarRules) backParts.push(`Grammar: ${c.grammarRules}`)
          if (c.commonUsage) backParts.push(`Usage: ${c.commonUsage}`)
          if (c.exampleSentence) backParts.push(`Example: ${c.exampleSentence}`)
          const back = backParts.join('<br>')
          // Escape tabs in content
          return `${front.replace(/\t/g, ' ')}\t${back.replace(/\t/g, ' ')}`
        })
        const tsv = rows.join('\n')

        return reply
          .header('Content-Type', 'text/tab-separated-values; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="vocabulary-export.txt"')
          .send(tsv)
      }

      // Default: JSON
      const data = concepts.map((c) => ({
        concept: c.concept,
        translation: c.translation,
        sourceLanguage: c.sourceLanguage,
        targetLanguage: c.targetLanguage,
        state: c.state,
        userNotes: c.userNotes,
        exampleSentence: c.exampleSentence,
        phoneticApproximation: c.phoneticApproximation,
        commonUsage: c.commonUsage,
        grammarRules: c.grammarRules,
        createdAt: c.createdAt?.toISOString(),
      }))

      return reply
        .header('Content-Type', 'application/json; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="vocabulary-export.json"')
        .send(JSON.stringify(data, null, 2))
    }
  )

  // Protected endpoint - import concepts
  fastify.post<{ Body: ImportBody }>(
    '/saved-concepts/import',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: ImportBody }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      const userFromAuth = (request as any).user
      const name = userFromAuth.user_metadata?.full_name ?? userFromAuth.user_metadata?.name
      const user = await usersData.findOrCreateUser({
        supabaseId,
        email,
        ...(name && { name }),
      })

      const { concepts } = request.body
      if (!Array.isArray(concepts) || concepts.length === 0) {
        return reply.code(400).send({ error: 'No concepts provided' })
      }

      const validStates = ['new', 'learning', 'familiar', 'mastered']
      const errors: string[] = []
      const validConcepts: ImportConceptItem[] = []

      for (let i = 0; i < concepts.length; i++) {
        const c = concepts[i]!
        if (!c.concept || !c.translation || !c.sourceLanguage || !c.targetLanguage) {
          errors.push(`Row ${i + 1}: missing required fields (concept, translation, sourceLanguage, targetLanguage)`)
          continue
        }
        if (c.state && !validStates.includes(c.state)) {
          errors.push(`Row ${i + 1}: invalid state "${c.state}"`)
          continue
        }
        validConcepts.push(c)
      }

      // Deduplicate against existing concepts
      let imported = 0
      let skipped = 0
      const toInsert: Array<{
        userId: number
        concept: string
        translation: string
        sourceLanguage: string
        targetLanguage: string
        state: string
        userNotes: string | null
      }> = []

      for (const c of validConcepts) {
        const existing = await conceptsData.findExistingConcept(
          user.id,
          c.concept,
          c.translation,
          c.sourceLanguage,
          c.targetLanguage
        )
        if (existing) {
          skipped++
          continue
        }
        toInsert.push({
          userId: user.id,
          concept: c.concept,
          translation: c.translation,
          sourceLanguage: c.sourceLanguage,
          targetLanguage: c.targetLanguage,
          state: c.state ?? 'new',
          userNotes: c.userNotes ?? null,
        })
      }

      if (toInsert.length > 0) {
        await conceptsData.bulkInsertConcepts(toInsert)
        imported = toInsert.length
      }

      return reply.send({
        message: 'Import complete',
        imported,
        skipped,
        errors,
        total: concepts.length,
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

  // Protected endpoint - bulk delete concepts
  fastify.delete<{ Body: BulkDeleteBody }>(
    '/saved-concepts/bulk',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: BulkDeleteBody }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const { ids } = request.body
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.code(400).send({ error: 'ids array is required and must not be empty' })
      }

      const deleted = await conceptsData.bulkDeleteConcepts(user.id, ids)
      return reply.send({ message: 'Concepts deleted', deleted })
    }
  )

  // Protected endpoint - bulk update concepts (state or tags)
  fastify.patch<{ Body: BulkUpdateBody }>(
    '/saved-concepts/bulk',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: BulkUpdateBody }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const { ids, state, addTagId, removeTagId } = request.body
      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.code(400).send({ error: 'ids array is required and must not be empty' })
      }

      if (state === undefined && addTagId === undefined && removeTagId === undefined) {
        return reply.code(400).send({ error: 'At least one action (state, addTagId, removeTagId) must be provided' })
      }

      const validStates = ['new', 'learning', 'familiar', 'mastered']
      if (state !== undefined && !validStates.includes(state)) {
        return reply.code(400).send({ error: `Invalid state. Must be one of: ${validStates.join(', ')}` })
      }

      let updated = 0

      if (state !== undefined) {
        updated = await conceptsData.bulkUpdateConceptState(user.id, ids, state)
      }

      if (addTagId !== undefined) {
        const tag = await tagsData.findTagById(addTagId, user.id)
        if (!tag) {
          return reply.code(404).send({ error: 'Tag not found' })
        }
        await tagsData.bulkAddTag(ids, addTagId, user.id)
      }

      if (removeTagId !== undefined) {
        const tag = await tagsData.findTagById(removeTagId, user.id)
        if (!tag) {
          return reply.code(404).send({ error: 'Tag not found' })
        }
        await tagsData.bulkRemoveTag(ids, removeTagId, user.id)
      }

      return reply.send({ message: 'Concepts updated', updated })
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

      const { search, language, state, tags, reviewStatus, sortBy, sortOrder, page, limit } = request.query

      // If tag filter is provided, resolve matching concept IDs first
      let filteredConceptIds: number[] | undefined
      if (tags) {
        const tagIds = tags.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
        if (tagIds.length > 0) {
          filteredConceptIds = await tagsData.getConceptIdsWithAllTags(tagIds)
          if (filteredConceptIds.length === 0) {
            return reply.send({ message: 'Concepts retrieved', concepts: [], total: 0 })
          }
        }
      }

      // If review status filter is provided, resolve matching concept IDs
      if (reviewStatus) {
        const validStatuses = ['overdue', 'due-today', 'reviewed', 'new'] as const
        if (validStatuses.includes(reviewStatus as typeof validStatuses[number])) {
          const reviewConceptIds = await reviewData.getConceptIdsByReviewStatus(
            user.id,
            reviewStatus as typeof validStatuses[number]
          )
          if (reviewConceptIds.length === 0) {
            return reply.send({ message: 'Concepts retrieved', concepts: [], total: 0 })
          }
          // Intersect with tag filter if both are present
          if (filteredConceptIds) {
            const reviewSet = new Set(reviewConceptIds)
            filteredConceptIds = filteredConceptIds.filter((id) => reviewSet.has(id))
            if (filteredConceptIds.length === 0) {
              return reply.send({ message: 'Concepts retrieved', concepts: [], total: 0 })
            }
          } else {
            filteredConceptIds = reviewConceptIds
          }
        }
      }

      const result = await conceptsData.searchConcepts(user.id, {
        search,
        language,
        state,
        conceptIds: filteredConceptIds,
        sortBy,
        sortOrder,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
      })

      // Batch-load tags and review schedules for returned concepts
      const conceptIds = result.concepts.map((c) => c.id)
      const [tagsMap, reviewMap] = await Promise.all([
        tagsData.getTagsForConcepts(conceptIds),
        reviewData.getReviewSchedulesForConcepts(conceptIds),
      ])

      const conceptsWithMeta = result.concepts.map((c) => ({
        ...c,
        tags: tagsMap.get(c.id) ?? [],
        nextReviewAt: reviewMap.get(c.id)?.nextReviewAt?.toISOString() ?? null,
      }))

      return reply.send({
        message: 'Concepts retrieved',
        concepts: conceptsWithMeta,
        total: result.total,
      })
    }
  )

  // Protected endpoint - get a single concept with tags and review schedule
  fastify.get<{ Params: { id: string } }>(
    '/saved-concepts/:id',
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

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(404).send({ error: 'User not found' })
      }

      const concept = await conceptsData.findConceptById(conceptId, user.id)
      if (!concept) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      // Get tags for this concept
      const tagsMap = await tagsData.getTagsForConcepts([conceptId])
      const tags = tagsMap.get(conceptId) ?? []

      // Get review schedule if it exists
      const schedule = await reviewData.getScheduleForConcept(conceptId, user.id)

      return reply.send({
        concept: {
          ...concept,
          tags,
          schedule: schedule
            ? {
                easeFactor: schedule.easeFactor,
                interval: schedule.interval,
                repetitions: schedule.repetitions,
                nextReviewAt: schedule.nextReviewAt,
                lastReviewedAt: schedule.lastReviewedAt,
                totalReviews: schedule.totalReviews,
                correctReviews: schedule.correctReviews,
              }
            : null,
        },
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

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const deletedConcept = await conceptsData.deleteConcept(conceptId, user.id)

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

      const supabaseId = getAuthenticatedUserId(request)
      const user = supabaseId ? await usersData.retrieveUserBySupabaseId(supabaseId) : null
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
        name: user?.name ?? null,
        targetLanguage: settings.targetLanguage,
        personalContext: settings.context,
        preferredProvider: settings.preferredProvider,
        maskedApiKey: maskedKey,
        hasCustomApiKey: !!settings.customApiKey,
        dailyGoal: user?.dailyGoal ?? 10,
        theme: user?.theme ?? 'system',
        displayLanguage: user?.displayLanguage ?? 'English',
        streakFreezes: user?.streakFreezes ?? 0,
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
      const user = await usersData.findOrCreateUser({
        supabaseId: userId,
        email,
        ...(name && { name }),
      })

      const { targetLanguage, personalContext, customApiKey, preferredProvider, dailyGoal, name: newName, theme: newTheme, displayLanguage: newDisplayLanguage } = request.body

      // Validate dailyGoal if provided
      if (dailyGoal !== undefined) {
        if (!Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 100) {
          return reply.code(400).send({ error: 'dailyGoal must be an integer between 1 and 100' })
        }
      }

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

      // Update dailyGoal on the user record if provided
      let updatedDailyGoal = user.dailyGoal
      if (dailyGoal !== undefined) {
        await usersData.updateDailyGoal(user.id, dailyGoal)
        updatedDailyGoal = dailyGoal
      }

      // Update name if provided
      let updatedName = user.name
      if (newName !== undefined) {
        await usersData.updateName(user.id, newName)
        updatedName = newName
      }

      // Update theme if provided
      let updatedTheme = user.theme
      if (newTheme !== undefined) {
        await usersData.updateTheme(user.id, newTheme)
        updatedTheme = newTheme
      }

      // Update displayLanguage if provided
      let updatedDisplayLanguage = user.displayLanguage
      if (newDisplayLanguage !== undefined) {
        await usersData.updateDisplayLanguage(user.id, newDisplayLanguage)
        updatedDisplayLanguage = newDisplayLanguage
      }

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
        name: updatedName,
        targetLanguage: updatedSettings.targetLanguage,
        personalContext: updatedSettings.context,
        preferredProvider: updatedSettings.preferredProvider,
        maskedApiKey: maskedKey,
        hasCustomApiKey: !!updatedSettings.customApiKey,
        dailyGoal: updatedDailyGoal,
        theme: updatedTheme,
        displayLanguage: updatedDisplayLanguage ?? 'English',
        streakFreezes: user.streakFreezes,
      })
    }
  )

  // POST /feedback — submit user feedback
  fastify.post<{ Body: { category: string; message: string } }>(
    '/feedback',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: { category: string; message: string } }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const { category, message } = request.body
      if (!category || !message?.trim()) {
        return reply.code(400).send({ error: 'category and message are required' })
      }

      await db.insert(feedbackTable).values({
        userId: user.id,
        category,
        message: message.trim(),
      })

      // Send email notification (non-blocking)
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const email = await getAuthenticatedUserEmail(request)
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: 'Context Translator <feedback@resend.dev>',
            to: 'sebastian.giupana@gmail.com',
            subject: `[Feedback] ${category} from ${email ?? 'unknown'}`,
            text: `Category: ${category}\nFrom: ${email ?? 'unknown'}\n\n${message.trim()}`,
          }),
        }).catch(console.error)
      }

      return reply.send({ message: 'Feedback submitted. Thank you!' })
    }
  )
}