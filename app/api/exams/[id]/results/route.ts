import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

interface SubmittedAnswer {
  questionId: string;
  answer: string | string[];
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as {
      answers?: SubmittedAnswer[];
      time_taken_seconds?: number;
    };
    const { answers = [], time_taken_seconds } = body;

    const admin = getSupabaseAdmin();
    const { data: exam, error } = await admin
      .from('exams')
      .select('id, questions')
      .eq('id', id)
      .single();

    if (error || !exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

    const questions = Array.isArray(exam.questions)
      ? (exam.questions as Record<string, unknown>[])
      : [];
    const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));

    let score = 0;
    const total = questions.reduce((s, q) => s + ((q.points as number) ?? 1), 0);

    const gradedAnswers = questions.map((q) => {
      const qId = q.id as string;
      const submitted = answerMap.get(qId);
      const points = (q.points as number) ?? 1;
      let earned = 0;
      let correct = false;

      if (q.type === 'single' && Array.isArray(q.answer)) {
        const submittedStr = Array.isArray(submitted) ? submitted[0] : (submitted as string);
        correct = submittedStr === (q.answer as string[])[0];
        earned = correct ? points : 0;
      } else if (q.type === 'multiple' && Array.isArray(q.answer)) {
        const submittedArr = Array.isArray(submitted) ? [...submitted].sort() : [];
        const correctArr = [...(q.answer as string[])].sort();
        correct = JSON.stringify(submittedArr) === JSON.stringify(correctArr);
        earned = correct ? points : 0;
      }
      // short_answer: earned stays 0 (shown for self-review)

      score += earned;
      return {
        questionId: qId,
        question: q.question,
        submitted,
        correctAnswer: q.answer,
        analysis: q.analysis,
        earned,
        points,
        correct,
      };
    });

    const percentage = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;

    const { data: result, error: insertError } = await admin
      .from('exam_results')
      .insert({
        exam_id: id,
        student_id: user.id,
        score,
        total_questions: questions.length,
        percentage,
        time_taken_seconds: time_taken_seconds ?? null,
        answers: gradedAnswers,
      })
      .select('id')
      .single();

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    return NextResponse.json({
      result_id: result.id,
      score,
      total,
      percentage,
      answers: gradedAnswers,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

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
    const { data } = await admin
      .from('exam_results')
      .select('id, score, total_questions, percentage, time_taken_seconds, answers, completed_at')
      .eq('exam_id', id)
      .eq('student_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json(data ?? null);
  } catch {
    return NextResponse.json(null);
  }
}
