/**
 * Upload client-side media blobs to the server before saving to database.
 *
 * Client-generated images/videos are stored in IndexedDB as blobs keyed by
 * placeholder IDs (gen_img_*, gen_vid_*). TTS audio is stored under audioId.
 * These blobs only exist in the browser and are lost on other devices.
 *
 * This utility:
 *  1. Finds all placeholder IDs in the scenes canvas elements.
 *  2. Looks up each blob in IndexedDB.
 *  3. POSTs each blob to /api/user/classrooms/media.
 *  4. Returns deep-cloned scenes with placeholder IDs / audioId references
 *     replaced by the permanent server-side URLs.
 *
 * Failures are swallowed — the original placeholder values are kept as
 * fallbacks so that a network error never blocks saving the course.
 */

import { db, mediaFileKey } from '@/lib/utils/database';
import { isMediaPlaceholder } from '@/lib/store/media-generation';
import type { Scene } from '@/lib/types/stage';
import type { SpeechAction } from '@/lib/types/action';
import { createLogger } from '@/lib/logger';

const log = createLogger('UploadMedia');

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload all client-side media blobs for `stageId` to the server and return
 * a deep-cloned copy of `scenes` with placeholder IDs replaced by server URLs.
 */
export async function uploadMediaAndReplace(scenes: Scene[], stageId: string): Promise<Scene[]> {
  // Deep-clone to avoid mutating the live Zustand store
  const cloned = JSON.parse(JSON.stringify(scenes)) as Scene[];

  // --- Images and videos ---------------------------------------------------

  // Collect image/video elements from all slide scenes
  type ImgEl = { type: string; src: string };
  const allImageEls: ImgEl[] = [];
  for (const scene of cloned) {
    if (scene.type !== 'slide') continue;
    const canvas = (scene.content as { canvas?: { elements?: ImgEl[] } }).canvas;
    if (!canvas?.elements) continue;
    for (const el of canvas.elements) {
      if (el.type === 'image' || el.type === 'video') allImageEls.push(el);
    }
  }

  // For each element, resolve a server URL from the src value.
  // Three cases:
  //   1. gen_img_*/gen_vid_* placeholder — look up blob in IndexedDB
  //   2. data: URL stored directly    — decode base64 to Blob
  //   3. blob: URL stored directly    — fetch the object URL to Blob
  const srcToServerUrl = new Map<string, string>(); // src → server URL

  for (const el of allImageEls) {
    const src = el.src;
    if (!src || srcToServerUrl.has(src)) continue; // already resolved or empty
    // Skip if already a server URL
    if (src.startsWith('/') || src.startsWith('http')) continue;

    let blob: Blob | undefined;
    let ext = 'png';

    if (isMediaPlaceholder(src)) {
      // Case 1: placeholder — look up IndexedDB
      const key = mediaFileKey(stageId, src);
      const rec = await db.mediaFiles.get(key).catch(() => undefined);
      if (!rec || rec.blob.size === 0 || rec.error) continue;
      blob = rec.blob.type ? rec.blob : new Blob([rec.blob], { type: rec.mimeType });
      ext = extFromMime(rec.mimeType);
    } else if (src.startsWith('data:')) {
      // Case 2: data: URL — decode directly, never fetch() (CSP blocks it)
      blob = dataUrlToBlob(src);
      ext = extFromMime(blob.type);
    } else if (src.startsWith('blob:')) {
      // Case 3: blob: URL — fetch the object URL (same-origin, allowed by CSP)
      try {
        const res = await fetch(src);
        blob = await res.blob();
        ext = extFromMime(blob.type);
      } catch {
        log.warn(`Could not fetch blob URL: ${src.slice(0, 60)}`);
        continue;
      }
    } else {
      continue;
    }

    if (!blob || blob.size === 0) continue;

    // Use the element ID as the filename for generated media to ensure consistency
    // with background uploads initiated by the media orchestrator.
    const filename = isMediaPlaceholder(src)
      ? `${src}.${ext}`
      : `img_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const form = new FormData();
    form.append('classroomId', stageId);
    form.append('subdir', 'media');
    form.append('filename', filename);
    form.append('file', blob, filename);

    try {
      const res = await fetch('/api/user/classrooms/media', { method: 'POST', body: form });
      if (res.ok) {
        const { url } = (await res.json()) as { url: string };
        srcToServerUrl.set(src, url);
        log.info(`Uploaded ${src.slice(0, 30)}… → ${url}`);
      } else {
        log.warn(`Upload failed for ${src.slice(0, 40)}: HTTP ${res.status}`);
      }
    } catch (err) {
      log.warn(`Upload error for ${src.slice(0, 40)}:`, err);
    }
  }

  // Replace all matched src values with server URLs
  if (srcToServerUrl.size > 0) {
    for (const el of allImageEls) {
      const serverUrl = srcToServerUrl.get(el.src);
      if (serverUrl) el.src = serverUrl;
    }
  }

  // --- Audio (TTS) ---------------------------------------------------------

  for (const scene of cloned) {
    if (!scene.actions?.length) continue;
    for (const action of scene.actions) {
      if (action.type !== 'speech') continue;
      const speech = action as SpeechAction;
      // Skip if server URL already set (e.g. server-generated TTS)
      if (!speech.audioId || speech.audioUrl) continue;

      const rec = await db.audioFiles.get(speech.audioId).catch(() => undefined);
      if (!rec || rec.blob.size === 0) continue;

      const ext = rec.format || 'mp3';
      const filename = `${speech.audioId}.${ext}`;
      const form = new FormData();
      form.append('classroomId', stageId);
      form.append('subdir', 'audio');
      form.append('filename', filename);
      form.append('file', rec.blob, filename);

      try {
        const res = await fetch('/api/user/classrooms/media', { method: 'POST', body: form });
        if (res.ok) {
          const { url } = (await res.json()) as { url: string };
          speech.audioUrl = url;
          log.info(`Uploaded audio ${speech.audioId} → ${url}`);
        } else {
          log.warn(`Audio upload failed for ${speech.audioId}: HTTP ${res.status}`);
        }
      } catch (err) {
        log.warn(`Audio upload error for ${speech.audioId}:`, err);
      }
    }
  }

  return cloned;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extFromMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('gif')) return 'gif';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  return 'bin';
}

/**
 * Convert a data: URL to a Blob without using fetch().
 * fetch('data:...') is blocked by CSP connect-src.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
