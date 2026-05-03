import { NextRequest, NextResponse } from 'next/server';
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
    const { data, error } = await admin
      .from('course_progress')
      .select('classroom_id, completed, last_scene_id, last_accessed')
      .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { classroom_id } = (await request.json()) as { classroom_id?: string };
    if (!classroom_id) return NextResponse.json({ error: 'Missing classroom_id' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // 1. Update last_accessed
    await admin
      .from('course_progress')
      .upsert(
        { user_id: user.id, classroom_id, last_accessed: new Date().toISOString() },
        { onConflict: 'user_id,classroom_id' },
      );

    // 2. Re-evaluate completion
    const isCompleted = await evaluateCompletion(user.id, classroom_id, admin);
    if (isCompleted) {
      await admin
        .from('course_progress')
        .update({ completed: true })
        .eq('user_id', user.id)
        .eq('classroom_id', classroom_id);
    }

    return NextResponse.json({ success: true, completed: isCompleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      classroom_id?: string;
      last_scene_id?: string;
      scene_viewed?: string;
    };
    if (!body.classroom_id)
      return NextResponse.json({ error: 'Missing classroom_id' }, { status: 400 });

    const admin = getSupabaseAdmin();

    // Fetch current progress to update scenes_completed array
    const { data: current } = await admin
      .from('course_progress')
      .select('scenes_completed')
      .eq('user_id', user.id)
      .eq('classroom_id', body.classroom_id)
      .single();

    let scenes_completed = current?.scenes_completed || [];
    if (body.scene_viewed && !scenes_completed.includes(body.scene_viewed)) {
      scenes_completed = [...scenes_completed, body.scene_viewed];
    }

    const updateData: any = {
      user_id: user.id,
      classroom_id: body.classroom_id,
      last_accessed: new Date().toISOString(),
      scenes_completed,
    };
    if (body.last_scene_id) updateData.last_scene_id = body.last_scene_id;

    // Save update
    await admin.from('course_progress').upsert(updateData, { onConflict: 'user_id,classroom_id' });

    // Final check for completion
    const isCompleted = await evaluateCompletion(user.id, body.classroom_id, admin);
    if (isCompleted) {
      await admin
        .from('course_progress')
        .update({ completed: true })
        .eq('user_id', user.id)
        .eq('classroom_id', body.classroom_id);
    }

    return NextResponse.json({ success: true, completed: isCompleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

async function evaluateCompletion(userId: string, classroomId: string, admin: any) {
  const { data: classroom } = await admin
    .from('classrooms')
    .select('scenes')
    .eq('id', classroomId)
    .single();
  if (!classroom) return false;

  const scenes = (classroom.scenes as any[]) || [];
  const totalScenes = scenes.length;
  if (totalScenes === 0) return false;

  // Count quiz scenes in classroom.scenes where scene.content.type === 'quiz'
  const quizScenes = scenes.filter((s) => s.type === 'quiz' || s.content?.type === 'quiz');
  const totalQuizzes = quizScenes.length;

  if (totalQuizzes > 0) {
    // Count completed quizzes from quiz_results for this user and classroom
    const { data: results } = await admin
      .from('quiz_results')
      .select('scene_id')
      .eq('user_id', userId)
      .eq('classroom_id', classroomId);

    const completedQuizIds = new Set((results || []).map((r: any) => r.scene_id));
    // Only set completed = true if completedQuizzes >= totalQuizzes && totalQuizzes > 0
    return quizScenes.every((s) => completedQuizIds.has(s.id));
  } else {
    // If course has no quizzes -> completed when all scenes viewed (scenes_completed.length >= totalScenes)
    const { data: progress } = await admin
      .from('course_progress')
      .select('scenes_completed')
      .eq('user_id', userId)
      .eq('classroom_id', classroomId)
      .single();

    const viewed = (progress?.scenes_completed as string[]) || [];
    return viewed.length >= totalScenes;
  }
}
