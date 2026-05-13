/**
 * Scene Content Generation API
 *
 * Generates scene content (slides/quiz/interactive/pbl) from an outline.
 * This is the first half of the two-step scene generation pipeline.
 * Does NOT generate actions — use /api/generate/scene-actions for that.
 */

import { NextRequest } from 'next/server';
import { callLLM } from '@/lib/ai/llm';
import {
  applyOutlineFallbacks,
  generateSceneContent,
  buildVisionUserContent,
} from '@/lib/generation/generation-pipeline';
import type { AgentInfo } from '@/lib/generation/generation-pipeline';
import type { SceneOutline, PdfImage, ImageMapping } from '@/lib/types/generation';
import { createLogger } from '@/lib/logger';
import { resolveModelFromHeaders } from '@/lib/server/resolve-model';
import { buildSystemPromptHeader } from '@/lib/server/pedagogy-resolver';

const log = createLogger('Scene Content API');

export const maxDuration = 300;

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
          outline: rawOutline,
          allOutlines,
          pdfImages,
          imageMapping,
          stageInfo: _stageInfo,
          stageId,
          agents,
          languageDirective,
          pedagogyProfile,
        } = body as {
          outline: SceneOutline;
          allOutlines: SceneOutline[];
          pdfImages?: PdfImage[];
          imageMapping?: ImageMapping;
          stageInfo: {
            name: string;
            description?: string;
            language?: string;
            style?: string;
          };
          stageId: string;
          agents?: AgentInfo[];
          languageDirective?: string;
          pedagogyProfile?: any;
        };

        // Validate required fields
        if (!rawOutline) {
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
        if (!stageId) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: 'stageId is required', status: 400 })}\n\n`,
            ),
          );
          controller.close();
          return;
        }

        const outline: SceneOutline = { ...rawOutline };

        // ── Model resolution from request headers ──
        const { model: languageModel, modelInfo, modelString } = await resolveModelFromHeaders(req);

        // Detect vision capability
        const hasVision = !!modelInfo?.capabilities?.vision;

        const pedagogyHeader = pedagogyProfile ? buildSystemPromptHeader(pedagogyProfile) : '';

        // Vision-aware AI call function
        const aiCall = async (
          systemPrompt: string,
          userPrompt: string,
          images?: Array<{ id: string; src: string }>,
        ): Promise<string> => {
          const updatedSystemPrompt = systemPrompt + 
            '\n\nAlso output a "conceptKeys" array in your JSON: 2-5 short snake_case strings naming the core concepts in this scene.' +
            '\nExample: ["prime_numbers", "factor_trees", "composite_numbers"]' +
            '\n\nIMAGE ACCURACY RULES:' +
            '\n- If an image is a diagram, it MUST be a high-quality educational diagram.' +
            '\n- Use labelled diagrams, flowcharts, or scientific illustrations where appropriate.' +
            '\n- Ensure absolute factual accuracy: no text hallucinations, consistent labels, and scientifically correct representations.';
          const finalSystemPrompt = pedagogyHeader ? pedagogyHeader + '\n\n' + updatedSystemPrompt : updatedSystemPrompt;
          if (images?.length && hasVision) {
            const result = await callLLM(
              {
                model: languageModel,
                system: finalSystemPrompt,
                messages: [
                  {
                    role: 'user' as const,
                    content: buildVisionUserContent(userPrompt, images),
                  },
                ],
                maxOutputTokens: modelInfo?.outputWindow,
              },
              'scene-content',
            );
            return result.text;
          }
          const result = await callLLM(
            {
              model: languageModel,
              system: finalSystemPrompt,
              prompt: userPrompt,
              maxOutputTokens: modelInfo?.outputWindow,
            },
            'scene-content',
          );
          return result.text;
        };

        // ── Apply fallbacks ──
        const effectiveOutline = applyOutlineFallbacks(outline, !!languageModel);

        // ── Filter images assigned to this outline ──
        let assignedImages: PdfImage[] | undefined;
        if (
          pdfImages &&
          pdfImages.length > 0 &&
          effectiveOutline.suggestedImageIds &&
          effectiveOutline.suggestedImageIds.length > 0
        ) {
          const suggestedIds = new Set(effectiveOutline.suggestedImageIds);
          assignedImages = pdfImages.filter((img) => suggestedIds.has(img.id));
        }

        // ── Media generation is handled client-side in parallel (media-orchestrator.ts) ──
        // The content generator receives placeholder IDs (gen_img_1, gen_vid_1) as-is.
        // resolveImageIds() in generation-pipeline.ts will keep these placeholders in elements.
        const generatedMediaMapping: ImageMapping = {};

        // ── Generate content ──
        log.info(
          `Generating content: "${effectiveOutline.title}" (${effectiveOutline.type}) [model=${modelString}]`,
        );

        startKeepAlive();

        try {
          const content = await generateSceneContent(effectiveOutline, aiCall, {
            assignedImages,
            imageMapping,
            languageModel: effectiveOutline.type === 'pbl' ? languageModel : undefined,
            visionEnabled: hasVision,
            generatedMediaMapping,
            agents,
            languageDirective,
          });

          if (!content) {
            throw new Error('Empty content generated');
          }

          log.info(`Content generated successfully: "${effectiveOutline.title}"`);

          const conceptKeys: string[] = (content as any).conceptKeys ?? [];
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ success: true, content: { ...content, conceptKeys }, effectiveOutline })}\n\n`,
            ),
          );
        } catch (parseError) {
          if (effectiveOutline.type === 'quiz') {
            console.error('[Scene Content API] Failed to parse, using fallback for quiz scene');

            const sceneName = effectiveOutline.title;
            const fallbackQuizScene = {
              questions: [
                {
                  id: 'fallback_q1',
                  type: 'single',
                  question: `Based on what you have learned, answer this question about ${sceneName.replace('Check!', '').replace('Checkpoint', '').trim()}.`,
                  options: [
                    { label: 'Option A', value: 'A' },
                    { label: 'Option B', value: 'B' },
                    { label: 'Option C', value: 'C' },
                    { label: 'Option D', value: 'D' },
                  ],
                  answer: ['A'],
                  analysis: 'Review the lesson content to find the correct answer.',
                  hasAnswer: true,
                  points: 1,
                }
              ],
              conceptKeys: ['learning_review', 'quiz_practice'],
            };

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ success: true, content: fallbackQuizScene, effectiveOutline })}\n\n`
              )
            );
            return;
          } else {
            throw parseError;
          }
        }

      } catch (error) {
        log.error('Scene content generation error:', error);
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
