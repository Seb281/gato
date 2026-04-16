/**
 * MSW handler for Supabase GoTrue.
 *
 * Real URL shape: `{SUPABASE_URL}/auth/v1/user`. In tests, `SUPABASE_URL`
 * is stubbed to `http://msw.local/supabase` by globalSetup.
 *
 * The supabase-js client sends the bearer in the `Authorization` header.
 * We read it, map the token to a user via `SUPABASE_USERS`, and return the
 * same payload shape that supabase-js already consumes.
 */
import { http, HttpResponse } from 'msw'
import { SUPABASE_USERS } from '../fixtures/users.ts'

export const supabaseAuthHandlers = [
  http.get('http://msw.local/supabase/auth/v1/user', ({ request }) => {
    const header = request.headers.get('authorization') ?? ''
    const token = header.replace(/^Bearer\s+/i, '')
    const user = SUPABASE_USERS[token]
    if (!user) {
      return HttpResponse.json(
        { msg: 'invalid token' },
        { status: 401 }
      )
    }
    return HttpResponse.json({
      id: user.id,
      email: user.email,
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    })
  }),
]
