import { z } from 'zod'

export const GenerateBodySchema = z.object({
  conceptId: z.number().int().positive(),
}).meta({ id: 'SentenceBuilderGenerateBody' })

export const PublicChallengeSchema = z.object({
  id: z.string(),
  nativeSentence: z.string(),
  tiles: z.array(z.string()),
}).meta({ id: 'SentenceBuilderChallenge' })

export const GenerateResponseSchema = z.object({
  challenge: PublicChallengeSchema,
})

export const ValidateBodySchema = z.object({
  challengeId: z.string().min(1),
  ordering: z.array(z.string()),
}).meta({ id: 'SentenceBuilderValidateBody' })

export const ValidateResponseSchema = z.object({
  correct: z.boolean(),
  correctOrdering: z.array(z.string()),
  conceptId: z.number().int(),
})
