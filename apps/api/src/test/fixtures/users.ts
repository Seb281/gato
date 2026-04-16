/**
 * Token ↔ Supabase-user fixture table used by the GoTrue MSW handler.
 *
 * Tests attach `Authorization: Bearer <TOKENS.alice>` and expect the real
 * `requireAuth` middleware to run, hit MSW, and resolve to the matching
 * user object.
 */
export const TOKENS = {
  alice: 'test-token-alice',
  bob: 'test-token-bob',
  invalid: 'test-token-invalid',
} as const

export const SUPABASE_USERS: Record<string, { id: string; email: string }> = {
  [TOKENS.alice]: { id: 'sb-alice', email: 'alice@test.local' },
  [TOKENS.bob]: { id: 'sb-bob', email: 'bob@test.local' },
}
