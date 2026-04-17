import { z } from 'zod'
import { DateTimeSchema, NumericIdSchema } from './common.ts'
import { TagSchema } from './tag.ts'

/**
 * Canonical concept state enum — kept in sync with the four values the app
 * understands. Used for *request* validation (PATCH bodies, bulk updates).
 *
 * Responses use `z.string()` instead because the underlying DB column is a
 * plain `text` field, not a Postgres enum — a row predating a state name
 * change would leak a non-canonical string, and we'd rather document that
 * on the wire than have the response validator throw on legacy data.
 */
export const ConceptStateSchema = z.enum(['new', 'learning', 'familiar', 'mastered'])

/** Per-concept spaced-repetition schedule — returned alongside concepts in review endpoints. */
export const ReviewScheduleSchema = z.object({
  easeFactor: z.number(),
  interval: z.number().int(),
  repetitions: z.number().int(),
  nextReviewAt: DateTimeSchema.nullable(),
  lastReviewedAt: DateTimeSchema.nullable(),
  totalReviews: z.number().int(),
  correctReviews: z.number().int(),
}).meta({ id: 'ReviewSchedule' })

/**
 * Saved vocabulary concept — mirror of conceptsTable columns consumed by the API.
 * Every column shipped to the wire is declared explicitly (no .passthrough()) so
 * the emitted OpenAPI spec is the single source of truth for the response contract.
 */
export const ConceptSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  concept: z.string(),
  translation: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  state: z.string(),
  contextBefore: z.string().nullable().optional(),
  contextAfter: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  userNotes: z.string().nullable().optional(),
  exampleSentence: z.string().nullable().optional(),
  phoneticApproximation: z.string().nullable().optional(),
  commonUsage: z.string().nullable().optional(),
  grammarRules: z.string().nullable().optional(),
  commonness: z.string().nullable().optional(),
  fixedExpression: z.string().nullable().optional(),
  relatedWords: z.string().nullable().optional(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).meta({ id: 'Concept' })

/** Concept with its current review schedule attached (review endpoints include this). */
export const ConceptWithScheduleSchema = ConceptSchema.extend({
  schedule: ReviewScheduleSchema,
}).meta({ id: 'ConceptWithSchedule' })

/**
 * POST /saved-concepts body.
 *
 * Only the four primary fields are required. Optional context (sourceUrl,
 * contextBefore, contextAfter) preserves the surrounding page context for
 * later enrichment passes.
 */
export const SaveConceptBodySchema = z.object({
  concept: z.string().min(1),
  translation: z.string().min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  contextBefore: z.string().nullish(),
  contextAfter: z.string().nullish(),
  sourceUrl: z.string().nullish(),
}).meta({ id: 'SaveConceptBody' })

/** POST /saved-concepts 201 response. */
export const SaveConceptResponseSchema = z.object({
  message: z.string(),
  concept: ConceptSchema.optional(),
})

/** POST /saved-concepts 409 response — returned when an identical concept already exists. */
export const ConceptConflictResponseSchema = z.object({
  error: z.string(),
  concept: ConceptSchema,
})

/**
 * GET /saved-concepts/export query — format defaults to 'json'.
 *
 * Querystring schemas are NOT `.meta()`-tagged (unlike bodies / responses):
 * swagger's `resolveCommonParams` expects the schema to be inlined so it can
 * splay each field into its own OpenAPI parameter, and a `$ref` makes the
 * resolver throw when it walks the path.
 */
export const ExportFormatQuerySchema = z.object({
  format: z.enum(['csv', 'json', 'anki']).optional(),
})

/**
 * Single item inside POST /saved-concepts/import body.
 * `state` is a free string at this layer — the handler validates against
 * the allow-list and reports invalid rows as `errors[]` rather than 400ing.
 */
export const ImportConceptItemSchema = z.object({
  concept: z.string().min(1),
  translation: z.string().min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
  state: z.string().optional(),
  userNotes: z.string().nullish(),
}).meta({ id: 'ImportConceptItem' })

export const ImportConceptsBodySchema = z.object({
  concepts: z.array(ImportConceptItemSchema).min(1),
}).meta({ id: 'ImportConceptsBody' })

export const ImportConceptsResponseSchema = z.object({
  message: z.string(),
  imported: z.number().int(),
  skipped: z.number().int(),
  errors: z.array(z.string()),
  total: z.number().int(),
})

/** GET /saved-concepts/lookup query — see ExportFormatQuerySchema note on why no `.meta()`. */
export const LookupQuerySchema = z.object({
  concept: z.string().min(1),
  sourceLanguage: z.string().min(1),
  targetLanguage: z.string().min(1),
})

/** GET /saved-concepts/lookup response — discriminated by `found`. */
export const LookupResponseSchema = z.union([
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), concept: ConceptSchema }),
])

/** GET /saved-concepts/languages response — array of "src->tgt" strings. */
export const LanguagesResponseSchema = z.object({
  languages: z.array(z.string()),
})

/** DELETE /saved-concepts/bulk body. */
export const BulkDeleteBodySchema = z.object({
  ids: z.array(NumericIdSchema).min(1),
}).meta({ id: 'BulkDeleteBody' })

export const BulkDeleteResponseSchema = z.object({
  message: z.string(),
  deleted: z.number().int(),
})

/**
 * PATCH /saved-concepts/bulk body.
 *
 * `state`, `addTagId`, `removeTagId` are independently optional. Handler
 * 400s when all three are undefined — zod cannot enforce that because
 * `undefined` is allowed on each. Keeping the refinement in the handler
 * avoids coupling error messages to schema internals.
 */
export const BulkUpdateBodySchema = z.object({
  ids: z.array(NumericIdSchema).min(1),
  state: ConceptStateSchema.optional(),
  addTagId: NumericIdSchema.optional(),
  removeTagId: NumericIdSchema.optional(),
}).meta({ id: 'BulkUpdateBody' })

export const BulkUpdateResponseSchema = z.object({
  message: z.string(),
  updated: z.number().int(),
})

/** GET /saved-concepts query — search / filter / sort / paginate. No `.meta()` — querystrings must stay inline. */
export const ConceptsListQuerySchema = z.object({
  search: z.string().optional(),
  language: z.string().optional(),
  state: z.string().optional(),
  tags: z.string().optional(),
  reviewStatus: z.enum(['overdue', 'due-today', 'reviewed', 'new']).optional(),
  sortBy: z.enum(['date', 'alpha']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
})

/** Concept row in the list endpoint — augmented with tag array and next-review ISO string. */
export const ConceptWithTagsSchema = ConceptSchema.extend({
  tags: z.array(TagSchema),
  nextReviewAt: z.string().nullable(),
}).meta({ id: 'ConceptWithTags' })

export const ConceptsListResponseSchema = z.object({
  message: z.string(),
  concepts: z.array(ConceptWithTagsSchema),
  total: z.number().int(),
})

/** GET /saved-concepts/:id response — concept with tags + full schedule (nullable). */
export const ConceptDetailSchema = ConceptSchema.extend({
  tags: z.array(TagSchema),
  schedule: ReviewScheduleSchema.nullable(),
}).meta({ id: 'ConceptDetail' })

export const ConceptDetailResponseSchema = z.object({
  concept: ConceptDetailSchema,
})

/**
 * PATCH /saved-concepts/:id body. At least one field must be provided —
 * handler enforces that (not the schema) so the error message stays
 * consistent with the pre-zod behavior.
 */
export const UpdateConceptBodySchema = z.object({
  translation: z.string().min(1).optional(),
  userNotes: z.string().nullish(),
  exampleSentence: z.string().nullish(),
  state: ConceptStateSchema.optional(),
}).meta({ id: 'UpdateConceptBody' })

export const UpdateConceptResponseSchema = z.object({
  message: z.string(),
  concept: ConceptSchema,
})

/** POST /saved-concepts/:id/suggest-example response — LLM-generated example sentence. */
export const SuggestExampleResponseSchema = z.object({
  exampleSentence: z.string(),
})

/** DELETE /saved-concepts/:id response. */
export const DeleteConceptResponseSchema = z.object({
  message: z.string(),
  concept: ConceptSchema.optional(),
})
