import { z } from 'zod'

/** Standard JSON error payload returned by every handler's failure branch. */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
}).meta({ id: 'ErrorResponse' })

/** A positive integer, coerced from strings when it arrives via path or query. */
export const NumericIdSchema = z.coerce.number().int().positive()

/**
 * Params shape for routes with a single `:id`. Not `.meta()`-tagged — swagger's
 * params emitter expects an inlined object (it splays each property into its
 * own parameter entry), and a `$ref` would make `resolveCommonParams` fall
 * over when it walks the nested path-parameter tree.
 */
export const NumericIdParamSchema = z.object({
  id: NumericIdSchema,
})

/** Optional positive integer querystring (limit/offset/page/days/count all follow this). */
export const PositiveIntQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().positive().optional(),
}).meta({ id: 'PositiveIntQuery' })

/**
 * ISO datetime at the wire layer.
 *
 * Handlers may pass a native `Date` — Fastify's JSON.stringify serialiser
 * converts it to an ISO string via Date.prototype.toJSON at send time. The
 * schema accepts both so TypeScript handlers can return DB rows directly
 * without manual `.toISOString()` calls. The OpenAPI spec collapses the
 * union to a single `string, date-time` entry (both branches render the
 * same format), so consumers see a clean contract.
 */
export const DateTimeSchema = z.union([z.iso.datetime(), z.date()])
