import { z } from 'zod'
import { DateTimeSchema } from './common.ts'
import { ConceptSchema, ConceptWithScheduleSchema, ReviewScheduleSchema, ConceptStateSchema } from './concept.ts'

/** Quality rating label — matches QUALITY_MAP keys in utils/sm2.ts. */
export const ReviewRatingSchema = z.enum(['again', 'hard', 'good', 'easy']).meta({ id: 'ReviewRating' })

/** Review result body: either numeric quality (0-5) or a label. */
export const ReviewResultBodySchema = z.object({
  quality: z.union([
    z.number().int().min(0).max(5),
    ReviewRatingSchema,
  ]),
}).meta({ id: 'ReviewResultBody' })

/** Params for /review/:conceptId/result and /review/history/:conceptId. */
export const ConceptIdParamSchema = z.object({
  conceptId: z.coerce.number().int().positive(),
})

/** /review/due querystring. `countOnly` is the string 'true' (matches current handler). */
export const DueQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  countOnly: z.enum(['true', 'false']).optional(),
})

export const DueCountResponseSchema = z.object({
  dueCount: z.number().int(),
})

export const DueResponseSchema = z.object({
  concepts: z.array(ConceptWithScheduleSchema),
  dueCount: z.number().int(),
})

export const ReviewResultResponseSchema = z.object({
  message: z.string(),
  nextReviewAt: DateTimeSchema,
  interval: z.number().int(),
  conceptState: ConceptStateSchema,
}).meta({ id: 'ReviewResultResponse' })

export const ReviewHistoryEntrySchema = z.object({
  date: DateTimeSchema,
  rating: ReviewRatingSchema,
  correct: z.boolean(),
}).meta({ id: 'ReviewHistoryEntry' })

export const ReviewHistoryResponseSchema = z.object({
  history: z.array(ReviewHistoryEntrySchema),
})

export const ReviewStatsResponseSchema = z.object({
  totalReviewed: z.number().int(),
  dueNow: z.number().int(),
  avgAccuracy: z.number(),
}).meta({ id: 'ReviewStats' })

/**
 * /quiz/generate querystring.
 *
 * `type-answer` reuses the flashcard shape — the handler only branches on
 * `multiple-choice` and `contextual-recall`; everything else falls through to
 * a flashcard-style response (the web client computes correctness locally by
 * comparing typed input to `translation`).
 */
export const QuizQuerySchema = z.object({
  type: z.enum(['flashcard', 'multiple-choice', 'type-answer', 'contextual-recall']).optional(),
  count: z.coerce.number().int().positive().max(100).optional(),
})

/** Quiz question shapes per type. Responses use a union. */
const FlashcardQuestionSchema = z.object({
  conceptId: z.number().int(),
  concept: z.string(),
  translation: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  phoneticApproximation: z.string().nullable().optional(),
  commonUsage: z.string().nullable().optional(),
  schedule: ReviewScheduleSchema,
}).meta({ id: 'FlashcardQuestion' })

const MultipleChoiceQuestionSchema = z.object({
  conceptId: z.number().int(),
  concept: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  phoneticApproximation: z.string().nullable().optional(),
  correctAnswer: z.string(),
  options: z.array(z.string()),
  schedule: ReviewScheduleSchema,
}).meta({ id: 'MultipleChoiceQuestion' })

const ContextualRecallQuestionSchema = z.object({
  conceptId: z.number().int(),
  concept: z.string(),
  translation: z.string(),
  contextBefore: z.string().nullable().optional(),
  contextAfter: z.string().nullable().optional(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  phoneticApproximation: z.string().nullable().optional(),
  schedule: ReviewScheduleSchema,
}).meta({ id: 'ContextualRecallQuestion' })

export const QuizResponseSchema = z.object({
  questions: z.array(z.union([
    FlashcardQuestionSchema,
    MultipleChoiceQuestionSchema,
    ContextualRecallQuestionSchema,
  ])),
})

/**
 * /review/sessions — POST body.
 * accuracy is stored as an integer (0-100) in the DB, not a 0-1 decimal.
 */
export const SessionBodySchema = z.object({
  mode: z.string().min(1),
  totalItems: z.number().int().min(0),
  correctItems: z.number().int().min(0),
  accuracy: z.number().min(0).max(100),
  durationSeconds: z.number().int().nullish(),
}).meta({ id: 'ReviewSessionBody' })

export const ReviewSessionSchema = z.object({
  id: z.number().int(),
  userId: z.number().int(),
  mode: z.string(),
  totalItems: z.number().int(),
  correctItems: z.number().int(),
  accuracy: z.number().min(0).max(100),
  durationSeconds: z.number().int().nullable(),
  completedAt: DateTimeSchema,
}).meta({ id: 'ReviewSession' })

export const SessionPostResponseSchema = z.object({
  message: z.string(),
  session: ReviewSessionSchema,
})

/** /review/sessions — GET querystring. */
export const SessionQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

export const SessionHistoryResponseSchema = z.object({
  sessions: z.array(ReviewSessionSchema),
  total: z.number().int(),
})

// Re-exports to keep route imports tidy
export { ConceptSchema, ConceptWithScheduleSchema, ConceptStateSchema, ReviewScheduleSchema }
