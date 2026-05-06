import { promises as fs } from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { CLASSROOMS_DIR, isValidClassroomId } from '@/lib/server/classroom-storage';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.aac': 'audio/aac',
};

// Files larger than this are streamed in chunks; smaller ones are buffered
const STREAM_THRESHOLD = 10 * 1024 * 1024; // 10 MB

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'CDN-Cache-Control': 'no-store',
  'Cloudflare-CDN-Cache-Control': 'no-store',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ classroomId: string; path: string[] }> },
) {
  const { classroomId, path: pathSegments } = await params;

  // Validate classroomId
  if (!isValidClassroomId(classroomId)) {
    return NextResponse.json(
      { error: 'Invalid classroom ID' },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  // Validate path segments — no traversal
  const joined = pathSegments.join('/');
  if (joined.includes('..') || pathSegments.some((s) => s.includes('\0'))) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  // Only allow media/ and audio/ subdirectories
  const subDir = pathSegments[0];
  if (subDir !== 'media' && subDir !== 'audio') {
    return NextResponse.json({ error: 'Invalid path' }, { status: 404, headers: NO_CACHE_HEADERS });
  }

  const filePath = path.join(CLASSROOMS_DIR, classroomId, ...pathSegments);
  console.log(`[MediaServer] GET ${classroomId}/${pathSegments.join('/')}`);
  console.log(`[MediaServer] process.cwd(): ${process.cwd()}`);
  console.log(`[MediaServer] CLASSROOMS_DIR: ${CLASSROOMS_DIR}`);
  console.log(`[MediaServer] Constructed filePath: ${filePath}`);

  try {
    // Resolve symlinks and verify the real path stays within the classroom dir
    const realPath = await fs.realpath(filePath);

    // Resolve base path through symlinks too, otherwise the prefix check fails
    // if CLASSROOMS_DIR is a symlink or contains one.
    let realBase: string;
    try {
      realBase = await fs.realpath(path.join(CLASSROOMS_DIR, classroomId));
    } catch {
      // Fallback if base doesn't exist yet (though realPath resolution would have failed)
      realBase = path.resolve(CLASSROOMS_DIR, classroomId);
    }

    if (!realPath.startsWith(realBase + path.sep) && realPath !== realBase) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const stat = await fs.stat(realPath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }

    const ext = path.extname(realPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const fileSize = stat.size;

    // Handle range requests (required for <video> and <audio> seeking)
    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const clampedEnd = Math.min(end, fileSize - 1);
        const chunkSize = clampedEnd - start + 1;

        const buf = await fs.readFile(realPath);
        const chunk = buf.slice(start, clampedEnd + 1);

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${clampedEnd}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    // For small files (images, short audio) — buffer the entire file.
    // Avoids the Node.js Readable → Web ReadableStream bridge, which can
    // produce a response with the correct Content-Length header but an empty
    // body in some Next.js streaming edge cases, resulting in blank images.
    if (fileSize <= STREAM_THRESHOLD) {
      const buf = await fs.readFile(realPath);
      return new NextResponse(buf, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // For large files (long videos) — stream in chunks using Web ReadableStream
    // with explicit Uint8Array conversion to avoid Buffer type mismatches.
    const CHUNK_SIZE = 1024 * 1024; // 1 MB chunks
    let offset = 0;
    const webStream = new ReadableStream({
      async pull(controller) {
        if (offset >= fileSize) {
          controller.close();
          return;
        }
        const length = Math.min(CHUNK_SIZE, fileSize - offset);
        const handle = await fs.open(realPath, 'r');
        try {
          const buf = Buffer.allocUnsafe(length);
          await handle.read(buf, 0, length, offset);
          offset += length;
          controller.enqueue(new Uint8Array(buf));
        } finally {
          await handle.close();
        }
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_CACHE_HEADERS });
    }
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: NO_CACHE_HEADERS },
    );
  }
}
