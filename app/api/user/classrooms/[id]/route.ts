import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';

/**
 * PATCH /api/user/classrooms/:id
 * Incrementally updates the scenes column for an existing classroom.
 * Used by scene generators to persist scenes as they complete, so a
 * tab-close or server restart mid-generation doesn't lose progress.
 * Always returns success — if the row doesn't exist yet (init POST still
 * in-flight) the UPDATE silently affects 0 rows; the final POST creates it.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { scenes, subjectId, grade } = (await req.json()) as {
      scenes?: unknown[];
      subjectId?: string | null;
      grade?: string | number | null;
    };

    const updateData: Record<string, unknown> = {};
    if (scenes !== undefined) updateData.scenes = scenes;
    if (subjectId !== undefined) updateData.subject_id = subjectId;
    if (grade !== undefined) updateData.grade = grade;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: true });
    }

    const admin = getSupabaseAdmin();
    // Silent UPDATE — no error surfaced if row doesn't exist yet
    await admin.from('classrooms').update(updateData).eq('id', id).eq('user_id', session.user.id);

    // Invalidate local file cache so the next GET serves fresh data from Supabase.
    // Without this, device B would load stale gen_img_* placeholder IDs from the
    // cache even after images have been uploaded and Supabase updated with server URLs.
    void fs.unlink(path.join(CLASSROOMS_DIR, `${id}.json`)).catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    // Always succeed from the caller's perspective — this is fire-and-forget
    return NextResponse.json({ success: true });
  }
}
