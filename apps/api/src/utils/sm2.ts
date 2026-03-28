/**
 * SM-2 Spaced Repetition Algorithm
 *
 * Quality ratings:
 *   0 — complete blackout
 *   1 — incorrect, but remembered upon seeing answer
 *   2 — incorrect, but answer felt easy to recall
 *   3 — correct with serious difficulty
 *   4 — correct with some hesitation
 *   5 — perfect recall
 */

type SM2Input = {
  quality: number       // 0-5
  easeFactor: number    // previous EF (≥ 1.3)
  interval: number      // previous interval in days
  repetitions: number   // consecutive correct count
}

type SM2Output = {
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewAt: Date
  conceptState: 'new' | 'learning' | 'familiar' | 'mastered'
}

export function sm2(input: SM2Input): SM2Output {
  const { quality, easeFactor: prevEF, interval: prevInterval, repetitions: prevReps } = input

  let newEF = prevEF + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (newEF < 1.3) newEF = 1.3

  let newInterval: number
  let newReps: number

  if (quality < 3) {
    // Failed — reset
    newReps = 0
    newInterval = 0
  } else {
    // Passed
    newReps = prevReps + 1

    if (newReps === 1) {
      newInterval = 1
    } else if (newReps === 2) {
      newInterval = 6
    } else {
      newInterval = Math.round(prevInterval * newEF)
    }
  }

  // Next review date
  const nextReviewAt = new Date()
  if (newInterval === 0) {
    // Review again soon (10 minutes for failed items)
    nextReviewAt.setMinutes(nextReviewAt.getMinutes() + 10)
  } else {
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval)
  }

  // Auto-transition concept state based on repetitions
  let conceptState: SM2Output['conceptState']
  if (newReps === 0) {
    conceptState = 'learning'
  } else if (newReps <= 2) {
    conceptState = 'learning'
  } else if (newReps <= 5) {
    conceptState = 'familiar'
  } else {
    conceptState = 'mastered'
  }

  return {
    easeFactor: Math.round(newEF * 100) / 100,
    interval: newInterval,
    repetitions: newReps,
    nextReviewAt,
    conceptState,
  }
}

/**
 * Map user-friendly quality labels to SM-2 quality scores
 */
export const QUALITY_MAP = {
  again: 1,
  hard: 3,
  good: 4,
  easy: 5,
} as const

export type QualityLabel = keyof typeof QUALITY_MAP
