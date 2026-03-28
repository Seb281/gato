import type { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify'
import {
  requireAuth,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import { usersData } from '../data/usersData.ts'
import tagsData from '../data/tagsData.ts'
import conceptsData from '../data/conceptsData.ts'

type CreateTagBody = {
  name: string
  color?: string
}

type UpdateTagBody = {
  name?: string
  color?: string
}

type AssignTagBody = {
  tagId: number
}

export async function tagRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  // GET /tags — list user's tags
  fastify.get(
    '/tags',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.send({ tags: [] })
      }

      const tags = await tagsData.getUserTags(user.id)
      return reply.send({ tags })
    }
  )

  // POST /tags — create tag
  fastify.post<{ Body: CreateTagBody }>(
    '/tags',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Body: CreateTagBody }>, reply: FastifyReply) => {
      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const { name, color } = request.body
      if (!name || !name.trim()) {
        return reply.code(400).send({ error: 'Tag name is required' })
      }

      try {
        const tag = await tagsData.createTag(user.id, name.trim(), color)
        return reply.code(201).send({ tag })
      } catch (error: any) {
        if (error.code === '23505') {
          return reply.code(409).send({ error: 'Tag with this name already exists' })
        }
        throw error
      }
    }
  )

  // PATCH /tags/:id — update tag
  fastify.patch<{ Params: { id: string }; Body: UpdateTagBody }>(
    '/tags/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateTagBody }>, reply: FastifyReply) => {
      const tagId = parseInt(request.params.id, 10)
      if (isNaN(tagId)) {
        return reply.code(400).send({ error: 'Invalid tag ID' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const { name, color } = request.body
      const fields: { name?: string; color?: string } = {}
      if (name !== undefined) fields.name = name.trim()
      if (color !== undefined) fields.color = color

      if (Object.keys(fields).length === 0) {
        return reply.code(400).send({ error: 'At least one field must be provided' })
      }

      try {
        const updated = await tagsData.updateTag(tagId, user.id, fields)
        if (!updated) {
          return reply.code(404).send({ error: 'Tag not found' })
        }
        return reply.send({ tag: updated })
      } catch (error: any) {
        if (error.code === '23505') {
          return reply.code(409).send({ error: 'Tag with this name already exists' })
        }
        throw error
      }
    }
  )

  // DELETE /tags/:id — delete tag
  fastify.delete<{ Params: { id: string } }>(
    '/tags/:id',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tagId = parseInt(request.params.id, 10)
      if (isNaN(tagId)) {
        return reply.code(400).send({ error: 'Invalid tag ID' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const deleted = await tagsData.deleteTag(tagId, user.id)
      if (!deleted) {
        return reply.code(404).send({ error: 'Tag not found' })
      }

      return reply.send({ message: 'Tag deleted', tag: deleted })
    }
  )

  // POST /saved-concepts/:id/tags — assign tag to concept
  fastify.post<{ Params: { id: string }; Body: AssignTagBody }>(
    '/saved-concepts/:id/tags',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: AssignTagBody }>, reply: FastifyReply) => {
      const conceptId = parseInt(request.params.id, 10)
      if (isNaN(conceptId)) {
        return reply.code(400).send({ error: 'Invalid concept ID' })
      }

      const { tagId } = request.body
      if (!tagId) {
        return reply.code(400).send({ error: 'tagId is required' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const concept = await conceptsData.findConceptById(conceptId, user.id)
      if (!concept) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      const tag = await tagsData.findTagById(tagId, user.id)
      if (!tag) {
        return reply.code(404).send({ error: 'Tag not found' })
      }

      await tagsData.addTagToConcept(conceptId, tagId)
      return reply.code(201).send({ message: 'Tag assigned' })
    }
  )

  // DELETE /saved-concepts/:id/tags/:tagId — remove tag from concept
  fastify.delete<{ Params: { id: string; tagId: string } }>(
    '/saved-concepts/:id/tags/:tagId',
    { preHandler: [requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string; tagId: string } }>, reply: FastifyReply) => {
      const conceptId = parseInt(request.params.id, 10)
      const tagId = parseInt(request.params.tagId, 10)

      if (isNaN(conceptId) || isNaN(tagId)) {
        return reply.code(400).send({ error: 'Invalid IDs' })
      }

      const supabaseId = getAuthenticatedUserId(request)
      if (!supabaseId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const user = await usersData.retrieveUserBySupabaseId(supabaseId)
      if (!user) {
        return reply.code(401).send({ error: 'User not found' })
      }

      const concept = await conceptsData.findConceptById(conceptId, user.id)
      if (!concept) {
        return reply.code(404).send({ error: 'Concept not found' })
      }

      const tag = await tagsData.findTagById(tagId, user.id)
      if (!tag) {
        return reply.code(404).send({ error: 'Tag not found' })
      }

      await tagsData.removeTagFromConcept(conceptId, tagId)
      return reply.send({ message: 'Tag removed' })
    }
  )
}
