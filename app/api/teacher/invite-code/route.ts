import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function verifyTeacher(userId: string): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const { data } = await admin.from('user_profiles').select('role').eq('id', userId).single();
  return data?.role === 'teacher' || data?.role === 'admin';
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await verifyTeacher(user.id)))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('invite_code')
      .eq('id', user.id)
      .single();

    let code = profile?.invite_code;
    if (!code) {
      code = generateCode();
      await admin.from('user_profiles').update({ invite_code: code }).eq('id', user.id);
    }

    return NextResponse.json({ invite_code: code });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await verifyTeacher(user.id)))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const code = generateCode();
    const admin = getSupabaseAdmin();
    await admin.from('user_profiles').update({ invite_code: code }).eq('id', user.id);

    return NextResponse.json({ invite_code: code });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
