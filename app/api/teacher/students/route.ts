import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const GOTRUE_URL = process.env.SUPABASE_AUTH_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

async function gotrueAdmin(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${GOTRUE_URL}/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(options.headers ?? {}),
    },
  });
}

export async function GET() {
  try {
    const auth = await requireRole(['teacher', 'admin']);
    if ('error' in auth) return auth.error;

    const admin = getSupabaseAdmin();

    // Get all students under this teacher
    const { data: students } = await admin
      .from('user_profiles')
      .select('id, display_name, grade, school')
      .eq('teacher_id', auth.user.id);

    if (!students || students.length === 0) {
      return NextResponse.json([]);
    }

    const studentIds = students.map((s) => s.id);

    // Get assignment counts per student
    const { data: assignments } = await admin
      .from('course_assignments')
      .select('assigned_to')
      .eq('assigned_by', auth.user.id)
      .in('assigned_to', studentIds);

    const assignmentCounts: Record<string, number> = {};
    for (const a of assignments ?? []) {
      assignmentCounts[a.assigned_to] = (assignmentCounts[a.assigned_to] ?? 0) + 1;
    }

    // Get last quiz score per student
    const { data: quizRows } = await admin
      .from('quiz_results')
      .select('user_id, percentage, taken_at')
      .in('user_id', studentIds)
      .order('taken_at', { ascending: false });

    const lastQuiz: Record<string, { percentage: number; taken_at: string }> = {};
    for (const q of quizRows ?? []) {
      if (!lastQuiz[q.user_id])
        lastQuiz[q.user_id] = { percentage: q.percentage, taken_at: q.taken_at };
    }

    // Get last accessed per student
    const { data: progressRows } = await admin
      .from('course_progress')
      .select('user_id, last_accessed')
      .in('user_id', studentIds)
      .order('last_accessed', { ascending: false });

    const lastAccessed: Record<string, string> = {};
    for (const p of progressRows ?? []) {
      if (!lastAccessed[p.user_id]) lastAccessed[p.user_id] = p.last_accessed;
    }

    const result = students.map((s) => ({
      id: s.id,
      display_name: s.display_name,
      grade: s.grade,
      school: s.school,
      coursesAssigned: assignmentCounts[s.id] ?? 0,
      lastQuizScore: lastQuiz[s.id]?.percentage ?? null,
      lastAccessed: lastAccessed[s.id] ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(['teacher']);
    if ('error' in auth) return auth.error;

    const body = (await req.json()) as {
      student_id?: string;
      display_name?: string;
      grade?: string;
      new_password?: string;
    };
    if (!body.student_id)
      return NextResponse.json({ error: 'student_id is required' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // Verify this student belongs to the requesting teacher
    const { data: profile, error: profileError } = await admin
      .from('user_profiles')
      .select('id, teacher_id')
      .eq('id', body.student_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }
    if (profile.teacher_id !== auth.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Profile field updates
    const profileUpdates: Record<string, unknown> = {};
    if (body.display_name !== undefined) {
      const name = body.display_name.trim();
      if (!name)
        return NextResponse.json({ error: 'display_name cannot be empty' }, { status: 400 });
      profileUpdates.display_name = name;
    }
    if (body.grade !== undefined) {
      profileUpdates.grade = body.grade ? parseInt(String(body.grade)) || null : null;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error } = await admin
        .from('user_profiles')
        .update(profileUpdates)
        .eq('id', body.student_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Password update via GoTrue admin
    if (body.new_password !== undefined) {
      if (body.new_password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 },
        );
      }
      const res = await gotrueAdmin(`/users/${body.student_id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: body.new_password }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { msg?: string };
        return NextResponse.json(
          { error: errBody.msg ?? 'Failed to update password' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
