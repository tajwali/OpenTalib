import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';

function extractSceneText(scenes: unknown[]): string {
  return scenes
    .map((scene: unknown) => {
      const s = scene as Record<string, unknown>;
      const parts: string[] = [`Scene: ${s.title ?? 'Untitled'}`];

      // Primary source: actions array carries narration/speech/whiteboard text
      // Speech actions (type='speech') have action.text with full narration
      // Discussion actions have action.topic and action.prompt
      // Whiteboard text actions (type='wb_draw_text') have action.content
      if (Array.isArray(s.actions)) {
        for (const rawA of s.actions as unknown[]) {
          const a = rawA as Record<string, unknown>;
          if (a.type === 'speech' && a.text) {
            parts.push(String(a.text).trim());
          } else if (a.type === 'discussion') {
            if (a.topic) parts.push(`Discussion: ${String(a.topic).trim()}`);
            if (a.prompt) parts.push(String(a.prompt).trim());
          } else if (a.type === 'wb_draw_text' && a.content) {
            const wbText = String(a.content)
              .replace(/<[^>]+>/g, '')
              .trim();
            if (wbText) parts.push(wbText);
          }
        }
      }

      // Secondary: quiz scene questions (content.type === 'quiz')
      const content = s.content as Record<string, unknown> | undefined;
      if (content?.type === 'quiz') {
        const questions = (content.questions as unknown[]) ?? [];
        for (const rawQ of questions) {
          const q = rawQ as Record<string, unknown>;
          if (q.question) parts.push(`Q: ${q.question}`);
          if (Array.isArray(q.options)) {
            for (const rawO of q.options) {
              const o = rawO as Record<string, string>;
              parts.push(`  ${o.value}: ${o.label}`);
            }
          }
          if (Array.isArray(q.answer)) parts.push(`Answer: ${q.answer.join(', ')}`);
          if (q.analysis) parts.push(`Explanation: ${q.analysis}`);
        }
      }

      return parts.join('\n');
    })
    .filter((block) => block.trim().length > 0)
    .join('\n\n');
}

export async function POST(req: NextRequest) {
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

    if (profile?.role === 'school_student') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as {
      classroom_ids?: string[];
      num_questions?: number;
      difficulty?: string;
      time_limit_minutes?: number;
      title?: string;
    };
    const {
      classroom_ids = [],
      num_questions = 10,
      difficulty = 'mixed',
      time_limit_minutes = 30,
      title,
    } = body;

    if (!classroom_ids.length) {
      return NextResponse.json({ error: 'Please select at least one course' }, { status: 400 });
    }

    const { data: classrooms } = await admin
      .from('classrooms')
      .select('id, title, scenes')
      .in('id', classroom_ids);

    if (!classrooms?.length) {
      return NextResponse.json({ error: 'No valid classrooms found' }, { status: 400 });
    }

    const allScenes: unknown[] = classrooms.flatMap((c) => (c.scenes as unknown[]) ?? []);
    const courseContext = extractSceneText(allScenes);

    if (courseContext.trim().length < 100) {
      return NextResponse.json(
        {
          error:
            'No course content found. Please open and complete a course first so its content is saved.',
        },
        { status: 400 },
      );
    }

    const courseTitles = classrooms.map((c) => c.title as string).join(', ');
    const examTitle = title || `Exam: ${courseTitles}`;

    const { model: languageModel } = await resolveModelFromHeaders(req);

    const difficultyNote =
      difficulty === 'easy'
        ? 'use straightforward recall questions'
        : difficulty === 'hard'
          ? 'use analytical and application questions'
          : 'mix easy, medium, and hard questions';

    const systemPrompt = `You are an educational exam creator. Generate exam questions based on course content.
Return ONLY valid JSON matching this exact format:
{
  "questions": [
    {
      "id": "q1",
      "type": "single",
      "question": "Question text here",
      "options": [
        {"value": "A", "label": "Option A text"},
        {"value": "B", "label": "Option B text"},
        {"value": "C", "label": "Option C text"},
        {"value": "D", "label": "Option D text"}
      ],
      "answer": ["A"],
      "analysis": "Explanation of the correct answer",
      "points": 1
    }
  ]
}
Types allowed: "single" (one correct answer), "multiple" (multiple correct, answer array has 2+ values), "short_answer" (no options, no answer key, points=2).
For difficulty "${difficulty}": ${difficultyNote}.
Generate exactly ${num_questions} questions.`;

    const userPrompt = `Create ${num_questions} exam questions from this course content:\n\n${courseContext.slice(0, 8000)}\n\nGenerate ${num_questions} questions covering the key concepts.`;

    const result = await callLLM(
      { model: languageModel, system: systemPrompt, prompt: userPrompt },
      'exam-generate',
    );

    let questions: unknown[];
    try {
      const jsonMatch = result.text.trim().match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      const parsed = JSON.parse(jsonMatch[0]) as { questions?: unknown[] };
      questions = parsed.questions ?? [];
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    if (!questions.length) {
      return NextResponse.json({ error: 'No questions generated' }, { status: 500 });
    }

    const { data: exam, error } = await admin
      .from('exams')
      .insert({
        created_by: user.id,
        title: examTitle.slice(0, 200),
        source_classroom_ids: classroom_ids,
        questions,
        time_limit_minutes,
        difficulty,
        is_self_exam: true,
      })
      .select('id, title')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ id: exam.id, title: exam.title, question_count: questions.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
