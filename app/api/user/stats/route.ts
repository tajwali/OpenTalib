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

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const [coursesRes, assignedRes, quizRes, progressRes, profileRes] = await Promise.all([
      admin.from('classrooms').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      admin
        .from('course_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id),
      admin.from('quiz_results').select('percentage').eq('user_id', user.id),
      admin
        .from('course_progress')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('completed', true),
      admin.from('user_profiles').select('role').eq('id', user.id).single(),
    ]);

    const totalCourses = coursesRes.count ?? 0;
    const assignedCourses = assignedRes.count ?? 0;
    const coursesCompleted = progressRes.count ?? 0;
    const quizRows = quizRes.data ?? [];
    const quizzesTaken = quizRows.length;
    const avgScore: number | null =
      quizzesTaken > 0
        ? Math.round(
            quizRows.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) / quizzesTaken,
          )
        : null;

    const role = profileRes.data?.role;

    // For teacher: count students
    let studentCount: number | undefined;
    if (role === 'teacher') {
      const { count } = await admin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', user.id);
      studentCount = count ?? 0;
    }

    // For admin: count all users
    let totalUsers: number | undefined;
    if (role === 'admin') {
      const { count } = await admin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true });
      totalUsers = count ?? 0;
    }

    return NextResponse.json({
      totalCourses,
      assignedCourses,
      quizzesTaken,
      avgScore,
      coursesCompleted,
      ...(studentCount !== undefined ? { studentCount } : {}),
      ...(totalUsers !== undefined ? { totalUsers } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
