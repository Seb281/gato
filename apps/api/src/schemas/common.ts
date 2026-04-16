import { z } from 'zod'

/** Standard JSON error payload returned by every handler's failure branch. */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
}).meta({ id: 'ErrorResponse' })

/** A positive integer, coerced from strings when it arrives via path or query. */
export const NumericIdSchema = z.coerce.number().int().positive()

/** Params shape for routes with a single `:id`. */
export const NumericIdParamSchema = z.object({
  id: NumericIdSchema,
}).meta({ id: 'NumericIdParam' })

/** Optional positive integer querystring (limit/offset/page/days/count all follow this). */
export const PositiveIntQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().positive().optional(),
}).meta({ id: 'PositiveIntQuery' })
