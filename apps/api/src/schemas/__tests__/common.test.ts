import { describe, expect, it } from 'vitest'
import {
  ErrorResponseSchema,
  NumericIdParamSchema,
  PositiveIntQuerySchema,
  NumericIdSchema,
} from '../common.ts'

describe('common schemas', () => {
  it('ErrorResponseSchema accepts { error: string }', () => {
    expect(ErrorResponseSchema.safeParse({ error: 'Boom' }).success).toBe(true)
  })

  it('NumericIdSchema coerces string digits', () => {
    const r = NumericIdSchema.safeParse('42')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe(42)
  })

  it('NumericIdSchema rejects negatives and zero', () => {
    expect(NumericIdSchema.safeParse('0').success).toBe(false)
    expect(NumericIdSchema.safeParse('-3').success).toBe(false)
    expect(NumericIdSchema.safeParse('abc').success).toBe(false)
  })

  it('NumericIdParamSchema extracts a coerced id', () => {
    const r = NumericIdParamSchema.safeParse({ id: '7' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.id).toBe(7)
  })

  it('PositiveIntQuerySchema treats missing fields as undefined', () => {
    const r = PositiveIntQuerySchema.safeParse({})
    expect(r.success).toBe(true)
  })
})
