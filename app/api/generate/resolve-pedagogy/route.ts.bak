// app/api/generate/resolve-pedagogy/route.ts
// POST — called by the generate form before outline generation begins.
// Returns a PedagogyProfile JSON object.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolvePedagogy } from '@/lib/server/pedagogy-resolver'
import { resolveModelFromHeaders } from '@/lib/server/resolve-model'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = JSON.parse(await request.text())
  const {
    topic = '',
    grade = null,
    subject = '',
    board = 'Other',
    studentContext = '',
    language = 'English',
  } = body

  if (!topic.trim()) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 })
  }

  try {
    const resolvedModel = await resolveModelFromHeaders(request)
    const profile = await resolvePedagogy({
      topic,
      grade: grade ? parseInt(String(grade), 10) : null,
      subject,
      board,
      studentContext,
      language,
      model: resolvedModel.modelString,
    })
    return NextResponse.json(profile)
  } catch (error) {
    console.error('[resolve-pedagogy] error:', error)
    return NextResponse.json(
      { error: 'Pedagogy resolver failed', detail: String(error) },
      { status: 500 }
    )
  }
}
