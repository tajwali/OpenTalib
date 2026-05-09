// app/api/exam/sessions/[sessionId]/submit/route.ts
// POST — submit exam answers and trigger AI marking

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'
import { callLLM } from '@/lib/ai/llm'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = JSON.parse(await request.text())
  const { answers } = body
  // answers: { [questionId]: string }

  const admin = getSupabaseAdmin()
  const { sessionId } = await params

  // Verify session belongs to user
  const { data: examSession } = await admin
    .from('exam_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', session.user.id)
    .single()

  if (!examSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  if (examSession.status !== 'active') {
    return NextResponse.json({ error: 'Session already submitted' }, { status: 400 })
  }

  // Get result rows for this session
  const { data: results } = await admin
    .from('exam_results')
    .select('*')
    .eq('session_id', sessionId)

  if (!results) {
    return NextResponse.json({ error: 'No results found' }, { status: 404 })
  }

  // Mark each answer with AI
  const resolvedModel = await resolveModelFromHeaders(request)
  let totalScored = 0

  for (const result of results) {
    const studentAnswer = answers[result.question_id] ?? ''

    const markingPrompt = `You are an examiner for ${examSession.board} ${examSession.subject}.

QUESTION: ${result.question_text}

MARK SCHEME: ${result.mark_scheme}

MARKS AVAILABLE: ${result.marks_available}

STUDENT ANSWER: ${studentAnswer || '(no answer provided)'}

Mark this answer strictly against the mark scheme.
Return ONLY valid JSON:
{
  "marks_awarded": <number 0 to ${result.marks_available}>,
  "feedback": "<specific feedback explaining marks earned and lost, max 3 sentences>"
}`

    try {
      const response = await callLLM(
        {
          model: resolvedModel.model,
          messages: [{ role: 'user', content: markingPrompt }],
          maxTokens: 300,
        },
        'exam-marking'
      )

      const rawText = response.text

      const jsonText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const marking = JSON.parse(jsonText)
      const marksAwarded = Math.min(
        Math.max(0, parseInt(String(marking.marks_awarded ?? 0), 10)),
        result.marks_available
      )

      totalScored += marksAwarded

      await admin.from('exam_results').update({
        student_answer: studentAnswer,
        marks_awarded: marksAwarded,
        ai_feedback: marking.feedback ?? '',
        marked_at: new Date().toISOString(),
      }).eq('id', result.id)

    } catch (e) {
      console.error('[exam/submit] marking error:', e)
      // Non-fatal — award 0 for this question if marking fails
      await admin.from('exam_results').update({
        student_answer: studentAnswer,
        marks_awarded: 0,
        ai_feedback: 'Marking unavailable for this question.',
        marked_at: new Date().toISOString(),
      }).eq('id', result.id)
    }
  }

  // Update session status
  const scorePercent = Math.round((totalScored / examSession.total_marks) * 100)
  await admin.from('exam_sessions').update({
    submitted_at: new Date().toISOString(),
    scored_marks: totalScored,
    status: 'marked',
  }).eq('id', sessionId)

  // Fetch final results
  const { data: finalResults } = await admin
    .from('exam_results')
    .select('*')
    .eq('session_id', sessionId)

  return NextResponse.json({
    sessionId,
    scoredMarks: totalScored,
    totalMarks: examSession.total_marks,
    scorePercent,
    results: finalResults ?? [],
  })
}
