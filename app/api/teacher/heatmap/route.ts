import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/server/require-role'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function GET(request: NextRequest) {
  const auth = await requireRole(['teacher', 'admin'])
  if (auth instanceof NextResponse) return auth
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { user } = auth

  const admin = getSupabaseAdmin()

  const { data: students } = await admin
    .from('user_profiles')
    .select('id, display_name')
    .eq('teacher_id', user.id)
    .eq('role', 'school_student')

  if (!students || students.length === 0) {
    return NextResponse.json({ students: [], heatmap: [], atRisk: [] })
  }

  const studentIds = students.map(s => s.id)

  const { data: mastery } = await admin
    .from('concept_mastery')
    .select('user_id, concept_key, ease_factor, subject')
    .in('user_id', studentIds)

  const heatmap: Record<string, Record<string, number>> = {}
  for (const m of mastery ?? []) {
    if (!heatmap[m.concept_key]) heatmap[m.concept_key] = {}
    const score = Math.round(((m.ease_factor - 1.3) / (4.0 - 1.3)) * 100)
    heatmap[m.concept_key][m.user_id] = score
  }

  const atRisk: string[] = []
  for (const studentId of studentIds) {
    const studentMastery = (mastery ?? []).filter(m => m.user_id === studentId)
    const lowCount = studentMastery.filter(m => m.ease_factor < 2.0).length
    if (lowCount >= 3) atRisk.push(studentId)
  }

  return NextResponse.json({ students, heatmap, atRisk })
}
