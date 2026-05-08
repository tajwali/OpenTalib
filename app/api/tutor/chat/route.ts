// app/api/tutor/chat/route.ts
// POST — streaming SSE. In-lesson AI tutor with slide context awareness.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { callLLM } from '@/lib/ai/llm'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'
import { getGradeBand, GRADE_BAND_CONSTRAINTS } from '@/lib/server/grade-band'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = JSON.parse(await request.text())
  const {
    courseId,
    sceneTitle = '',
    sceneText = '',
    messages = [],
    grade = null,
    board = 'Other',
    subject = '',
    agentName = 'your teacher',
    languageMix = 'english-only',
  } = body

  const gradeBand = getGradeBand(grade ? parseInt(String(grade), 10) : null)
  const gradeConstraints = GRADE_BAND_CONSTRAINTS[gradeBand]

  const systemPrompt = `You are ${agentName}, a patient and encouraging ${subject} tutor for a Grade ${grade ?? 'adult'} student preparing for ${board}.

You are helping the student during a lesson on: "${sceneTitle}"

Current lesson content the student is viewing:
${sceneText || '(slide content not provided)'}

YOUR RULES:
1. Respond in language mix: ${languageMix}. Keep vocabulary at Grade ${grade ?? 'adult'} level.
2. Grade band guidance: ${gradeConstraints}
3. NEVER give away the answer to a quiz question directly. Use the Socratic method: ask one guiding question that points toward the answer.
4. If the student is confused, re-explain using a DIFFERENT analogy than any already used in the lesson content above.
5. Keep responses under 120 words unless a worked example is needed. A worked example may be up to 200 words.
6. End every explanation with a single check question such as "Does that make sense?" or "Can you try to explain it back to me in your own words?"
7. If the student asks something completely unrelated to the lesson, gently redirect: "Let's stay focused on today's topic — [topic]. What part is unclear?"
8. Tone: ${gradeBand === 'junior' || gradeBand === 'early' ? 'warm, encouraging, celebratory of effort' : 'professional, encouraging, precise'}.`

  const stream = new ReadableStream({
    async start(controller) {
      const keepAlive = setInterval(() => {
        controller.enqueue(new TextEncoder().encode(': keepalive\n\n'))
      }, 5000)

      try {
        const model = await resolveModelFromHeaders(request)
        const response = await callLLM({
          model: model.model,
          messages,
          system: systemPrompt,
          maxTokens: 400,
        }, 'tutor-chat')

        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify({ text: response.text })}\n\n`)
        )

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
      } catch (error) {
        console.error('[tutor/chat] error:', error)
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ error: 'Tutor unavailable. Please try again.' })}\n\n`
          )
        )
      } finally {
        clearInterval(keepAlive)
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
