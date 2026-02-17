import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

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
  state: text('state').notNull().default('new'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
})

export type User = typeof usersTable.$inferSelect
export type NewUser = typeof usersTable.$inferInsert

export type Concept = typeof conceptsTable.$inferSelect
export type NewConcept = typeof conceptsTable.$inferInsert
