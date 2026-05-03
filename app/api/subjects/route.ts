import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET() {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('subjects')
      .select('id, name, icon, description, is_default')
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['admin', 'teacher', 'mature_student']);
    if ('error' in auth) return auth.error;

    const body = (await req.json()) as { name?: string; icon?: string; description?: string };
    if (!body.name?.trim())
      return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('subjects')
      .insert({
        name: body.name.trim(),
        icon: body.icon ?? '📚',
        description: body.description ?? null,
        created_by: auth.user.id,
        is_default: false,
      })
      .select('id, name, icon, description, is_default')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: subject } = await admin
      .from('subjects')
      .select('is_default')
      .eq('id', id)
      .single();

    if (subject?.is_default) {
      return NextResponse.json({ error: 'Cannot delete default subjects' }, { status: 400 });
    }

    // Null out classrooms referencing this subject
    await admin.from('classrooms').update({ subject_id: null }).eq('subject_id', id);

    const { error } = await admin.from('subjects').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
