/**
 * Image Generation API
 *
 * Generates an image from a text prompt using the specified provider.
 * Called by the client during media generation after slides are produced.
 *
 * POST /api/generate/image
 *
 * Headers:
 *   x-image-provider: ImageProviderId (default: 'seedream')
 *   x-api-key: string (optional, server fallback)
 *   x-base-url: string (optional, server fallback)
 *
 * Body: { prompt, negativePrompt?, width?, height?, aspectRatio?, style? }
 * Response: { success: boolean, result?: ImageGenerationResult, error?: string }
 */

import { NextRequest } from 'next/server';
import { generateImage, aspectRatioToDimensions } from '@/lib/media/image-providers';
import { resolveImageApiKey, resolveImageBaseUrl } from '@/lib/server/provider-config';
import type { ImageProviderId, ImageGenerationOptions } from '@/lib/media/types';
import { createLogger } from '@/lib/logger';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';

const log = createLogger('ImageGeneration API');

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const KEEPALIVE_INTERVAL_MS = 5_000;

  const stream = new ReadableStream({
    async start(controller) {
      let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
      const startKeepAlive = () => {
        keepAliveTimer = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            if (keepAliveTimer) clearInterval(keepAliveTimer);
          }
        }, KEEPALIVE_INTERVAL_MS);
      };

      const stopKeepAlive = () => {
        if (keepAliveTimer) {
          clearInterval(keepAliveTimer);
          keepAliveTimer = null;
        }
      };

      try {
        const body = (await request.json()) as ImageGenerationOptions;

        if (!body.prompt) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: 'Missing prompt', status: 400 })}\n\n`),
          );
          controller.close();
          return;
        }

        const providerId = (request.headers.get('x-image-provider') ||
          'seedream') as ImageProviderId;
        const clientApiKey = request.headers.get('x-api-key') || undefined;
        const clientBaseUrl = request.headers.get('x-base-url') || undefined;
        const clientModel = request.headers.get('x-image-model') || undefined;

        if (clientBaseUrl && process.env.NODE_ENV === 'production') {
          const ssrfError = await validateUrlForSSRF(clientBaseUrl);
          if (ssrfError) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ error: ssrfError, status: 403 })}\n\n`),
            );
            controller.close();
            return;
          }
        }

        const apiKey = clientBaseUrl
          ? clientApiKey || ''
          : resolveImageApiKey(providerId, clientApiKey);
        if (!apiKey) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: `No API key configured for image provider: ${providerId}`,
                status: 401,
              })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        const baseUrl = clientBaseUrl
          ? clientBaseUrl
          : resolveImageBaseUrl(providerId, clientBaseUrl);

        // Resolve dimensions from aspect ratio if not explicitly set
        if (!body.width && !body.height && body.aspectRatio) {
          const dims = aspectRatioToDimensions(body.aspectRatio);
          body.width = dims.width;
          body.height = dims.height;
        }

        log.info(
          `Generating image: provider=${providerId}, model=${clientModel || 'default'}, ` +
            `prompt="${body.prompt.slice(0, 80)}...", size=${body.width ?? 'auto'}x${body.height ?? 'auto'}`,
        );

        startKeepAlive();

        let result;
        let _lastError;
        const maxRetries = 3;
        const retryDelayMs = 5000;

        for (let i = 0; i <= maxRetries; i++) {
          try {
            result = await generateImage({ providerId, apiKey, baseUrl, model: clientModel }, body);
            break;
          } catch (error) {
            _lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            const isRetryable =
              message.includes('503') ||
              message.includes('429') ||
              message.includes('high demand') ||
              message.includes('overloaded');

            if (i < maxRetries && isRetryable) {
              log.warn(
                `Image generation failed (${i + 1}/${maxRetries + 1}), retrying in ${retryDelayMs}ms: ${message}`,
              );
              await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
              continue;
            }
            throw error;
          }
        }
        if (result)
          log.info(
            `Image generation success: ${providerId}, result type=${result.base64 ? 'base64' : result.url ? 'url' : 'none'}`,
          );

        stopKeepAlive();

        if (result)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ success: true, result })}\n\n`),
          );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Detect content safety filter rejections (e.g. Seedream OutputImageSensitiveContentDetected)
        if (message.includes('SensitiveContent') || message.includes('sensitive information')) {
          log.warn(`Image blocked by content safety filter: ${message}`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: message, status: 400, errorCode: 'CONTENT_SENSITIVE' })}\n\n`,
            ),
          );
        } else {
          log.error('Image generation error:', error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message, status: 500 })}\n\n`),
          );
        }
      } finally {
        stopKeepAlive();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
