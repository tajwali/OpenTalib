import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { data: exam, error } = await admin
      .from('exams')
      .select(
        'id, title, time_limit_minutes, difficulty, created_at, source_classroom_ids, questions, created_by',
      )
      .eq('id', id)
      .single();

    if (error || !exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    const isCreator = exam.created_by === user.id;
    const rawQuestions = Array.isArray(exam.questions) ? exam.questions : [];

    const questions = rawQuestions.map((q: Record<string, unknown>) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      points: (q.points as number) ?? 1,
      ...(isCreator ? { answer: q.answer, analysis: q.analysis } : {}),
    }));

    return NextResponse.json({
      id: exam.id,
      title: exam.title,
      time_limit_minutes: exam.time_limit_minutes,
      difficulty: exam.difficulty,
      created_at: exam.created_at,
      question_count: questions.length,
      questions,
      is_creator: isCreator,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('exams').delete().eq('id', id).eq('created_by', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
