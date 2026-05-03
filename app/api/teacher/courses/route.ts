import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'teacher' && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await admin
      .from('classrooms')
      .select(
        'id, title, short_title, topic, status, created_at, grade, subject_id, subjects(name, icon)',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (data ?? []).map((c: Record<string, unknown>) => {
      const subjectRow = c.subjects as { name: string; icon: string } | null;
      return {
        id: c.id,
        title: c.title,
        short_title: c.short_title ?? null,
        topic: c.topic,
        status: c.status,
        created_at: c.created_at,
        grade: c.grade ?? null,
        subject_id: c.subject_id ?? null,
        subject_name: subjectRow?.name ?? null,
        subject_icon: subjectRow?.icon ?? null,
      };
    });

    return NextResponse.json(mapped);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
