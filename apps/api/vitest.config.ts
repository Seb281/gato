import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    globalSetup: ['./src/test/globalSetup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
    // fileParallelism: false ensures test files run sequentially, preventing
    // vi.useFakeTimers() in unit tests from interfering with async DB operations
    // in integration tests that run in the same process.
    fileParallelism: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
