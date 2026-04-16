import { z } from 'zod'

/** Concept state machine — must stay in sync with db/schema.ts conceptsTable.state enum. */
export const ConceptStateSchema = z.enum(['new', 'learning', 'familiar', 'mastered'])

/** Per-concept spaced-repetition schedule — returned alongside concepts in review endpoints. */
export const ReviewScheduleSchema = z.object({
  easeFactor: z.number(),
  interval: z.number().int(),
  repetitions: z.number().int(),
  // DB returns Date objects; JSON.stringify serialises them to ISO strings at the wire layer.
  nextReviewAt: z.union([z.string().datetime(), z.date()]).nullable(),
  lastReviewedAt: z.union([z.string().datetime(), z.date()]).nullable(),
  totalReviews: z.number().int(),
  correctReviews: z.number().int(),
}).meta({ id: 'ReviewSchedule' })

/**
 * Saved vocabulary concept — mirror of conceptsTable columns consumed by the API.
 * Uses passthrough() so extra DB columns (e.g. updatedAt) are accepted by TS without
 * causing reply.send() type errors; the pass-through serialiser emits them as-is.
 */
export const ConceptSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  concept: z.string(),
  translation: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  state: ConceptStateSchema,
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
  // DB returns Date; JSON.stringify serialises to ISO string at the wire layer.
  createdAt: z.union([z.string().datetime(), z.date()]),
}).passthrough().meta({ id: 'Concept' })

/** Concept with its current review schedule attached (review endpoints include this). */
export const ConceptWithScheduleSchema = ConceptSchema.extend({
  schedule: ReviewScheduleSchema,
}).meta({ id: 'ConceptWithSchedule' })
