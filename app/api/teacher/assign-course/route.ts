import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function POST(request: Request) {
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

    const body = (await request.json()) as {
      classroom_id?: string;
      student_ids?: string[];
    };
    const { classroom_id, student_ids } = body;

    if (!classroom_id || !student_ids?.length) {
      return NextResponse.json({ error: 'Missing classroom_id or student_ids' }, { status: 400 });
    }

    // Verify classroom belongs to this teacher
    const { data: classroom } = await admin
      .from('classrooms')
      .select('id')
      .eq('id', classroom_id)
      .eq('user_id', user.id)
      .single();

    if (!classroom) {
      return NextResponse.json(
        { error: 'Classroom not found or not owned by you' },
        { status: 404 },
      );
    }

    // Verify all students belong to this teacher
    const { data: validStudents } = await admin
      .from('user_profiles')
      .select('id')
      .eq('teacher_id', user.id)
      .in('id', student_ids);

    const validIds = new Set((validStudents ?? []).map((s) => s.id));
    const rows = student_ids
      .filter((sid) => validIds.has(sid))
      .map((sid) => ({
        classroom_id,
        assigned_to: sid,
        assigned_by: user.id,
      }));

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid students' }, { status: 400 });
    }

    const { error } = await admin
      .from('course_assignments')
      .upsert(rows, { onConflict: 'classroom_id,assigned_to' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ assigned: rows.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
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

    const body = (await request.json()) as {
      classroom_id?: string;
      student_id?: string;
    };
    const { classroom_id, student_id } = body;

    if (!classroom_id || !student_id) {
      return NextResponse.json({ error: 'Missing classroom_id or student_id' }, { status: 400 });
    }

    let query = admin
      .from('course_assignments')
      .delete()
      .eq('classroom_id', classroom_id)
      .eq('assigned_to', student_id);

    // Admins can unassign any course; teachers can only unassign their own
    if (profile.role !== 'admin') {
      query = query.eq('assigned_by', user.id);
    }

    const { error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

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

    const { data: assignments, error } = await admin
      .from('course_assignments')
      .select('id, classroom_id, assigned_to, assigned_at')
      .eq('assigned_by', user.id)
      .order('assigned_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!assignments?.length) return NextResponse.json([]);

    const classroomIds = [...new Set(assignments.map((a) => a.classroom_id))];
    const studentIds = [...new Set(assignments.map((a) => a.assigned_to))];

    const [{ data: classrooms }, { data: studentProfiles }] = await Promise.all([
      admin.from('classrooms').select('id, title').in('id', classroomIds),
      admin.from('user_profiles').select('id, display_name').in('id', studentIds),
    ]);

    const classroomMap = new Map(
      (classrooms ?? []).map((c) => [c.id, c.title] as [string, string]),
    );
    const studentMap = new Map(
      (studentProfiles ?? []).map((s) => [s.id, s.display_name] as [string, string]),
    );

    const result = assignments.map((a) => ({
      id: a.id,
      classroom_id: a.classroom_id,
      classroom_title: classroomMap.get(a.classroom_id) ?? a.classroom_id,
      student_id: a.assigned_to,
      student_name: studentMap.get(a.assigned_to) ?? 'Unknown',
      assigned_at: a.assigned_at,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
