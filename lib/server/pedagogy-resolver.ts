// lib/server/pedagogy-resolver.ts
// Two-stage agentic resolver. Stage 1: free-form reasoning. Stage 2: JSON extraction.
// Called once before course generation begins.

import { getBoardDescription } from './board-registry'
import { getGradeBand, GRADE_BAND_CONSTRAINTS, GradeBand } from './grade-band'
import { resolveModel } from './resolve-model'
import { callLLM } from '@/lib/ai/llm'

export interface PedagogyProfile {
  teachingMethod: string
  gradeBand: GradeBand
  openingStrategy: string
  conceptVocab: Record<string, string>
  pageStructureRule: string
  workedExampleRequirement: string
  failureFeedbackTemplate: string
  boardExamStyle: string
  boardMethodRequirements: string
  toneGuidance: string
  languageMix: string
  culturalContext: string
  hardConstraints: string[]
}

interface ResolverInput {
  topic: string
  grade: number | null
  subject: string
  board: string
  studentContext: string
  language: string
  model: string
}

const STAGE_1_SYSTEM = `You are a world-class curriculum designer with deep expertise in evidence-based pedagogy across all subjects, ages, and education systems globally.

A teacher is creating a digital interactive course. Reason step by step across these five areas before concluding:

1. TEACHING METHODOLOGY
   What is the most evidence-based pedagogical approach for this subject at this grade level? Consider Bloom's Taxonomy level, whether direct instruction, inquiry-based, problem-based, or constructivist approaches suit this subject, and cognitive load management.

2. EXAM BOARD ALIGNMENT
   How does this specific board structure its assessments? What methods does it reward? What does showing your work mean here? Are there board-specific techniques students must demonstrate?

3. SUBJECT-SPECIFIC SCAFFOLDING
   What analogies, worked examples, or scaffolding strategies are proven for this subject at this level? Consider concrete-to-abstract progressions, subject-specific vocabulary, and common misconceptions to pre-empt.

4. CULTURAL AND LINGUISTIC CONTEXT
   Given the student background, what analogies will resonate? What language approach will aid comprehension without compromising exam readiness?

5. PAGE STRUCTURE DECISION
   For an interactive digital lesson, how should each concept be structured? How many phases per concept? What does the quiz look like?

Think through all five areas thoroughly. Do not produce JSON yet.`

const STAGE_2_SYSTEM = `You are a data extraction assistant. Given pedagogical reasoning text, extract a strict JSON object matching this exact schema. Return ONLY valid JSON. No preamble. No markdown fences. No trailing commas.

Schema:
{
  "teachingMethod": "string — one of: i-do-we-do-you-do | inquiry-first | socratic | direct-instruction | problem-based",
  "gradeBand": "string — one of: early | junior | middle | senior | adult",
  "openingStrategy": "string — one of: real-world-hook | prediction-question | recall-warmup | phenomenon-observation | problem-statement",
  "conceptVocab": {"concept_key": "analogy or plain-language label"},
  "pageStructureRule": "string — exact phases per concept in order",
  "workedExampleRequirement": "string — when and how worked examples must appear",
  "failureFeedbackTemplate": "string — what to say when a student gets a question wrong",
  "boardExamStyle": "string — how this board's exams are structured and what they reward",
  "boardMethodRequirements": "string — specific techniques this board expects students to show",
  "toneGuidance": "string — how the AI teacher persona should sound",
  "languageMix": "string — one of: english-only | english-urdu | english-arabic | urdu-only | bilingual-other",
  "culturalContext": "string — culturally appropriate analogies for this student background",
  "hardConstraints": ["array of absolute rules as strings"]
}`

async function callLLMSimple(
  modelString: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 1200
): Promise<string> {
  const resolved = await resolveModel({ modelString });
  const response = await callLLM(
    {
      model: resolved.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens,
    },
    'pedagogy-resolver'
  )
  return response.text;
}

export async function resolvePedagogy(input: ResolverInput): Promise<PedagogyProfile> {
  const gradeBand = getGradeBand(input.grade)
  const boardDescription = getBoardDescription(input.board)
  const gradeConstraints = GRADE_BAND_CONSTRAINTS[gradeBand]

  const userContext = `
Topic: ${input.topic}
Grade: ${input.grade ?? 'Adult / unspecified'} (${gradeBand} band)
Subject area: ${input.subject}
Exam board: ${input.board} — ${boardDescription}
Student background: ${input.studentContext || 'Not specified'}
Instruction language preference: ${input.language || 'English'}
Grade band constraints: ${gradeConstraints}
`.trim()

  // Stage 1: free-form pedagogical reasoning
  const reasoning = await callLLMSimple(
    input.model,
    STAGE_1_SYSTEM,
    userContext,
    1200
  )

  // Stage 2: extract into strict JSON
  const extractionPrompt = `Pedagogical reasoning to extract from:\n\n${reasoning}\n\nOriginal inputs:\n${userContext}`
  const rawJson = await callLLMSimple(
    input.model,
    STAGE_2_SYSTEM,
    extractionPrompt,
    800
  )

  try {
    const profile = JSON.parse(rawJson) as PedagogyProfile
    // Ensure gradeBand is always set deterministically, not by LLM
    profile.gradeBand = gradeBand
    return profile
  } catch {
    // Fallback: return a safe default profile if JSON parse fails
    return buildFallbackProfile(gradeBand, input.board, input.language)
  }
}

function buildFallbackProfile(
  gradeBand: GradeBand,
  board: string,
  language: string
): PedagogyProfile {
  return {
    teachingMethod: gradeBand === 'junior' || gradeBand === 'early' ? 'i-do-we-do-you-do' : 'direct-instruction',
    gradeBand,
    openingStrategy: 'real-world-hook',
    conceptVocab: {},
    pageStructureRule: 'Each concept: 1 worked example page, 1 guided practice page, 1 quiz page.',
    workedExampleRequirement: 'Every concept must have a fully worked numerical or practical example before any quiz.',
    failureFeedbackTemplate: 'No worries! Let us try together. Look at the example again and focus on step 1.',
    boardExamStyle: `Standard ${board} assessment format.`,
    boardMethodRequirements: 'Show all working. Label all steps.',
    toneGuidance: 'Warm, encouraging, patient. Celebrate effort not just correct answers.',
    languageMix: language.toLowerCase().includes('urdu') ? 'english-urdu' : 'english-only',
    culturalContext: 'Use everyday local examples relevant to the student background.',
    hardConstraints: [
      'Never explain a concept without a worked example using real numbers or real objects.',
      'Never end a content page without a Your Turn question.',
      'Always provide failure feedback when a student answers incorrectly.',
      'Keep sentences short and grade-appropriate.',
    ],
  }
}

export function buildSystemPromptHeader(profile: PedagogyProfile): string {
  const constraints = profile.hardConstraints
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n')

  const vocab = Object.entries(profile.conceptVocab)
    .map(([k, v]) => `- ${k}: call it "${v}"`)
    .join('\n')

  return `## PEDAGOGICAL FRAMEWORK (MANDATORY — READ BEFORE GENERATING ANY CONTENT)

Teaching method: ${profile.teachingMethod}
Grade band: ${profile.gradeBand}
Tone: ${profile.toneGuidance}
Language: ${profile.languageMix}
Cultural context: ${profile.culturalContext}

Opening strategy for this lesson: ${profile.openingStrategy}

Page structure rule:
${profile.pageStructureRule}

Worked example requirement:
${profile.workedExampleRequirement}

Failure feedback template (use this when a student gets something wrong):
"${profile.failureFeedbackTemplate}"

Board exam style (${profile.boardExamStyle}):
${profile.boardMethodRequirements}

${vocab ? `Concept vocabulary (always use these labels):\n${vocab}` : ''}

HARD CONSTRAINTS — violating any of these is a generation failure:
${constraints}

---
`
}
