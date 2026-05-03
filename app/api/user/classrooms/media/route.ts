import { createLogger } from '@/lib/logger';
const log = createLogger('MediaUpload');
/**
 * POST /api/user/classrooms/media
 *
 * Uploads a single media file (image, video, audio) to the server-side
 * classroom directory so it persists beyond IndexedDB / page refresh.
 *
 * FormData fields:
 *   classroomId  string   — target classroom ID
 *   subdir       string   — 'media' | 'audio' (defaults to 'media')
 *   filename     string   — sanitised basename (no path separators)
 *   file         File     — binary blob
 *
 * Returns: { url: string }  — relative URL served by /api/classroom-media/…
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';
import { CLASSROOMS_DIR, isValidClassroomId } from '@/lib/server/classroom-storage';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(req: NextRequest) {
  log.debug('Received media upload request');
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const classroomId = formData.get('classroomId');
  const filename = formData.get('filename');
  const file = formData.get('file');
  const subdir = (formData.get('subdir') as string | null) ?? 'media';

  if (typeof classroomId !== 'string' || !classroomId) {
    return NextResponse.json({ error: 'Missing classroomId' }, { status: 400 });
  }
  if (typeof filename !== 'string' || !filename) {
    return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  // Security: validate inputs
  if (!isValidClassroomId(classroomId)) {
    return NextResponse.json({ error: 'Invalid classroomId' }, { status: 400 });
  }
  if (subdir !== 'media' && subdir !== 'audio') {
    return NextResponse.json({ error: 'Invalid subdir' }, { status: 400 });
  }

  // Sanitise filename — strip any directory components and null bytes
  const sanitised = path.basename(filename);
  if (!sanitised || sanitised !== filename || filename.includes('\0') || filename.includes('/')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }
  // Allow only safe filename characters
  if (!/^[\w.-]+$/.test(sanitised)) {
    return NextResponse.json({ error: 'Filename contains invalid characters' }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 415 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 50 MB)' }, { status: 413 });
  }

  log.debug(`Saving media to disk: ${classroomId}/${subdir}/${sanitised}`);
  // Write to disk
  const dir = path.join(CLASSROOMS_DIR, classroomId, subdir);
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, sanitised);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buf);

  const url = `/api/classroom-media/${classroomId}/${subdir}/${sanitised}`;
  return NextResponse.json({ url }, { status: 201 });
}
