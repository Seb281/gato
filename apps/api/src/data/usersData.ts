import { eq } from 'drizzle-orm'
import { db } from '../db/index.ts'
import { usersTable } from '../db/schema.ts'
import type { User } from '../db/schema.ts'
import { clerkClient } from '../middleware/clerkAuth.ts'

interface UserData {
  clerkId: string
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
    const { context, targetLanguage, customApiKey, preferredProvider } =
      (await db.query.usersTable.findFirst({
        where: eq(usersTable.email, userEmail),
        columns: {
          targetLanguage: true,
          context: true,
          customApiKey: true,
          preferredProvider: true,
        },
      })) ?? {
        context: null,
        targetLanguage: null,
        customApiKey: null,
        preferredProvider: null,
      }

    return { context, targetLanguage, customApiKey, preferredProvider }
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

  async retrieveUserByClerkId(clerkId: string): Promise<User | null> {
    if (!clerkId) {
      throw new Error('clerkId is required')
    }

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    })

    return user ?? null
  },

  async findOrCreateUser(userData: UserData): Promise<User> {
    const { clerkId, email, name } = userData

    if (!clerkId || !email) {
      throw new Error('clerkId and email are required')
    }

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, clerkId),
    })

    if (!user) {
      const result = await db
        .insert(usersTable)
        .values({
          clerkId,
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

  async deleteUser(clerkId: string): Promise<Array<User>> {
    try {
      // Delete from Clerk first
      await clerkClient.users.deleteUser(clerkId)
      console.log(`User ${clerkId} deleted from Clerk`)

      // Then delete from database
      const deletedUser = await db
        .delete(usersTable)
        .where(eq(usersTable.clerkId, clerkId))
        .returning()
      console.log(`User ${clerkId} deleted from database`)

      return deletedUser
    } catch (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  },
}
