import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = JSON.parse(await request.text())
  const { conceptKeys, courseId, subject } = body

  if (!Array.isArray(conceptKeys) || conceptKeys.length === 0) {
    return NextResponse.json({ seeded: 0 })
  }

  const admin = getSupabaseAdmin()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const rows = conceptKeys.map((key: string) => ({
    user_id: session.user.id,
    concept_key: key,
    course_id: courseId ?? null,
    subject: subject ?? null,
    ease_factor: 2.5,
    interval_days: 1,
    repetitions: 0,
    next_review_date: tomorrowStr,
  }))

  const { error } = await admin
    .from('concept_mastery')
    .upsert(rows, { onConflict: 'user_id,concept_key', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ seeded: rows.length })
}
