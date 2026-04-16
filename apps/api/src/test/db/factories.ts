/**
 * Flat factory helpers for test data. Each returns the inserted row. Accept
 * partial overrides; fill sensible defaults for everything else.
 */
import { db } from '../../db/index.ts'
import {
  usersTable,
  conceptsTable,
  reviewScheduleTable,
  tagsTable,
  type User,
  type Concept,
  type ReviewSchedule,
  type Tag,
} from '../../db/schema.ts'

let counter = 0
const nextUnique = () => `${Date.now()}-${++counter}`

export async function createUser(
  overrides: Partial<typeof usersTable.$inferInsert> = {}
): Promise<User> {
  const unique = nextUnique()
  const [row] = await db
    .insert(usersTable)
    .values({
      supabaseId: `sb-${unique}`,
      email: `user-${unique}@test.local`,
      targetLanguage: 'German',
      displayLanguage: 'English',
      ...overrides,
    })
    .returning()
  return row!
}

export async function createConcept(
  overrides: Partial<typeof conceptsTable.$inferInsert> & { userId: number }
): Promise<Concept> {
  const [row] = await db
    .insert(conceptsTable)
    .values({
      sourceLanguage: 'German',
      targetLanguage: 'English',
      concept: `word-${nextUnique()}`,
      translation: `translation-${nextUnique()}`,
      state: 'new',
      ...overrides,
    })
    .returning()
  return row!
}

export async function createSchedule(
  overrides: Partial<typeof reviewScheduleTable.$inferInsert> & {
    conceptId: number
    userId: number
  }
): Promise<ReviewSchedule> {
  const [row] = await db
    .insert(reviewScheduleTable)
    .values({
      easeFactor: 2.5,
      interval: 0,
      repetitions: 0,
      // Default due-now so most tests can immediately fetch via /review/due.
      nextReviewAt: new Date(0),
      ...overrides,
    })
    .returning()
  return row!
}

export async function createTag(
  overrides: Partial<typeof tagsTable.$inferInsert> & { userId: number }
): Promise<Tag> {
  const [row] = await db
    .insert(tagsTable)
    .values({
      name: `tag-${nextUnique()}`,
      color: '#6b7280',
      ...overrides,
    })
    .returning()
  return row!
}
