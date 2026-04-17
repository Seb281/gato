import type { FastifyInstance, FastifyPluginOptions } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  requireAuth,
  getAuthenticatedUserEmail,
  getAuthenticatedUserId,
} from '../middleware/supabaseAuth.ts'
import { usersData, userContextData } from '../data/usersData.ts'
import {
  UserSettingsResponseSchema,
  UpdateUserSettingsBodySchema,
  UpdateUserSettingsResponseSchema,
} from '../schemas/userSettings.ts'
import { ErrorResponseSchema } from '../schemas/common.ts'

/**
 * User settings routes — read and update the authenticated user's profile and
 * preferences. PUT masks any returned API key before sending it back.
 */
export async function userSettingsRoutes(
  baseApp: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  const fastify = baseApp.withTypeProvider<ZodTypeProvider>()

  fastify.get('/user/settings', {
    schema: {
      tags: ['user'],
      summary: 'Get current user settings',
      security: [{ bearerAuth: [] }],
      response: {
        200: UserSettingsResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const email = await getAuthenticatedUserEmail(request)
    if (!email) {
      return reply.code(401).send({ error: 'Could not get user email' })
    }

    try {
      const supabaseId = getAuthenticatedUserId(request)
      const user = supabaseId ? await usersData.retrieveUserBySupabaseId(supabaseId) : null
      const settings = await userContextData.retrieveUserContext(email)

      // Mask API key for security
      let maskedKey = null
      if (settings.customApiKey) {
        const key = settings.customApiKey
        if (key.length > 8) {
          maskedKey = `${key.slice(0, 3)}...${key.slice(-4)}`
        } else {
          maskedKey = '***'
        }
      }

      return reply.send({
        name: user?.name ?? null,
        targetLanguage: settings.targetLanguage,
        personalContext: settings.context,
        preferredProvider: settings.preferredProvider,
        maskedApiKey: maskedKey,
        hasCustomApiKey: !!settings.customApiKey,
        dailyGoal: user?.dailyGoal ?? 10,
        theme: user?.theme ?? 'system',
        displayLanguage: user?.displayLanguage ?? 'English',
        streakFreezes: user?.streakFreezes ?? 0,
      })
    } catch (error) {
      request.log.error(error, 'Failed to retrieve settings')
      return reply.code(500).send({ error: 'Failed to retrieve settings' })
    }
  })

  fastify.put('/user/settings', {
    schema: {
      tags: ['user'],
      summary: 'Update user settings (including optional BYOK)',
      security: [{ bearerAuth: [] }],
      body: UpdateUserSettingsBodySchema,
      response: {
        200: UpdateUserSettingsResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
      const userId = getAuthenticatedUserId(request)
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const email = await getAuthenticatedUserEmail(request)
      if (!email) {
        return reply.code(401).send({ error: 'Could not get user email' })
      }

      // Ensure user exists in database
      const userFromAuth = (request as any).user
      const name = userFromAuth.user_metadata?.full_name ?? userFromAuth.user_metadata?.name
      const user = await usersData.findOrCreateUser({
        supabaseId: userId,
        email,
        ...(name && { name }),
      })

      const { targetLanguage, personalContext, customApiKey, preferredProvider, dailyGoal, name: newName, theme: newTheme, displayLanguage: newDisplayLanguage } = request.body

      try {
        const currentSettings = await userContextData.retrieveUserContext(email)

        let newApiKey = currentSettings.customApiKey
        if (customApiKey !== undefined) {
           newApiKey = customApiKey
        }

        let newProvider = currentSettings.preferredProvider
        if (preferredProvider !== undefined) {
          newProvider = preferredProvider
        }

        const updatedSettings = await userContextData.saveNewContext(
          email,
          personalContext ?? currentSettings.context,
          targetLanguage ?? currentSettings.targetLanguage,
          newApiKey,
          newProvider
        )

        // Update dailyGoal on the user record if provided
        let updatedDailyGoal = user.dailyGoal
        if (dailyGoal !== undefined) {
          await usersData.updateDailyGoal(user.id, dailyGoal)
          updatedDailyGoal = dailyGoal
        }

        // Update name if provided
        let updatedName = user.name
        if (newName !== undefined) {
          await usersData.updateName(user.id, newName)
          updatedName = newName
        }

        // Update theme if provided
        let updatedTheme = user.theme
        if (newTheme !== undefined) {
          await usersData.updateTheme(user.id, newTheme)
          updatedTheme = newTheme
        }

        // Update displayLanguage if provided
        let updatedDisplayLanguage = user.displayLanguage
        if (newDisplayLanguage !== undefined) {
          await usersData.updateDisplayLanguage(user.id, newDisplayLanguage)
          updatedDisplayLanguage = newDisplayLanguage
        }

        // Mask key for response
        let maskedKey = null
        if (updatedSettings.customApiKey) {
          const key = updatedSettings.customApiKey
          if (key.length > 8) {
            maskedKey = `${key.slice(0, 3)}...${key.slice(-4)}`
          } else {
            maskedKey = '***'
          }
        }

        return reply.send({
          message: 'Settings updated',
          name: updatedName,
          targetLanguage: updatedSettings.targetLanguage,
          personalContext: updatedSettings.context,
          preferredProvider: updatedSettings.preferredProvider,
          maskedApiKey: maskedKey,
          hasCustomApiKey: !!updatedSettings.customApiKey,
          dailyGoal: updatedDailyGoal,
          theme: updatedTheme,
          displayLanguage: updatedDisplayLanguage ?? 'English',
          streakFreezes: user.streakFreezes,
        })
      } catch (error) {
        request.log.error(error, 'Failed to update settings')
        return reply.code(500).send({ error: 'Failed to update settings' })
      }
    }
  )
}
