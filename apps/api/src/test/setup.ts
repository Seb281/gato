/**
 * Per-test-file setup. Runs in the same process as tests (singleThread).
 *
 * - Boot MSW once and shut it down at the end of the process.
 * - Reset MSW handlers between tests so per-case overrides don't leak.
 * - Truncate the DB between tests so no row survives the previous case.
 */
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { server } from './msw/server.ts'
import { truncateAll } from './db/truncate.ts'

beforeAll(() => {
  // `error` is strict: any unhandled outbound HTTP fails the test loud and clear.
  server.listen({ onUnhandledRequest: 'error' })
})

beforeEach(async () => {
  await truncateAll()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
