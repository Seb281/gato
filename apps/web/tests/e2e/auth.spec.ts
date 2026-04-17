import { test, expect } from '@playwright/test'

/**
 * Smoke coverage for the Supabase-backed sign-in flow. Asserts that a known
 * test user can authenticate through the `<Auth>` component on `/sign-in` and
 * reach the protected `/dashboard` route.
 *
 * Required env vars (set via `.env.test` locally, GitHub secrets in CI):
 *   TEST_USER_EMAIL, TEST_USER_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   NEXT_PUBLIC_API_URL (any value — dashboard fetches are tolerated, not asserted)
 */
test('signs in with email+password and lands on /dashboard', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL / TEST_USER_PASSWORD must be set — see apps/web/.env.test.example')
  }

  await page.goto('/sign-in')

  // @supabase/auth-ui-react renders an `#auth-sign-in` form with native input
  // types. Target by `type` instead of by label text so future copy changes in
  // the auth-ui package don't break this selector.
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  // `<Auth>` renders both an OAuth button ("Sign in with Google") and the
  // email+password submit ("Sign in") — match the latter exactly.
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  await expect(page).toHaveURL(/\/dashboard/)
})
