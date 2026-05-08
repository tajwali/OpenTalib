// lib/spaced-repetition/sm2.ts
// Standard SM-2 spaced repetition algorithm.
// quality: 0=complete blackout, 1=wrong, 2=wrong+hint, 3=correct+hard, 4=correct, 5=instant recall

export interface SM2State {
  easeFactor: number
  intervalDays: number
  repetitions: number
}

export interface SM2Update extends SM2State {
  nextReviewDate: Date
  quality: number
}

export function sm2Update(state: SM2State, quality: number): SM2Update {
  let { easeFactor, intervalDays, repetitions } = state

  if (quality >= 3) {
    if (repetitions === 0) intervalDays = 1
    else if (repetitions === 1) intervalDays = 6
    else intervalDays = Math.round(intervalDays * easeFactor)
    repetitions += 1
  } else {
    repetitions = 0
    intervalDays = 1
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (easeFactor < 1.3) easeFactor = 1.3

  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays)

  return { easeFactor, intervalDays, repetitions, nextReviewDate, quality }
}

export function quizScoreToQuality(scorePercent: number): number {
  if (scorePercent >= 86) return 5
  if (scorePercent >= 61) return 4
  if (scorePercent >= 41) return 3
  if (scorePercent >= 21) return 2
  if (scorePercent >= 1) return 1
  return 0
}
