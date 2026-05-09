import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/server/supabase-admin'
import { BOARD_REGISTRY } from '@/lib/server/board-registry'

const CATEGORY_LABELS: Record<string, string> = {
  academic:     '🎓 Academic',
  professional: '💼 Professional',
  language:     '🌐 Language',
  university:   '🏛️ University Entrance',
  vocational:   '🔧 Vocational',
  other:        '📋 Other',
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data: customBoards } = await admin
    .from('custom_boards')
    .select('name, description, category')
    .eq('is_approved', true)
    .order('name')

  const staticBoards = Object.entries(BOARD_REGISTRY)
    .filter(([name]) => name !== 'Other')
    .map(([name, description]) => ({
      name, description, category: 'academic', isCustom: false,
    }))

  const dynamicBoards = (customBoards ?? []).map(b => ({ ...b, isCustom: true }))
  const customNames = new Set(dynamicBoards.map(b => b.name))

  const all = [
    ...staticBoards.filter(s => !customNames.has(s.name)),
    ...dynamicBoards,
  ].sort((a, b) =>
    a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
  )

  const grouped: Record<string, { name: string; description: string }[]> = {}
  for (const b of all) {
    const label = CATEGORY_LABELS[b.category] ?? b.category
    if (!grouped[label]) grouped[label] = []
    grouped[label].push({ name: b.name, description: b.description })
  }

  return NextResponse.json({ boards: all, grouped })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, description, category = 'other', country } = body

  if (!name?.trim() || !description?.trim()) {
    return NextResponse.json(
      { error: 'name and description are required' },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()
  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const isApproved = ['admin', 'supervisor'].includes(profile?.role ?? '')

  const { data, error } = await admin
    .from('custom_boards')
    .upsert({
      name: name.trim(),
      description: description.trim(),
      category,
      country: country?.trim() || null,
      created_by: session.user.id,
      is_approved: isApproved,
    }, { onConflict: 'name' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    board: data,
    message: isApproved
      ? 'Board added successfully.'
      : 'Board submitted for admin approval.',
  })
}
