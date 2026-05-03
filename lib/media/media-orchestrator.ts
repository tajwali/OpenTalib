/**
 * Media Generation Orchestrator
 *
 * Dispatches media generation API calls for all mediaGenerations across outlines.
 * Runs entirely on the frontend — calls /api/generate/image and /api/generate/video,
 * fetches result blobs, stores in IndexedDB, and updates the Zustand store.
 */

import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useSettingsStore } from '@/lib/store/settings';
import { useStageStore } from '@/lib/store/stage';
import { db, mediaFileKey } from '@/lib/utils/database';
import type { SceneOutline } from '@/lib/types/generation';
import type { MediaGenerationRequest } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { fetchStreamingJson } from '@/lib/utils/stream-fetch';

const log = createLogger('MediaOrchestrator');

/** Error with a structured errorCode from the API */
class MediaApiError extends Error {
  errorCode?: string;
  constructor(message: string, errorCode?: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

/**
 * Launch media generation for all mediaGenerations declared in outlines.
 * Runs in parallel with content/action generation — does not block.
 */
export async function generateMediaForOutlines(
  outlines: SceneOutline[],
  stageId: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  const settings = useSettingsStore.getState();
  const store = useMediaGenerationStore.getState();

  // Collect all media requests
  const allRequests: MediaGenerationRequest[] = [];
  for (const outline of outlines) {
    if (!outline.mediaGenerations) continue;
    for (const mg of outline.mediaGenerations) {
      // Filter by enabled flags
      if (mg.type === 'image' && !settings.imageGenerationEnabled) continue;
      if (mg.type === 'video' && !settings.videoGenerationEnabled) continue;
      // Skip already completed or permanently failed (restored from DB)
      const existing = store.getTask(mg.elementId);
      if (existing?.status === 'done' || existing?.status === 'failed') continue;
      allRequests.push(mg);
    }
  }

  if (allRequests.length === 0) return;

  // Enqueue all as pending
  useMediaGenerationStore.getState().enqueueTasks(stageId, allRequests);

  // Process requests serially — image/video APIs have limited concurrency
  for (const req of allRequests) {
    if (abortSignal?.aborted) break;
    await generateSingleMedia(req, stageId, abortSignal);
  }
}

/**
 * Batch retry all failed media tasks for a stage.
 */
export async function retryRemainingMedia(stageId: string): Promise<void> {
  const store = useMediaGenerationStore.getState();
  const failedTasks = Object.values(store.tasks).filter(
    (t) => t.stageId === stageId && t.status === 'failed',
  );

  if (failedTasks.length === 0) return;

  // Process requests serially to avoid overloading provider APIs
  for (const task of failedTasks) {
    await retryMediaTask(task.elementId);
  }
}

/**
 * Retry a single failed media task.
 */
export async function retryMediaTask(elementId: string): Promise<void> {
  const store = useMediaGenerationStore.getState();
  const task = store.getTask(elementId);
  if (!task || task.status !== 'failed') return;

  // Check if the corresponding generation type is still enabled in global settings
  const settings = useSettingsStore.getState();
  if (task.type === 'image' && !settings.imageGenerationEnabled) {
    store.markFailed(elementId, 'Generation disabled', 'GENERATION_DISABLED');
    return;
  }
  if (task.type === 'video' && !settings.videoGenerationEnabled) {
    store.markFailed(elementId, 'Generation disabled', 'GENERATION_DISABLED');
    return;
  }

  // Remove persisted failure record from DB so a fresh result can be written
  const dbKey = mediaFileKey(task.stageId, elementId);
  await db.mediaFiles.delete(dbKey).catch(() => {});

  store.markPendingForRetry(elementId);
  await generateSingleMedia(
    {
      type: task.type,
      prompt: task.prompt,
      elementId: task.elementId,
      aspectRatio: task.params.aspectRatio as MediaGenerationRequest['aspectRatio'],
      style: task.params.style,
    },
    task.stageId,
  );
}

// ==================== Internal ====================

async function generateSingleMedia(
  req: MediaGenerationRequest,
  stageId: string,
  abortSignal?: AbortSignal,
): Promise<void> {
  const store = useMediaGenerationStore.getState();
  store.markGenerating(req.elementId);

  try {
    let resultUrl: string;
    let posterUrl: string | undefined;
    let mimeType: string;

    if (req.type === 'image') {
      const result = await callImageApi(req, abortSignal);
      resultUrl = result.url;
      mimeType = 'image/png';
    } else {
      const result = await callVideoApi(req, abortSignal);
      resultUrl = result.url;
      posterUrl = result.poster;
      mimeType = 'video/mp4';
    }

    if (abortSignal?.aborted) return;

    // If resultUrl is empty, it means we have a non-fatal failure (e.g. timeout or rejected prompt)
    if (!resultUrl) {
      log.warn(
        `[MediaOrchestrator] Empty result URL for ${req.elementId} - marking as done without image`,
      );
      // Mark as done with empty URL so skeleton disappears and UI shows fallback/nothing instead of error
      useMediaGenerationStore.getState().markDone(req.elementId, '');
      return;
    }

    // Fetch blob from URL
    const blob = await fetchAsBlob(resultUrl);
    const posterBlob = posterUrl ? await fetchAsBlob(posterUrl).catch(() => undefined) : undefined;

    // Store in IndexedDB
    await db.mediaFiles.put({
      id: mediaFileKey(stageId, req.elementId),
      stageId,
      type: req.type,
      blob,
      mimeType,
      size: blob.size,
      poster: posterBlob,
      prompt: req.prompt,
      params: JSON.stringify({
        aspectRatio: req.aspectRatio,
        style: req.style,
      }),
      createdAt: Date.now(),
    });

    // Update store with object URL (instant local availability)
    const localObjectUrl = URL.createObjectURL(blob);
    const posterObjectUrl = posterBlob ? URL.createObjectURL(posterBlob) : undefined;
    useMediaGenerationStore.getState().markDone(req.elementId, localObjectUrl, posterObjectUrl);

    // Background upload for cross-device persistence
    if (req.type === 'image') {
      const ext = mimeType.split('/')[1] || 'png';
      const filename = `${req.elementId}.${ext}`;
      const serverUrl = `/api/classroom-media/${stageId}/media/${filename}`;

      const formData = new FormData();
      formData.append('classroomId', stageId);
      formData.append('subdir', 'media');
      formData.append('filename', filename);
      formData.append('file', blob, filename);

      // Fire-and-forget upload
      void fetch('/api/user/classrooms/media', {
        method: 'POST',
        body: formData,
      })
        .then((res) => {
          if (res.ok) {
            // Update store with permanent server URL so it gets picked up by incremental saves
            useMediaGenerationStore.getState().markDone(req.elementId, serverUrl, posterObjectUrl);
            log.info(`Uploaded generated image ${req.elementId} -> ${serverUrl}`);

            // Persist the server URL to Supabase immediately — the earlier incremental
            // PATCH fired before this upload completed and still has the placeholder ID.
            // Deep-clone scenes and substitute this element's placeholder with the real URL.
            const rawScenes = useStageStore.getState().scenes;
            const scenesWithUrl = JSON.parse(JSON.stringify(rawScenes)) as typeof rawScenes;
            for (const scene of scenesWithUrl) {
              if (scene.type !== 'slide') continue;
              const elements = (
                scene.content as { canvas?: { elements?: Array<{ type: string; src: string }> } }
              ).canvas?.elements;
              if (!elements) continue;
              for (const el of elements) {
                if (el.type === 'image' && el.src === req.elementId) {
                  el.src = serverUrl;
                }
              }
            }
            void fetch(`/api/user/classrooms/${stageId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scenes: scenesWithUrl }),
            }).catch(() => {});
          } else {
            log.warn(`Upload failed for ${req.elementId}: HTTP ${res.status}`);
          }
        })
        .catch((err) => {
          log.warn(`Background upload failed for ${req.elementId}:`, err);
        });
    }
  } catch (err) {
    if (abortSignal?.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    const errorCode = err instanceof MediaApiError ? err.errorCode : undefined;
    log.error(`Failed ${req.elementId}:`, message);
    useMediaGenerationStore.getState().markFailed(req.elementId, message, errorCode);

    // Persist non-retryable failures to IndexedDB so they survive page refresh
    if (errorCode) {
      await db.mediaFiles
        .put({
          id: mediaFileKey(stageId, req.elementId),
          stageId,
          type: req.type,
          blob: new Blob(), // empty placeholder
          mimeType: req.type === 'image' ? 'image/png' : 'video/mp4',
          size: 0,
          prompt: req.prompt,
          params: JSON.stringify({
            aspectRatio: req.aspectRatio,
            style: req.style,
          }),
          error: message,
          errorCode,
          createdAt: Date.now(),
        })
        .catch(() => {}); // best-effort
    }
  }
}

async function callImageApi(
  req: MediaGenerationRequest,
  abortSignal?: AbortSignal,
): Promise<{ url: string }> {
  const settings = useSettingsStore.getState();
  const providerConfig = settings.imageProvidersConfig?.[settings.imageProviderId];

  try {
    const data = await fetchStreamingJson<{
      success: boolean;
      result?: { url?: string; base64?: string };
      error?: string;
      errorCode?: string;
    }>('/api/generate/image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-image-provider': settings.imageProviderId || '',
        'x-image-model': settings.imageModelId || '',
        'x-api-key': providerConfig?.apiKey || '',
        'x-base-url': providerConfig?.baseUrl || '',
      },
      body: JSON.stringify({
        prompt: req.prompt,
        aspectRatio: req.aspectRatio,
        style: req.style,
      }),
      signal: abortSignal,
      timeoutMs: 120000, // 120s timeout for image generation
    });

    if (!data.success) {
      throw new MediaApiError(data.error || 'Image generation failed', data.errorCode);
    }

    // Result may have url or base64
    const url =
      data.result?.url ||
      (data.result?.base64 ? `data:image/png;base64,${data.result.base64}` : '');
    if (!url) throw new Error('No image URL in response');
    return { url };
  } catch (err) {
    // Gracefully handle timeouts or other errors for image generation to not block the course generation
    log.error(`[MediaOrchestrator] Image generation failed for ${req.elementId}:`, err);
    return { url: '' };
  }
}

async function callVideoApi(
  req: MediaGenerationRequest,
  abortSignal?: AbortSignal,
): Promise<{ url: string; poster?: string }> {
  const settings = useSettingsStore.getState();
  const providerConfig = settings.videoProvidersConfig?.[settings.videoProviderId];

  try {
    const response = await fetch('/api/generate/video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-video-provider': settings.videoProviderId || '',
        'x-video-model': settings.videoModelId || '',
        'x-api-key': providerConfig?.apiKey || '',
        'x-base-url': providerConfig?.baseUrl || '',
      },
      body: JSON.stringify({
        prompt: req.prompt,
        aspectRatio: req.aspectRatio,
      }),
      signal: abortSignal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new MediaApiError(
        data.error || `Video API returned ${response.status}`,
        data.errorCode,
      );
    }

    const data = await response.json();
    if (!data.success)
      throw new MediaApiError(data.error || 'Video generation failed', data.errorCode);

    const url = data.result?.url;
    if (!url) throw new Error('No video URL in response');
    return { url, poster: data.result?.poster };
  } catch (err) {
    log.error(`[MediaOrchestrator] Video generation failed for ${req.elementId}:`, err);
    return { url: '' };
  }
}

async function fetchAsBlob(url: string): Promise<Blob> {
  // For data URLs, decode directly — never use fetch() on data: URLs because
  // CSP connect-src blocks it ("Refused to connect because it violates CSP").
  if (url.startsWith('data:')) {
    return dataUrlToBlob(url);
  }
  // For remote URLs, proxy through our server to bypass CORS restrictions
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const res = await fetch('/api/proxy-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Proxy fetch failed: ${res.status}`);
    }
    return res.blob();
  }
  // Relative URLs (shouldn't happen, but handle gracefully)
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
  return res.blob();
}

/**
 * Convert a data: URL to a Blob without using fetch().
 * Using fetch() on data: URLs is blocked by CSP connect-src.
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
