/**
 * Scene Actions Generation API
 *
 * Generates actions for a scene given its outline and content,
 * then assembles the complete Scene object.
 * This is the second half of the two-step scene generation pipeline.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import {
  generateSceneActions,
  buildCompleteScene,
  buildVisionUserContent,
  type SceneGenerationContext,
  type AgentInfo,
} from '@/lib/generation/generation-pipeline';
import type { SceneOutline } from '@/lib/types/generation';
import type {
  GeneratedSlideContent,
  GeneratedQuizContent,
  GeneratedInteractiveContent,
  GeneratedPBLContent,
} from '@/lib/types/generation';
import type { SpeechAction } from '@/lib/types/action';
import { createLogger } from '@/lib/logger';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';

const log = createLogger('Scene Actions API');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
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
        const body = await req.json();
        const {
          outline,
          allOutlines,
          content,
          stageId,
          agents,
          previousSpeeches: incomingPreviousSpeeches,
          userProfile,
          languageDirective,
        } = body as {
          outline: SceneOutline;
          allOutlines: SceneOutline[];
          content:
            | GeneratedSlideContent
            | GeneratedQuizContent
            | GeneratedInteractiveContent
            | GeneratedPBLContent;
          stageId: string;
          agents?: AgentInfo[];
          previousSpeeches?: string[];
          userProfile?: string;
          languageDirective?: string;
        };

        // Validate required fields
        if (!outline) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'outline is required', status: 400 })}\n\n`,
            ),
          );
          controller.close();
          return;
        }
        if (!allOutlines || allOutlines.length === 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: 'allOutlines is required and must not be empty',
                status: 400,
              })}\n\n`,
            ),
          );
          controller.close();
          return;
        }
        if (!content) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'content is required', status: 400 })}\n\n`,
            ),
          );
          controller.close();
          return;
        }
        if (!stageId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'stageId is required', status: 400 })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        // ── Model resolution from request headers ──
        const { model: languageModel, modelInfo, modelString } = await resolveModelFromHeaders(req);

        // Detect vision capability
        const hasVision = !!modelInfo?.capabilities?.vision;

        // AI call function (actions typically don't use vision, but kept for consistency)
        const aiCall = async (
          systemPrompt: string,
          userPrompt: string,
          images?: Array<{ id: string; src: string }>,
        ): Promise<string> => {
          if (images?.length && hasVision) {
            const result = await callLLM(
              {
                model: languageModel,
                system: systemPrompt,
                messages: [
                  {
                    role: 'user' as const,
                    content: buildVisionUserContent(userPrompt, images),
                  },
                ],
                maxOutputTokens: modelInfo?.outputWindow,
              },
              'scene-actions',
            );
            return result.text;
          }
          const result = await callLLM(
            {
              model: languageModel,
              system: systemPrompt,
              prompt: userPrompt,
              maxOutputTokens: modelInfo?.outputWindow,
            },
            'scene-actions',
          );
          return result.text;
        };

        // ── Build cross-scene context ──
        const allTitles = allOutlines.map((o) => o.title);
        const pageIndex = allOutlines.findIndex((o) => o.id === outline.id);
        const ctx: SceneGenerationContext = {
          pageIndex: (pageIndex >= 0 ? pageIndex : 0) + 1,
          totalPages: allOutlines.length,
          allTitles,
          previousSpeeches: incomingPreviousSpeeches ?? [],
        };

        // ── Generate actions ──
        log.info(`Generating actions: "${outline.title}" (${outline.type}) [model=${modelString}]`);

        startKeepAlive();

        const actions = await generateSceneActions(outline, content, aiCall, {
          ctx,
          agents,
          userProfile,
          languageDirective,
        });

        stopKeepAlive();

        log.info(`Generated ${actions.length} actions for: "${outline.title}"`);

        // ── Build complete scene ──
        const scene = buildCompleteScene(outline, content, actions, stageId);

        if (!scene) {
          log.error(`Failed to build scene: "${outline.title}"`);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                error: `Failed to build scene: ${outline.title}`,
                status: 500,
              })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        // ── Extract speeches for cross-scene coherence ──
        const outputPreviousSpeeches = (scene.actions || [])
          .filter((a): a is SpeechAction => a.type === 'speech')
          .map((a) => a.text);

        log.info(
          `Scene assembled successfully: "${outline.title}" — ${scene.actions?.length ?? 0} actions`,
        );

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              success: true,
              scene,
              previousSpeeches: outputPreviousSpeeches,
            })}\n\n`,
          ),
        );
      } catch (error) {
        log.error('Scene actions generation error:', error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              status: 500,
            })}\n\n`,
          ),
        );
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
