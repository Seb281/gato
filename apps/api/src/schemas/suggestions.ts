import { z } from 'zod'

/** Word-of-the-day response — matches PublicWordOfTheDay in suggestionsController.ts. */
export const WordOfTheDaySchema = z.object({
  word: z.string(),
  translation: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  rationale: z.string().nullable(),
  exampleSentence: z.string().nullable(),
  date: z.string(),
}).meta({ id: 'WordOfTheDay' })

export const WordOfTheDayResponseSchema = z.object({
  suggestion: WordOfTheDaySchema,
})

export const RelatedSuggestionSchema = z.object({
  word: z.string(),
  translation: z.string(),
  rationale: z.string(),
  exampleSentence: z.string(),
}).meta({ id: 'RelatedSuggestion' })

export const RelatedSuggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).optional(),
})

export const RelatedSuggestionsResponseSchema = z.object({
  suggestions: z.array(RelatedSuggestionSchema),
})
