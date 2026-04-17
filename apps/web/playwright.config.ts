import { defineConfig, devices } from '@playwright/test'
import { config as loadEnv } from 'dotenv'
import path from 'path'

/**
 * Playwright E2E config for the web dashboard.
 *
 * Reads local test credentials from `.env.test` (gitignored). In CI these come
 * from GitHub Actions secrets and are injected as environment variables before
 * Playwright runs, so the dotenv load is a no-op there.
 *
 * Playwright loads this file via CJS require, so `__dirname` resolves to this
 * directory at runtime — no ESM-style `fileURLToPath` dance needed.
 */
loadEnv({ path: path.resolve(__dirname, '.env.test') })

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // `next dev` is faster to start than `build && start` and good enough for
    // a smoke E2E. Switch to `next start` if the dev server's HMR noise ever
    // destabilises the suite.
    command: 'pnpm dev',
    cwd: __dirname,
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
