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

    // Fetch exams created by user OR assigned to user
    const { data, error } = await admin
      .from('exams')
      .select(
        'id, title, time_limit_minutes, difficulty, created_at, source_classroom_ids, questions, assigned_to',
      )
      .or(`created_by.eq.${user.id},assigned_to.cs.{${user.id}}`)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const examIds = (data ?? []).map((e) => e.id as string);
    const { data: results } = examIds.length
      ? await admin
          .from('exam_results')
          .select('exam_id, score, total_questions, percentage, submitted_at')
          .in('exam_id', examIds)
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false })
      : { data: [] };

    // Keep only the most recent result per exam
    const resultMap = new Map<
      string,
      { score: number; total_questions: number; percentage: number; submitted_at: string }
    >();
    for (const r of results ?? []) {
      if (!resultMap.has(r.exam_id as string)) {
        resultMap.set(r.exam_id as string, {
          score: r.score as number,
          total_questions: r.total_questions as number,
          percentage: r.percentage as number,
          submitted_at: r.submitted_at as string,
        });
      }
    }

    return NextResponse.json(
      (data ?? []).map((e) => ({
        id: e.id,
        title: e.title,
        time_limit_minutes: e.time_limit_minutes,
        difficulty: e.difficulty,
        created_at: e.created_at,
        source_classroom_ids: e.source_classroom_ids,
        question_count: Array.isArray(e.questions) ? e.questions.length : 0,
        attempted: resultMap.has(e.id as string),
        result: resultMap.get(e.id as string) ?? null,
      })),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
