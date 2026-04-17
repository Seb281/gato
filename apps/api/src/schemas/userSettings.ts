import { z } from 'zod'

/** GET /user/settings response — mirror of the fields the extension/web UI display. */
export const UserSettingsResponseSchema = z.object({
  name: z.string().nullable(),
  targetLanguage: z.string().nullable(),
  personalContext: z.string().nullable(),
  preferredProvider: z.string().nullable(),
  maskedApiKey: z.string().nullable(),
  hasCustomApiKey: z.boolean(),
  dailyGoal: z.number().int(),
  theme: z.string().nullable(),
  displayLanguage: z.string().nullable(),
  streakFreezes: z.number().int(),
}).meta({ id: 'UserSettings' })

/**
 * PUT /user/settings body. Undefined = leave untouched; null = clear.
 *
 * `preferredProvider` is enumerated against the BYOK providers supported by
 * `config/models.ts` — callers sending anything else get a 400.
 */
export const UpdateUserSettingsBodySchema = z.object({
  name: z.string().nullish(),
  targetLanguage: z.string().nullish(),
  personalContext: z.string().nullish(),
  customApiKey: z.string().nullish(),
  preferredProvider: z.enum(['google', 'openai', 'anthropic', 'mistral']).nullish(),
  dailyGoal: z.number().int().min(1).max(100).optional(),
  theme: z.string().nullish(),
  displayLanguage: z.string().nullish(),
}).meta({ id: 'UpdateUserSettingsBody' })

/** PUT /user/settings response wraps the current settings with a status message. */
export const UpdateUserSettingsResponseSchema = UserSettingsResponseSchema.extend({
  message: z.string(),
})
