import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { sm2Update } from '@/lib/spaced-repetition/sm2'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = JSON.parse(await request.text())
  const { conceptKey, quality, timeTakenSeconds } = body

  if (typeof quality !== 'number' || quality < 0 || quality > 5) {
    return NextResponse.json({ error: 'quality must be 0-5' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from('concept_mastery')
    .select('*')
    .eq('user_id', session.user.id)
    .eq('concept_key', conceptKey)
    .single()

  const currentState = existing
    ? { easeFactor: existing.ease_factor, intervalDays: existing.interval_days, repetitions: existing.repetitions }
    : { easeFactor: 2.5, intervalDays: 1, repetitions: 0 }

  const updated = sm2Update(currentState, quality)

  await admin.from('concept_mastery').upsert({
    user_id: session.user.id,
    concept_key: conceptKey,
    ease_factor: updated.easeFactor,
    interval_days: updated.intervalDays,
    repetitions: updated.repetitions,
    next_review_date: updated.nextReviewDate.toISOString().split('T')[0],
    last_quality: quality,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,concept_key' })

  await admin.from('review_sessions').insert({
    user_id: session.user.id,
    concept_key: conceptKey,
    quality,
    time_taken_seconds: timeTakenSeconds ?? null,
  })

  return NextResponse.json({ updated })
}
