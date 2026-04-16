/**
 * Clears every app table between tests. One `TRUNCATE ... RESTART IDENTITY
 * CASCADE` statement is faster than dropping and re-migrating the schema.
 *
 * Keep this list in sync with `src/db/schema.ts`. Missing a table here leaves
 * state leaking between tests — prefer a loud test failure when someone adds
 * a table without updating this list.
 */
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.ts'

const TABLES = [
  'concept_tags',
  'review_events',
  'review_sessions',
  'review_schedule',
  'daily_activity',
  'daily_suggestions',
  'ui_translations',
  'tags',
  'concepts',
  'users',
] as const

export async function truncateAll(): Promise<void> {
  const list = TABLES.map((t) => `"${t}"`).join(', ')
  await db.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`))
}
