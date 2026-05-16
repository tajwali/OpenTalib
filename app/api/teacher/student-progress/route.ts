import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET(request: NextRequest) {
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

    const studentId = request.nextUrl.searchParams.get('student_id') || request.nextUrl.searchParams.get('id');
    if (!studentId) return NextResponse.json({ error: 'Missing student_id' }, { status: 400 });

    // Verify student belongs to this teacher
    const { data: student } = await admin
      .from('user_profiles')
      .select('id, display_name, grade, school')
      .eq('id', studentId)
      .eq('teacher_id', user.id)
      .single();

    if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    const [assignmentsRes, quizRes, progressRes] = await Promise.all([
      admin
        .from('course_assignments')
        .select('classroom_id, assigned_at')
        .eq('assigned_to', studentId)
        .eq('assigned_by', user.id),
      admin
        .from('quiz_results')
        .select('classroom_id, score, total, percentage, taken_at')
        .eq('user_id', studentId)
        .order('taken_at', { ascending: false }),
      admin
        .from('course_progress')
        .select('classroom_id, completed, last_accessed')
        .eq('user_id', studentId),
    ]);

    const classroomIds = [
      ...new Set([
        ...(assignmentsRes.data ?? []).map((a) => a.classroom_id),
        ...(quizRes.data ?? []).map((q) => q.classroom_id),
      ]),
    ];

    const { data: classrooms } = classroomIds.length
      ? await admin.from('classrooms').select('id, title').in('id', classroomIds)
      : { data: [] };

    const titleMap = new Map((classrooms ?? []).map((c) => [c.id, c.title] as [string, string]));
    const progressMap = new Map(
      (progressRes.data ?? []).map((p) => [p.classroom_id, p] as [string, typeof p]),
    );

    const quizzesTaken = quizRes.data?.length ?? 0;
    const avgScore =
      quizzesTaken > 0
        ? Math.round(
            (quizRes.data ?? []).reduce((s, q) => s + (q.percentage ?? 0), 0) / quizzesTaken,
          )
        : null;

    const assignments = (assignmentsRes.data ?? []).map((a) => ({
      classroom_id: a.classroom_id,
      classroom_title: titleMap.get(a.classroom_id) ?? a.classroom_id,
      assigned_at: a.assigned_at,
      completed: progressMap.get(a.classroom_id)?.completed ?? false,
      last_accessed: progressMap.get(a.classroom_id)?.last_accessed ?? null,
    }));

    return NextResponse.json({
      student: {
        id: student.id,
        display_name: student.display_name,
        grade: student.grade,
        school: student.school,
      },
      stats: { quizzesTaken, avgScore },
      assignments,
      recentQuizzes: (quizRes.data ?? []).slice(0, 10).map((q) => ({
        classroom_id: q.classroom_id,
        classroom_title: titleMap.get(q.classroom_id) ?? q.classroom_id,
        score: q.score,
        total: q.total,
        percentage: q.percentage,
        taken_at: q.taken_at,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
