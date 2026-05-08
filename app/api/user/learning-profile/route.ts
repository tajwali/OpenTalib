import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const userId = session.user.id

  const [masteryResult, misconceptionsResult, quizResult] = await Promise.all([
    admin
      .from('concept_mastery')
      .select('concept_key, ease_factor, interval_days, repetitions, last_quality, next_review_date, subject')
      .eq('user_id', userId)
      .order('ease_factor', { ascending: true }),
    admin
      .from('misconceptions')
      .select('concept_key, description, frequency, last_seen, resolved')
      .eq('user_id', userId)
      .eq('resolved', false)
      .order('frequency', { ascending: false })
      .limit(10),
    admin
      .from('quiz_results')
      .select('classroom_id, scene_id, percentage, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const mastery = masteryResult.data ?? []
  const avgEaseFactor = mastery.length > 0
    ? mastery.reduce((sum, m) => sum + m.ease_factor, 0) / mastery.length
    : null
  const weakConcepts = mastery
    .filter(m => m.ease_factor < 2.0)
    .map(m => m.concept_key)

  return NextResponse.json({
    mastery,
    misconceptions: misconceptionsResult.data ?? [],
    recentQuizzes: quizResult.data ?? [],
    summary: {
      totalConcepts: mastery.length,
      weakConcepts,
      avgEaseFactor,
      unresolvedMisconceptions: (misconceptionsResult.data ?? []).length,
    },
  })
}
