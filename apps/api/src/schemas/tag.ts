import { z } from 'zod'
import { DateTimeSchema } from './common.ts'

/** Tag domain object — mirrors tagsTable rows returned by data/tagsData.ts. */
export const TagSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  name: z.string(),
  color: z.string().nullable(),
  createdAt: DateTimeSchema,
}).meta({ id: 'Tag' })

export const ListTagsResponseSchema = z.object({
  tags: z.array(TagSchema),
})

export const CreateTagBodySchema = z.object({
  name: z.string().min(1),
  color: z.string().nullish(),
}).meta({ id: 'CreateTagBody' })

export const CreateTagResponseSchema = z.object({
  tag: TagSchema,
})

/** PATCH body: at least one field must be present. */
export const UpdateTagBodySchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().nullish(),
}).refine((body) => body.name !== undefined || body.color !== undefined, {
  message: 'At least one field must be provided',
}).meta({ id: 'UpdateTagBody' })

export const UpdateTagResponseSchema = z.object({
  tag: TagSchema,
})

export const DeleteTagResponseSchema = z.object({
  message: z.string(),
  tag: TagSchema,
})

/** /saved-concepts/:id/tags POST body. */
export const AssignTagBodySchema = z.object({
  tagId: z.number().int().positive(),
}).meta({ id: 'AssignTagBody' })

export const AssignTagResponseSchema = z.object({
  message: z.string(),
})

export const RemoveTagResponseSchema = z.object({
  message: z.string(),
})

/** /saved-concepts/:id/tags/:tagId DELETE params. */
export const TagAssignmentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  tagId: z.coerce.number().int().positive(),
})

/** Params for routes with a single :id. */
export const ConceptIdOnlyParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const TagIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})
