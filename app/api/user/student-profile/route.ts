import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { STUDENT_CONTEXT_TAGS } from '@/lib/student-context-tags'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const targetUserId = searchParams.get('userId') ?? session.user.id
  const admin = getSupabaseAdmin()

  if (targetUserId !== session.user.id) {
    const { data: target } = await admin
      .from('user_profiles').select('teacher_id').eq('id', targetUserId).single()
    const { data: requester } = await admin
      .from('user_profiles').select('role').eq('id', session.user.id).single()
    const ok = target?.teacher_id === session.user.id
      || ['admin','supervisor'].includes(requester?.role ?? '')
    if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: profile } = await admin
    .from('student_profiles').select('*').eq('user_id', targetUserId).maybeSingle()

  let contextString = ''
  if (profile) {
    const labels = STUDENT_CONTEXT_TAGS
      .filter(t => (profile.context_tags ?? []).includes(t.id))
      .map(t => t.label)
    contextString = [...labels,
      ...(profile.custom_context ? [profile.custom_context] : [])
    ].join(', ')
  }

  return NextResponse.json({ profile: profile ?? null, contextString, exists: !!profile })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    userId, age, gender, primaryBoard, secondaryBoard, targetGrade,
    currentGrade, instructionLanguage, homeLanguage, englishProficiency,
    contextTags, customContext, preferredVoice, preferredPace,
  } = body

  const admin = getSupabaseAdmin()
  const targetId = userId ?? session.user.id

  if (targetId !== session.user.id) {
    const { data: target } = await admin
      .from('user_profiles').select('teacher_id').eq('id', targetId).single()
    const { data: req } = await admin
      .from('user_profiles').select('role').eq('id', session.user.id).single()
    if (target?.teacher_id !== session.user.id
      && !['admin','supervisor'].includes(req?.role ?? ''))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('student_profiles')
    .upsert({
      user_id: targetId,
      age: age ? parseInt(String(age), 10) : null,
      gender: gender ?? null,
      primary_board: primaryBoard ?? null,
      secondary_board: secondaryBoard ?? null,
      target_grade: targetGrade ?? null,
      current_grade: currentGrade ? parseInt(String(currentGrade), 10) : null,
      instruction_language: instructionLanguage ?? 'English',
      home_language: homeLanguage ?? null,
      english_proficiency: englishProficiency ?? null,
      context_tags: contextTags ?? [],
      custom_context: customContext ?? null,
      preferred_voice: preferredVoice ?? null,
      preferred_pace: preferredPace ?? 'normal',
    }, { onConflict: 'user_id' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
