// app/api/exam/sessions/route.ts
// POST — start a new mock exam session
// GET  — list user's exam sessions

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = JSON.parse(await request.text())
  const { board, subject, grade, durationMinutes = 60, questionIds = [] } = body

  if (!board || !subject) {
    return NextResponse.json({ error: 'board and subject required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Get questions — either specified IDs or fetch by board/subject/grade
  let questions: any[] = []
  if (questionIds.length > 0) {
    const { data } = await admin
      .from('exam_questions')
      .select('*')
      .in('id', questionIds)
    questions = data ?? []
  } else {
    const query = admin
      .from('exam_questions')
      .select('*')
      .eq('board', board)
      .eq('subject', subject)
      .order('difficulty', { ascending: false })
      .limit(10)
    if (grade) query.eq('grade', parseInt(String(grade), 10))
    const { data } = await query
    questions = data ?? []
  }

  if (questions.length === 0) {
    return NextResponse.json(
      { error: 'No questions found. Generate questions first.' },
      { status: 404 }
    )
  }

  const totalMarks = questions.reduce((sum, q) => sum + (q.marks ?? 1), 0)

  // Create session
  const { data: examSession, error } = await admin
    .from('exam_sessions')
    .insert({
      user_id: session.user.id,
      board,
      subject,
      grade: grade ? parseInt(String(grade), 10) : null,
      duration_minutes: durationMinutes,
      total_marks: totalMarks,
      status: 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create empty result rows for each question
  const resultRows = questions.map(q => ({
    session_id: examSession.id,
    user_id: session.user.id,
    question_id: q.id,
    question_text: q.question_text,
    mark_scheme: q.mark_scheme,
    marks_available: q.marks ?? 1,
  }))

  await admin.from('exam_results').insert(resultRows)

  return NextResponse.json({
    session: examSession,
    questions: questions.map(q => ({
      id: q.id,
      question_text: q.question_text,
      marks: q.marks,
      question_type: q.question_type,
    })),
    totalMarks,
    durationMinutes,
  })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('exam_sessions')
    .select('*')
    .eq('user_id', session.user.id)
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sessions: data ?? [] })
}
