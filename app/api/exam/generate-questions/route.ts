// app/api/exam/generate-questions/route.ts
// POST — generates exam-style questions for a topic using the LLM
// Stores generated questions in exam_questions table

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'
import { callLLM } from '@/lib/ai/llm'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = JSON.parse(await request.text())
  const {
    board = 'Other',
    subject = '',
    grade = null,
    topic = '',
    questionType = 'short-answer',
    count = 5,
    difficulty = 3,
  } = body

  if (!topic.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  const systemPrompt = `You are an expert examiner for ${board} ${subject}${grade ? ` Grade ${grade}` : ''}.
Generate exactly ${count} exam questions about: "${topic}"

Requirements:
- Question type: ${questionType}
- Difficulty: ${difficulty}/5
- Each question must match real ${board} exam style and format
- Include a detailed mark scheme for each question
- Mark scheme must specify exactly how marks are awarded point by point

Return ONLY a JSON array. No preamble. No markdown. Example format:
[
  {
    "question_text": "Define the term photosynthesis and state where it occurs in the cell.",
    "mark_scheme": "1 mark: process by which plants convert light energy to chemical energy. 1 mark: occurs in chloroplasts.",
    "marks": 2,
    "concept_keys": ["photosynthesis", "chloroplast"],
    "question_type": "${questionType}",
    "difficulty": ${difficulty}
  }
]`

  try {
    const resolvedModel = await resolveModelFromHeaders(request)
    
    const response = await callLLM(
      {
        model: resolvedModel.model,
        messages: [{ role: 'user', content: `Generate ${count} ${questionType} questions about: ${topic}` }],
        system: systemPrompt,
        maxTokens: 2000,
      },
      'exam-gen'
    )

    const rawText = response.text

    // Strip markdown fences if present
    const jsonText = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const questions = JSON.parse(jsonText)

    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: 'LLM returned invalid format' }, { status: 500 })
    }

    const admin = getSupabaseAdmin()
    const rows = questions.map((q: any) => ({
      board,
      subject,
      grade: grade ? parseInt(String(grade), 10) : null,
      topic,
      concept_keys: q.concept_keys ?? [],
      question_text: q.question_text,
      mark_scheme: q.mark_scheme,
      marks: q.marks ?? 1,
      question_type: q.question_type ?? questionType,
      difficulty: q.difficulty ?? difficulty,
      source: 'ai-generated',
    }))

    const { data, error } = await admin
      .from('exam_questions')
      .insert(rows)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ questions: data, count: data.length })
  } catch (error) {
    console.error('[exam/generate-questions]', error)
    return NextResponse.json(
      { error: 'Question generation failed', detail: String(error) },
      { status: 500 }
    )
  }
}
