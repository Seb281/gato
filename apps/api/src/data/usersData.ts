import { eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { usersTable } from '../db/schema.ts'
import type { User } from '../db/schema.ts'
import { supabase } from '../middleware/supabaseAuth.ts'

interface UserData {
  supabaseId: string
  email: string
  name?: string
}

export const userContextData = {
  async retrieveUserContext(userEmail: string): Promise<{
    context: string | null
    targetLanguage: string | null
    customApiKey: string | null
    preferredProvider: string | null
  }> {
    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, userEmail),
      columns: {
        targetLanguage: true,
        context: true,
        customApiKey: true,
        preferredProvider: true,
      },
    })

    if (!user) {
      return {
        context: null,
        targetLanguage: null,
        customApiKey: null,
        preferredProvider: null,
      }
    }

    return user
  },

  async saveNewContext(
    userEmail: string,
    userContext: string | null,
    userTargetLanguage: string | null,
    userCustomApiKey: string | null,
    userPreferredProvider: string | null
  ): Promise<{
    context: string | null
    targetLanguage: string | null
    customApiKey: string | null
    preferredProvider: string | null
  }> {
    const result = await db
      .update(usersTable)
      .set({
        context: userContext,
        targetLanguage: userTargetLanguage,
        customApiKey: userCustomApiKey,
        preferredProvider: userPreferredProvider,
      })
      .where(eq(usersTable.email, userEmail))
      .returning({
        context: usersTable.context,
        targetLanguage: usersTable.targetLanguage,
        customApiKey: usersTable.customApiKey,
        preferredProvider: usersTable.preferredProvider,
      })

    const contextAndLanguage = result[0]
    if (!contextAndLanguage) {
      throw new Error('User not found')
    }

    return contextAndLanguage
  },
}

export const usersData = {
  async retrieveUser(userEmail: string): Promise<User | null> {
    if (!userEmail) {
      throw new Error('email is required')
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, userEmail),
    })

    return user ?? null
  },

  async retrieveUserBySupabaseId(supabaseId: string): Promise<User | null> {
    if (!supabaseId) {
      throw new Error('supabaseId is required')
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.supabaseId, supabaseId),
    })

    return user ?? null
  },

  async findOrCreateUser(userData: UserData): Promise<User> {
    const { supabaseId, email, name } = userData

    if (!supabaseId || !email) {
      throw new Error('supabaseId and email are required')
    }

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.supabaseId, supabaseId),
    })

    if (!user) {
      const result = await db
        .insert(usersTable)
        .values({
          supabaseId,
          email,
          name,
        })
        .returning()

      const newUser = result[0]
      if (!newUser) {
        throw new Error('Failed to create user')
      }
      user = newUser
    }

    return user
  },

  async updateDailyGoal(userId: number, dailyGoal: number): Promise<void> {
    await db
      .update(usersTable)
      .set({ dailyGoal })
      .where(eq(usersTable.id, userId))
  },

  async updateName(userId: number, name: string | null): Promise<void> {
    await db
      .update(usersTable)
      .set({ name })
      .where(eq(usersTable.id, userId))
  },

  async updateTheme(userId: number, theme: string | null): Promise<void> {
    await db
      .update(usersTable)
      .set({ theme })
      .where(eq(usersTable.id, userId))
  },

  async updateDisplayLanguage(userId: number, displayLanguage: string | null): Promise<void> {
    await db
      .update(usersTable)
      .set({ displayLanguage })
      .where(eq(usersTable.id, userId))
  },

  async deleteUser(supabaseId: string): Promise<Array<User>> {
    try {
      // Delete from Supabase Auth first (requires admin access)
      const { error } = await supabase.auth.admin.deleteUser(supabaseId)
      if (error) throw error

      // Then delete from database
      const deletedUser = await db
        .delete(usersTable)
        .where(eq(usersTable.supabaseId, supabaseId))
        .returning()

      return deletedUser
    } catch (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  },
}