import { integer, pgTable, primaryKey, serial, text, timestamp, unique } from 'drizzle-orm/pg-core'

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  supabaseId: text('supabase_id').notNull().unique(),
  email: text('email').notNull().unique(),
  name: text('name'),
  targetLanguage: text('targetLanguage'),
  context: text('context'),
  customApiKey: text('custom_api_key'),
  preferredProvider: text('preferred_provider').default('google'),
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
  userNotes: text('user_notes'),
  exampleSentence: text('example_sentence'),
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

export type User = typeof usersTable.$inferSelect
export type NewUser = typeof usersTable.$inferInsert

export type Concept = typeof conceptsTable.$inferSelect
export type NewConcept = typeof conceptsTable.$inferInsert

export type Tag = typeof tagsTable.$inferSelect
export type NewTag = typeof tagsTable.$inferInsert
