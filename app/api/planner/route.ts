// app/api/planner/route.ts
// POST — register upcoming exam and generate study plan
// GET  — fetch active study plans

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'
import { callLLM } from '@/lib/ai/llm'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = JSON.parse(await request.text())
  const { board, subject, grade, examDate, targetGrade } = body

  if (!board || !subject || !examDate) {
    return NextResponse.json(
      { error: 'board, subject and examDate are required' },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Save the exam registration
  const { data: examRecord, error: examError } = await admin
    .from('student_exams')
    .insert({
      user_id: session.user.id,
      board,
      subject,
      grade: grade ? parseInt(String(grade), 10) : null,
      exam_date: examDate,
      target_grade: targetGrade ?? null,
    })
    .select()
    .single()

  if (examError) {
    return NextResponse.json({ error: examError.message }, { status: 500 })
  }

  // Get student's weak concepts for this subject
  const { data: mastery } = await admin
    .from('concept_mastery')
    .select('concept_key, ease_factor')
    .eq('user_id', session.user.id)
    .order('ease_factor', { ascending: true })
    .limit(10)

  const weakConcepts = (mastery ?? [])
    .filter(m => m.ease_factor < 2.5)
    .map(m => m.concept_key)
    .join(', ') || 'none identified yet'

  const daysUntilExam = Math.ceil(
    (new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )

  // Generate study plan with LLM
  const planPrompt = `You are a study planning expert for ${board} ${subject}${grade ? ` Grade ${grade}` : ''}.

Exam date: ${examDate} (${daysUntilExam} days from now)
Target grade: ${targetGrade ?? 'pass'}
Known weak concepts: ${weakConcepts}

Generate a realistic weekly study plan for the remaining ${daysUntilExam} days.
Prioritise weak concepts. Include mock exam sessions in the final 2 weeks.
Each week should have 5-6 study sessions of 30-60 minutes each.

Return ONLY valid JSON array of weeks. No preamble:
[
  {
    "week": 1,
    "focus": "topic name",
    "sessions": [
      {
        "day": "Monday",
        "topic": "specific topic",
        "duration_minutes": 45,
        "type": "study | review | mock-exam"
      }
    ]
  }
]`

  try {
    const resolvedModel = await resolveModelFromHeaders(request)
    const response = await callLLM(
      {
        model: resolvedModel.model,
        messages: [{ role: 'user', content: planPrompt }],
        maxTokens: 2000,
      },
      'study-planner'
    )

    const rawText = response.text

    const planJson = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const plan = JSON.parse(planJson)

    const { data: planRecord, error: planError } = await admin
      .from('study_plans')
      .insert({
        user_id: session.user.id,
        exam_id: examRecord.id,
        plan_json: plan,
      })
      .select()
      .single()

    if (planError) {
      return NextResponse.json({ error: planError.message }, { status: 500 })
    }

    return NextResponse.json({
      exam: examRecord,
      plan: planRecord,
      daysUntilExam,
      weakConcepts: weakConcepts.split(', ').filter(Boolean),
    })

  } catch (e) {
    console.error('[planner] LLM error:', e)
    return NextResponse.json(
      { error: 'Plan generation failed', detail: String(e) },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('study_plans')
    .select('*, student_exams(*)')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .order('generated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data ?? [] })
}
