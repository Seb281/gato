import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { generateText } from 'ai'
import { enrichConceptInBackground, resolveModel } from '../controllers/translationController.ts'
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
import { ErrorResponseSchema, NumericIdParamSchema } from '../schemas/common.ts'
import {
  SaveConceptBodySchema,
  SaveConceptResponseSchema,
  ConceptConflictResponseSchema,
  ExportFormatQuerySchema,
  ImportConceptsBodySchema,
  ImportConceptsResponseSchema,
  LookupQuerySchema,
  LookupResponseSchema,
  LanguagesResponseSchema,
  BulkDeleteBodySchema,
  BulkDeleteResponseSchema,
  BulkUpdateBodySchema,
  BulkUpdateResponseSchema,
  ConceptsListQuerySchema,
  ConceptsListResponseSchema,
  ConceptDetailResponseSchema,
  UpdateConceptBodySchema,
  UpdateConceptResponseSchema,
  SuggestExampleResponseSchema,
  DeleteConceptResponseSchema,
} from '../schemas/concept.ts'

/**
 * Saved-concept routes. All endpoints require authentication.
 *
 * Registration order is significant: static children (`/export`, `/lookup`,
 * `/languages`, `/bulk`) must be declared before the `/:id` routes so Fastify's
 * router matches them first.
 */
export async function conceptRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  fastify.post('/saved-concepts', {
    schema: {
      tags: ['concepts'],
      summary: 'Save a new concept for the authenticated user',
      security: [{ bearerAuth: [] }],
      body: SaveConceptBodySchema,
      response: {
        201: SaveConceptResponseSchema,
        401: ErrorResponseSchema,
        409: ConceptConflictResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const userId = getAuthenticatedUserId(request)
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const email = await getAuthenticatedUserEmail(request)
    if (!email) {
      return reply.code(401).send({ error: 'Could not get user email' })
    }

    try {
      const userFromAuth = (request as any).user
      const name = userFromAuth.user_metadata?.full_name ?? userFromAuth.user_metadata?.name

      const user = await usersData.findOrCreateUser({
        supabaseId: userId,
        email,
        ...(name && { name }),
      })

      const { concept, translation, sourceLanguage, targetLanguage, contextBefore, contextAfter, sourceUrl } = request.body

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

      const saved = savedConcept[0]
      if (saved) {
        enrichConceptInBackground(saved.id, concept, sourceLanguage, targetLanguage, email)
        statsData.updateDailyActivity(user.id, 'conceptsAdded').catch(console.error)
      }

      return reply.code(201).send({
        message: 'Concept saved',
        concept: saved,
      })
    } catch (error) {
      request.log.error(error, 'Failed to save concept')
      return reply.code(500).send({ error: 'Failed to save concept' })
    }
  })

  fastify.get('/saved-concepts/export', {
    schema: {
      tags: ['concepts'],
      summary: 'Export all concepts as csv, anki TSV, or json',
      security: [{ bearerAuth: [] }],
      querystring: ExportFormatQuerySchema,
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
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
      } catch (error) {
        request.log.error(error, 'Failed to export concepts')
        return reply.code(500).send({ error: 'Failed to export concepts' })
      }
    }
  )

  fastify.post('/saved-concepts/import', {
    schema: {
      tags: ['concepts'],
      summary: 'Bulk import concepts; invalid rows surface in errors[] rather than 400',
      security: [{ bearerAuth: [] }],
      body: ImportConceptsBodySchema,
      response: {
        200: ImportConceptsResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const email = await getAuthenticatedUserEmail(request)
    if (!email) {
      return reply.code(401).send({ error: 'Could not get user email' })
    }

    try {
      const userFromAuth = (request as any).user
      const name = userFromAuth.user_metadata?.full_name ?? userFromAuth.user_metadata?.name
      const user = await usersData.findOrCreateUser({
        supabaseId,
        email,
        ...(name && { name }),
      })

      const { concepts } = request.body

      const validStates = ['new', 'learning', 'familiar', 'mastered']
      const errors: string[] = []
      const validConcepts: typeof concepts = []

      for (let i = 0; i < concepts.length; i++) {
        const c = concepts[i]!
        if (c.state && !validStates.includes(c.state)) {
          errors.push(`Row ${i + 1}: invalid state "${c.state}"`)
          continue
        }
        validConcepts.push(c)
      }

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
    } catch (error) {
      request.log.error(error, 'Failed to import concepts')
      return reply.code(500).send({ error: 'Failed to import concepts' })
    }
  })

  fastify.get('/saved-concepts/lookup', {
    schema: {
      tags: ['concepts'],
      summary: 'Check whether a concept already exists for this user (cache probe)',
      security: [{ bearerAuth: [] }],
      querystring: LookupQuerySchema,
      response: {
        200: LookupResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { concept, sourceLanguage, targetLanguage } = request.query

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ found: false })
      }

      const found = await conceptsData.findConceptByText(user.id, concept, sourceLanguage, targetLanguage)

      if (found) {
        return reply.send({ found: true, concept: found })
      }
      return reply.send({ found: false })
    } catch (error) {
      request.log.error(error, 'Failed to look up concept')
      return reply.code(500).send({ error: 'Failed to look up concept' })
    }
  })

  fastify.get('/saved-concepts/languages', {
    schema: {
      tags: ['concepts'],
      summary: 'List distinct "src->tgt" language pairs present in the user\'s concepts',
      security: [{ bearerAuth: [] }],
      response: {
        200: LanguagesResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const user = await usersData.retrieveUserBySupabaseId(supabaseId)
        if (!user) {
          return reply.send({ languages: [] })
        }

        const languages = await conceptsData.getLanguagePairs(user.id)
        return reply.send({ languages })
      } catch (error) {
        request.log.error(error, 'Failed to retrieve languages')
        return reply.code(500).send({ error: 'Failed to retrieve languages' })
      }
    }
  )

  fastify.delete('/saved-concepts/bulk', {
    schema: {
      tags: ['concepts'],
      summary: 'Delete multiple concepts by id',
      security: [{ bearerAuth: [] }],
      body: BulkDeleteBodySchema,
      response: {
        200: BulkDeleteResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) {
      return reply.code(401).send({ error: 'User not found' })
    }

    const { ids } = request.body

    try {
      const deleted = await conceptsData.bulkDeleteConcepts(user.id, ids)
      return reply.send({ message: 'Concepts deleted', deleted })
    } catch (error) {
      request.log.error(error, 'Failed to delete concepts')
      return reply.code(500).send({ error: 'Failed to delete concepts' })
    }
  })

  fastify.patch('/saved-concepts/bulk', {
    schema: {
      tags: ['concepts'],
      summary: 'Bulk-update concept state and/or tag membership',
      security: [{ bearerAuth: [] }],
      body: BulkUpdateBodySchema,
      response: {
        200: BulkUpdateResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) {
      return reply.code(401).send({ error: 'User not found' })
    }

    const { ids, state, addTagId, removeTagId } = request.body

    // At-least-one-action check stays in the handler — the schema permits
    // all three action fields to be undefined so the 400 message stays
    // meaningful instead of arriving as a generic zod validation error.
    if (state === undefined && addTagId === undefined && removeTagId === undefined) {
      return reply.code(400).send({ error: 'At least one action (state, addTagId, removeTagId) must be provided' })
    }

    try {
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
    } catch (error) {
      request.log.error(error, 'Failed to update concepts')
      return reply.code(500).send({ error: 'Failed to update concepts' })
    }
  })

  fastify.get('/saved-concepts', {
    schema: {
      tags: ['concepts'],
      summary: 'List concepts with search/filter/sort and per-row tags + nextReviewAt',
      security: [{ bearerAuth: [] }],
      querystring: ConceptsListQuerySchema,
      response: {
        200: ConceptsListResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
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
      } catch (error) {
        request.log.error(error, 'Failed to retrieve concepts')
        return reply.code(500).send({ error: 'Failed to retrieve concepts' })
      }
  })

  fastify.get('/saved-concepts/:id', {
    schema: {
      tags: ['concepts'],
      summary: 'Retrieve a single concept with tags and review schedule',
      security: [{ bearerAuth: [] }],
      params: NumericIdParamSchema,
      response: {
        200: ConceptDetailResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
      const conceptId = request.params.id

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
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
      } catch (error) {
        request.log.error(error, 'Failed to retrieve concept')
        return reply.code(500).send({ error: 'Failed to retrieve concept' })
      }
  })

  fastify.patch('/saved-concepts/:id', {
    schema: {
      tags: ['concepts'],
      summary: 'Patch translation / userNotes / exampleSentence / state on a concept',
      security: [{ bearerAuth: [] }],
      params: NumericIdParamSchema,
      body: UpdateConceptBodySchema,
      response: {
        200: UpdateConceptResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const conceptId = request.params.id

    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) {
      return reply.code(401).send({ error: 'User not found' })
    }

    const { translation, userNotes, exampleSentence, state } = request.body

    // Build fields object with only provided values
    const fields: Record<string, string | null> = {}
    if (translation !== undefined) fields.translation = translation
    if (userNotes !== undefined) fields.userNotes = userNotes ?? null
    if (exampleSentence !== undefined) fields.exampleSentence = exampleSentence ?? null
    if (state !== undefined) fields.state = state

    // At-least-one-field check stays in the handler so the message is stable
    // regardless of which optional field ends up present.
    if (Object.keys(fields).length === 0) {
      return reply.code(400).send({ error: 'At least one field must be provided' })
    }

    try {
      const updated = await conceptsData.updateConcept(conceptId, user.id, fields)
      if (!updated) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      return reply.send({ message: 'Concept updated', concept: updated })
    } catch (error) {
      request.log.error(error, 'Failed to update concept')
      return reply.code(500).send({ error: 'Failed to update concept' })
    }
  })

  fastify.post('/saved-concepts/:id/suggest-example', {
    schema: {
      tags: ['concepts'],
      summary: 'Generate an LLM-authored example sentence for a concept',
      security: [{ bearerAuth: [] }],
      params: NumericIdParamSchema,
      response: {
        200: SuggestExampleResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const conceptId = request.params.id

    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const email = await getAuthenticatedUserEmail(request)
    if (!email) {
      return reply.code(401).send({ error: 'Could not get user email' })
    }

    try {
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
    } catch (error) {
      request.log.error(error, 'Failed to generate example sentence')
      return reply.code(500).send({ error: 'Failed to generate example sentence' })
    }
  })

  fastify.delete('/saved-concepts/:id', {
    schema: {
      tags: ['concepts'],
      summary: 'Delete a concept by id',
      security: [{ bearerAuth: [] }],
      params: NumericIdParamSchema,
      response: {
        200: DeleteConceptResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const conceptId = request.params.id

    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
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
    } catch (error) {
      request.log.error(error, 'Failed to delete concept')
      return reply.code(500).send({ error: 'Failed to delete concept' })
    }
  })
}
