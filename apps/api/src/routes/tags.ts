import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  requireAuth,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import { usersData } from '../data/usersData.ts'
import tagsData from '../data/tagsData.ts'
import conceptsData from '../data/conceptsData.ts'
import {
  ListTagsResponseSchema,
  CreateTagBodySchema,
  CreateTagResponseSchema,
  UpdateTagBodySchema,
  UpdateTagResponseSchema,
  DeleteTagResponseSchema,
  AssignTagBodySchema,
  AssignTagResponseSchema,
  RemoveTagResponseSchema,
  TagAssignmentParamsSchema,
  ConceptIdOnlyParamSchema,
  TagIdParamSchema,
} from '../schemas/tag.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

export async function tagRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  // GET /tags
  fastify.get('/tags', {
    schema: {
      tags: ['tags'],
      summary: 'List the current user\'s tags',
      security: [{ bearerAuth: [] }],
      response: {
        200: ListTagsResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    try {
      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) return reply.send({ tags: [] })
      const tags = await tagsData.getUserTags(user.id)
      return reply.send({ tags })
    } catch (error) {
      request.log.error(error, 'Failed to retrieve tags')
      return reply.code(500).send({ error: 'Failed to retrieve tags' })
    }
  })

  // POST /tags
  fastify.post('/tags', {
    schema: {
      tags: ['tags'],
      summary: 'Create a new tag',
      security: [{ bearerAuth: [] }],
      body: CreateTagBodySchema,
      response: {
        201: CreateTagResponseSchema,
        401: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) return reply.code(401).send({ error: 'User not found' })

    try {
      const tag = await tagsData.createTag(
        user.id,
        request.body.name.trim(),
        request.body.color ?? undefined,
      )
      return reply.code(201).send({ tag })
    } catch (error: any) {
      if (error?.code === '23505') {
        return reply.code(409).send({ error: 'Tag with this name already exists' })
      }
      request.log.error(error, 'Failed to create tag')
      return reply.code(500).send({ error: 'Failed to create tag' })
    }
  })

  // PATCH /tags/:id
  fastify.patch('/tags/:id', {
    schema: {
      tags: ['tags'],
      summary: 'Update a tag',
      security: [{ bearerAuth: [] }],
      params: TagIdParamSchema,
      body: UpdateTagBodySchema,
      response: {
        200: UpdateTagResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        409: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { id: tagId } = request.params
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) return reply.code(401).send({ error: 'User not found' })

    const updates: { name?: string; color?: string } = {}
    if (request.body.name !== undefined) updates.name = request.body.name.trim()
    if (request.body.color !== undefined && request.body.color !== null) {
      updates.color = request.body.color
    }

    try {
      const tag = await tagsData.updateTag(tagId, user.id, updates)
      if (!tag) return reply.code(404).send({ error: 'Tag not found' })
      return reply.send({ tag })
    } catch (error: any) {
      if (error?.code === '23505') {
        return reply.code(409).send({ error: 'Tag with this name already exists' })
      }
      request.log.error(error, 'Failed to update tag')
      return reply.code(500).send({ error: 'Failed to update tag' })
    }
  })

  // DELETE /tags/:id
  fastify.delete('/tags/:id', {
    schema: {
      tags: ['tags'],
      summary: 'Delete a tag',
      security: [{ bearerAuth: [] }],
      params: TagIdParamSchema,
      response: {
        200: DeleteTagResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { id: tagId } = request.params
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) return reply.code(401).send({ error: 'User not found' })

    try {
      const tag = await tagsData.deleteTag(tagId, user.id)
      if (!tag) return reply.code(404).send({ error: 'Tag not found' })
      return reply.send({ message: 'Tag deleted', tag })
    } catch (error) {
      request.log.error(error, 'Failed to delete tag')
      return reply.code(500).send({ error: 'Failed to delete tag' })
    }
  })

  // POST /saved-concepts/:id/tags
  fastify.post('/saved-concepts/:id/tags', {
    schema: {
      tags: ['tags'],
      summary: 'Assign a tag to a concept',
      security: [{ bearerAuth: [] }],
      params: ConceptIdOnlyParamSchema,
      body: AssignTagBodySchema,
      response: {
        201: AssignTagResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { id: conceptId } = request.params
    const { tagId } = request.body
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) return reply.code(401).send({ error: 'User not found' })

    try {
      const concept = await conceptsData.findConceptById(conceptId, user.id)
      if (!concept) return reply.code(404).send({ error: 'Concept not found' })

      const tag = await tagsData.findTagById(tagId, user.id)
      if (!tag) return reply.code(404).send({ error: 'Tag not found' })

      await tagsData.addTagToConcept(conceptId, tagId)
      return reply.code(201).send({ message: 'Tag assigned' })
    } catch (error) {
      request.log.error(error, 'Failed to assign tag')
      return reply.code(500).send({ error: 'Failed to assign tag' })
    }
  })

  // DELETE /saved-concepts/:id/tags/:tagId
  fastify.delete('/saved-concepts/:id/tags/:tagId', {
    schema: {
      tags: ['tags'],
      summary: 'Remove a tag from a concept',
      security: [{ bearerAuth: [] }],
      params: TagAssignmentParamsSchema,
      response: {
        200: RemoveTagResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const { id: conceptId, tagId } = request.params
    const supabaseId = getAuthenticatedUserId(request)
    if (!supabaseId) return reply.code(401).send({ error: 'Unauthorized' })

    const user = await usersData.retrieveUserBySupabaseId(supabaseId)
    if (!user) return reply.code(401).send({ error: 'User not found' })

    try {
      const concept = await conceptsData.findConceptById(conceptId, user.id)
      if (!concept) return reply.code(404).send({ error: 'Concept not found' })

      const tag = await tagsData.findTagById(tagId, user.id)
      if (!tag) return reply.code(404).send({ error: 'Tag not found' })

      await tagsData.removeTagFromConcept(conceptId, tagId)
      return reply.send({ message: 'Tag removed' })
    } catch (error) {
      request.log.error(error, 'Failed to remove tag')
      return reply.code(500).send({ error: 'Failed to remove tag' })
    }
  })
}
