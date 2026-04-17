import { z } from 'zod'

export const TranslationsQuerySchema = z.object({
  language: z.string().min(1),
  version: z.string().min(1),
})

/** Union: English returns `{translations: null, isDefault: true}`; other langs return a key→value record. */
export const TranslationsResponseSchema = z.union([
  z.object({ translations: z.null(), isDefault: z.literal(true) }),
  z.object({ translations: z.record(z.string(), z.string()) }),
])
