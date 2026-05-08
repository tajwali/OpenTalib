import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await admin
    .from('concept_mastery')
    .select('*')
    .eq('user_id', session.user.id)
    .lte('next_review_date', today)
    .order('next_review_date', { ascending: true })
    .limit(8)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ queue: data ?? [] })
}
