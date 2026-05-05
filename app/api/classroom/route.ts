import { type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import {
  buildRequestOrigin,
  isValidClassroomId,
  persistClassroom,
  readClassroom,
  CLASSROOMS_DIR,
  writeJsonFileAtomic,
} from '@/lib/server/classroom-storage';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stage, scenes, outlines } = body;

    if (!stage || !scenes) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required fields: stage, scenes',
      );
    }

    const id = stage.id || randomUUID();
    const baseUrl = buildRequestOrigin(request);

    const persisted = await persistClassroom(
      { id, stage: { ...stage, id }, scenes, outlines },
      baseUrl,
    );

    return apiSuccess({ id: persisted.id, url: persisted.url }, 201);
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to store classroom',
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required parameter: id',
      );
    }

    if (!isValidClassroomId(id)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'Invalid classroom id');
    }

    // No auth check — classroom IDs are 10-char nanoid strings (~10^18 combinations)
    // and cannot be enumerated. Content is educational material, not PII.
    // Cookie-based auth checks were unreliable through the Cloudflare tunnel.

    // 1. Try local file first (fast path)
    const classroom = await readClassroom(id);
    if (classroom) {
      return apiSuccess({ classroom });
    }

    // 2. File not found — fall back to Supabase DB
    const admin = getSupabaseAdmin();
    const { data: row, error: dbError } = await admin
      .from('classrooms')
      .select('id, title, short_title, created_at, scenes, outline')
      .eq('id', id)
      .single();

    if (dbError || !row) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'Classroom not found');
    }
    
    // Fixed: Ensure we correctly check the length of scenes, which is a JSONB array
    const scenes = row.scenes;
    if (!scenes || (Array.isArray(scenes) && scenes.length === 0)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, 'Course has no content');
    }

    // Reconstruct the shape readClassroom() returns so the client gets
    // the same response format whether data came from file or DB.
    const dbClassroom = {
      id: row.id as string,
      stage: {
        id: row.id as string,
        name: (row.title as string | null) ?? '',
        shortTitle: (row.short_title as string | null) ?? null,
        createdAt: new Date(row.created_at as string).getTime(),
        updatedAt: Date.now(),
        language: 'en-US',
        agentIds: [],
      },
      scenes: row.scenes as unknown[],
      outlines: (row.outline as unknown[]) || [],
      createdAt: row.created_at as string,
    };

    // 3. Cache to local file so future requests hit the fast path
    try {
      await fs.mkdir(CLASSROOMS_DIR, { recursive: true });
      const filePath = path.join(CLASSROOMS_DIR, `${id}.json`);
      await writeJsonFileAtomic(filePath, dbClassroom);
    } catch {
      // Cache write failure is non-fatal
    }

    return apiSuccess({ classroom: dbClassroom });
  } catch (error) {
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      'Failed to retrieve classroom',
      error instanceof Error ? error.message : String(error),
    );
  }
}
