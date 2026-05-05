import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { generateCourseTitle, classifySubject } from '@/lib/server/classroom-utils';
import { createLogger } from '@/lib/logger';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import { promises as fs } from 'fs';
import path from 'path';

const log = createLogger('ClassroomsAPI');

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as {
      id?: string;
      title?: string;
      shortTitle?: string;
      topic?: string;
      scenes?: unknown;
      grade?: string | null;
      subjectId?: string | null;
      /** init: true skips LLM title generation — used for the early placeholder upsert */
      init?: boolean;
    };
    const { id, title, shortTitle: bodyShortTitle, topic, scenes, grade, subjectId, init } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing required field: id' }, { status: 400 });
    }

    const requirement = topic ?? title ?? '';

    // Collect scene titles for LLM title generation
    const sceneOutlineTitles: string[] = [];
    if (Array.isArray(scenes)) {
      for (const scene of scenes as Record<string, unknown>[]) {
        if (scene.title && typeof scene.title === 'string') sceneOutlineTitles.push(scene.title);
      }
    }

    // init=true: placeholder upsert at generation start — skip LLM to avoid blocking generation
    // Final save (init=false/undefined) runs LLM title generation with real scene titles
    let finalTitle: string;
    let shortTitle: string | null;
    if (init) {
      finalTitle = (bodyShortTitle || title || requirement || 'Untitled Course').slice(0, 100);
      shortTitle = (bodyShortTitle || requirement).slice(0, 60) || null;
      log.info(`Course placeholder created for ${id}: "${finalTitle}"`);
    } else {
      // If we already have a good shortTitle from the stream, use it as the main title too
      // otherwise run the LLM title generation (which is more descriptive/human)
      const generatedTitle =
        bodyShortTitle || (await generateCourseTitle(requirement, sceneOutlineTitles));
      finalTitle = (generatedTitle || title || requirement || 'Untitled Course').slice(0, 100);
      shortTitle = (bodyShortTitle || sceneOutlineTitles[0] || requirement).slice(0, 60) || null;
      log.info(`Course title for ${id}: "${finalTitle}"`);
    }

    // Use provided subjectId or fall back to AI classification (done below)
    const manualSubjectId = subjectId ?? null;

    const admin = getSupabaseAdmin();
    const { error } = await admin.from('classrooms').upsert(
      {
        id,
        user_id: user.id,
        title: finalTitle,
        short_title: shortTitle,
        topic: requirement.slice(0, 500),
        scenes: scenes ?? [],
        status: 'complete',
        grade: grade ? parseInt(String(grade).replace(/[^0-9]/g, '')) || null : null,
        subject_id: manualSubjectId,
      },
      { onConflict: 'id' },
    );

    if (error) {
      log.error(`Classroom upsert failed for ${id}:`, error.message, error.code, error.details);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no subject was manually chosen, classify in background (skip for init placeholders)
    if (!init && !manualSubjectId) {
      void (async () => {
        try {
          const classifiedId = await classifySubject(finalTitle, requirement);
          log.info(`Subject classification for ${id}: ${classifiedId ?? 'null (unclassified)'}`);
          if (classifiedId) {
            await admin.from('classrooms').update({ subject_id: classifiedId }).eq('id', id);
          }
        } catch (err) {
          log.warn(
            `Background subject classification failed for ${id}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      })();
    } else {
      log.info(`Subject manually set for ${id}: ${manualSubjectId}`);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    log.error(
      'POST /api/user/classrooms unhandled error:',
      err instanceof Error ? err.message : String(err),
    );
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

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('classrooms')
      .select(
        'id, title, short_title, topic, status, created_at, subject_id, grade, subjects(name, icon)',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (data ?? []).map((c: Record<string, unknown>) => {
      const subjectRow = c.subjects as { name: string; icon: string } | null;
      return {
        id: c.id,
        title: c.title,
        short_title: c.short_title ?? null,
        topic: c.topic,
        status: c.status,
        created_at: c.created_at,
        subject_id: c.subject_id ?? null,
        subject_name: subjectRow?.name ?? null,
        subject_icon: subjectRow?.icon ?? null,
        grade: c.grade ?? null,
      };
    });

    return NextResponse.json(mapped);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const admin = getSupabaseAdmin();
    const { data: existing } = await admin
      .from('classrooms')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { error } = await admin.from('classrooms').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Cleanup files
    try {
      const jsonPath = path.join(CLASSROOMS_DIR, `${id}.json`);
      const mediaDir = path.join(CLASSROOMS_DIR, id);

      await fs.rm(jsonPath, { force: true });
      await fs.rm(mediaDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      log.error('Cleanup failed during course deletion', { id, error: cleanupErr });
      // We don't return error here because DB record is already gone,
      // and we want the UI to reflect the successful primary action.
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
