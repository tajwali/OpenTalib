import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET() {
  try {
    const auth = await requireRole(['teacher', 'admin']);
    if ('error' in auth) return auth.error;

    const admin = getSupabaseAdmin();

    // Get all exams created by this teacher
    const { data: exams, error: examsError } = await admin
      .from('exams')
      .select('id, title')
      .eq('created_by', auth.user.id)
      .order('created_at', { ascending: false });

    if (examsError) return NextResponse.json({ error: examsError.message }, { status: 500 });
    if (!exams || exams.length === 0) return NextResponse.json([]);

    const examIds = exams.map((e) => e.id as string);

    // Get all results for those exams
    const { data: results, error: resultsError } = await admin
      .from('exam_results')
      .select('exam_id, student_id, score, total_questions, percentage, completed_at')
      .in('exam_id', examIds)
      .order('completed_at', { ascending: false });

    if (resultsError) return NextResponse.json({ error: resultsError.message }, { status: 500 });

    // Get student display names
    const studentIds = [...new Set((results ?? []).map((r) => r.student_id as string))];
    const nameMap = new Map<string, string>();
    if (studentIds.length > 0) {
      const { data: profiles } = await admin
        .from('user_profiles')
        .select('id, display_name')
        .in('id', studentIds);
      for (const p of profiles ?? []) {
        nameMap.set(p.id as string, (p.display_name as string) ?? 'Unknown');
      }
    }

    // Group results by exam
    const resultsByExam = new Map<string, typeof results>();
    for (const exam of exams) {
      resultsByExam.set(exam.id as string, []);
    }
    for (const r of results ?? []) {
      const list = resultsByExam.get(r.exam_id as string);
      if (list) list.push(r);
    }

    return NextResponse.json(
      exams.map((e) => ({
        exam_id: e.id,
        exam_title: e.title,
        results: (resultsByExam.get(e.id as string) ?? []).map((r) => ({
          student_name: nameMap.get(r.student_id as string) ?? 'Unknown',
          score: r.score,
          total_questions: r.total_questions,
          percentage: r.percentage,
          completed_at: r.completed_at,
        })),
      })),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
