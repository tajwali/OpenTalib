// lib/server/grade-band.ts
// Deterministic — no LLM call needed.

export type GradeBand = 'early' | 'junior' | 'middle' | 'senior' | 'adult'

export function getGradeBand(grade: number | null | undefined): GradeBand {
  if (!grade) return 'adult'
  if (grade <= 3) return 'early'
  if (grade <= 8) return 'junior'
  if (grade <= 10) return 'middle'
  return 'senior'
}

export const GRADE_BAND_CONSTRAINTS: Record<GradeBand, string> = {
  early: 'Max 1 sentence per explanation. Use objects and stories only. Max 1 quiz question per concept. No technical vocabulary without immediate plain-language definition.',
  junior: 'Max 3 lines per paragraph. Mandatory worked example before every quiz. Use concrete analogies. Failure feedback required on every wrong answer.',
  middle: 'Worked examples required. Introduce formal terminology alongside plain language. Exam-style questions. Show marking criteria.',
  senior: 'Exam technique focus. Mark-scheme language. Problem-first approach acceptable. Peer-discussion prompts.',
  adult: 'Professional register. Problem-based or inquiry-based. No grade restrictions on vocabulary or complexity.',
}
