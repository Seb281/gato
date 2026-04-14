import { integer, pgTable, primaryKey, real, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  supabaseId: text('supabase_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  targetLanguage: text('targetLanguage'),
  context: text('context'),
  customApiKey: text('custom_api_key'),
  preferredProvider: text('preferred_provider').default('google'),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastActiveDate: text('last_active_date'),
  streakFreezes: integer('streak_freezes').notNull().default(0),
  freezesUsed: integer('freezes_used').notNull().default(0),
  dailyGoal: integer('daily_goal').notNull().default(10),
  theme: text('theme').default('system'),
  displayLanguage: text('display_language').default('English'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const conceptsTable = pgTable('concepts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  sourceLanguage: text('source_language').notNull(),
  targetLanguage: text('target_language').notNull(),
  concept: text('concept').notNull(),
  translation: text('translation').notNull(),
  phoneticApproximation: text('phonetic_approximation'),
  commonUsage: text('common_usage'),
  grammarRules: text('grammar_rules'),
  commonness: text('commonness'),
  fixedExpression: text('fixed_expression'),
  relatedWords: text('related_words'),
  userNotes: text('user_notes'),
  exampleSentence: text('example_sentence'),
  contextBefore: text('context_before'),
  contextAfter: text('context_after'),
  sourceUrl: text('source_url'),
  state: text('state').notNull().default('new'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

export const tagsTable = pgTable(
  'tags',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull().default('#6b7280'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.name)]
)

export const conceptTagsTable = pgTable(
  'concept_tags',
  {
    conceptId: integer('concept_id')
      .notNull()
      .references(() => conceptsTable.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tagsTable.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.conceptId, t.tagId] })]
)

export const reviewScheduleTable = pgTable('review_schedule', {
  id: serial('id').primaryKey(),
  conceptId: integer('concept_id')
    .notNull()
    .unique()
    .references(() => conceptsTable.id, { onDelete: 'cascade' }),
  userId: integer('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  easeFactor: real('ease_factor').notNull().default(2.5),
  interval: integer('interval').notNull().default(0),
  repetitions: integer('repetitions').notNull().default(0),
  nextReviewAt: timestamp('next_review_at').defaultNow().notNull(),
  lastReviewedAt: timestamp('last_reviewed_at'),
  totalReviews: integer('total_reviews').notNull().default(0),
  correctReviews: integer('correct_reviews').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const dailyActivityTable = pgTable(
  'daily_activity',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD
    conceptsAdded: integer('concepts_added').notNull().default(0),
    reviewsCompleted: integer('reviews_completed').notNull().default(0),
    correctReviews: integer('correct_reviews').notNull().default(0),
  },
  (t) => [unique().on(t.userId, t.date)]
)

export const reviewSessionsTable = pgTable('review_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  totalItems: integer('total_items').notNull(),
  correctItems: integer('correct_items').notNull(),
  accuracy: integer('accuracy').notNull(),
  durationSeconds: integer('duration_seconds'),
  completedAt: timestamp('completed_at').defaultNow().notNull(),
})

/**
 * Per-item review log. One row per rating submitted through
 * `POST /review/:conceptId/result`. Lets the detail page show a history
 * timeline for a concept and keeps raw data around for future analytics
 * without mutating the aggregates in `review_schedule`.
 *
 * `sessionId` is nullable because the session row is only written after the
 * client finishes and POSTs to `/review/sessions` — at the moment an
 * individual rating is logged, the session id isn't known yet. Storing null
 * is better than blocking the log on session metadata the handler doesn't have.
 */
export const reviewEventsTable = pgTable('review_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => usersTable.id, { onDelete: 'cascade' }),
  sessionId: integer('session_id').references(() => reviewSessionsTable.id, {
    onDelete: 'set null',
  }),
  conceptId: integer('concept_id')
    .notNull()
    .references(() => conceptsTable.id, { onDelete: 'cascade' }),
  rating: text('rating').notNull(), // 'again' | 'hard' | 'good' | 'easy'
  correct: integer('correct').notNull(), // 0 | 1 — mirrors quality >= 3
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type ReviewEvent = typeof reviewEventsTable.$inferSelect
export type NewReviewEvent = typeof reviewEventsTable.$inferInsert

/**
 * One "word of the day" suggestion per user per calendar date. Stored so
 * the card shows a deterministic, stable suggestion for a given day — the
 * LLM only runs on the first request of the day, every subsequent visit
 * reads from this table. Keyed (user, date) to make upserts trivial.
 */
export const dailySuggestionsTable = pgTable(
  'daily_suggestions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    date: text('date').notNull(), // YYYY-MM-DD in user's local day
    word: text('word').notNull(),
    translation: text('translation').notNull(),
    sourceLanguage: text('source_language').notNull(),
    targetLanguage: text('target_language').notNull(),
    rationale: text('rationale'),
    exampleSentence: text('example_sentence'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [unique().on(t.userId, t.date)]
)

export type DailySuggestion = typeof dailySuggestionsTable.$inferSelect
export type NewDailySuggestion = typeof dailySuggestionsTable.$inferInsert

export type User = typeof usersTable.$inferSelect
export type NewUser = typeof usersTable.$inferInsert

export type Concept = typeof conceptsTable.$inferSelect
export type NewConcept = typeof conceptsTable.$inferInsert

export type Tag = typeof tagsTable.$inferSelect
export type NewTag = typeof tagsTable.$inferInsert

export type ReviewSchedule = typeof reviewScheduleTable.$inferSelect

export type DailyActivity = typeof dailyActivityTable.$inferSelect

export const uiTranslationsTable = pgTable(
  'ui_translations',
  {
    id: serial('id').primaryKey(),
    language: text('language').notNull(),
    version: text('version').notNull(),
    translations: text('translations').notNull(), // JSON string
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [unique().on(t.language, t.version)]
)

export type ReviewSession = typeof reviewSessionsTable.$inferSelect
