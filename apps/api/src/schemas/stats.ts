import { z } from 'zod'

/** /stats/overview response — aggregate stats for the dashboard header. */
export const OverviewStatsResponseSchema = z.object({
  totalConcepts: z.number().int(),
  currentStreak: z.number().int(),
  longestStreak: z.number().int(),
  avgAccuracy: z.number(),
  conceptsByState: z.record(z.string(), z.number().int()),
  streakFreezes: z.number().int(),
  freezesUsed: z.number().int(),
  dailyGoal: z.number().int(),
  todayReviews: z.number().int(),
  todayGoalMet: z.boolean(),
}).meta({ id: 'OverviewStats' })

/** /stats/activity querystring. */
export const ActivityQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(365).optional(),
})

/** Per-day activity row. */
export const DailyActivitySchema = z.object({
  date: z.string(),
  reviewsCompleted: z.number().int(),
  correctReviews: z.number().int(),
  conceptsAdded: z.number().int(),
}).meta({ id: 'DailyActivity' })

export const ActivityResponseSchema = z.object({
  activity: z.array(DailyActivitySchema),
})
