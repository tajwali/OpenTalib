/**
 * Shared server-side utilities for classroom creation/saving.
 * Used by both the job runner (server-generated courses) and
 * the client-save API route (client-generated courses).
 */

import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { callLLM } from '@/lib/ai/llm';
import { resolveModel, resolveFallbackModels } from '@/lib/server/resolve-model';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClassroomUtils');

/**
 * Ask the LLM to produce a clean, human-readable course title from the
 * requirement and the first few scene titles.
 *
 * Returns the cleaned title, or null on any failure (caller should fall back).
 */
export async function generateCourseTitle(
  requirement: string,
  sceneOutlineTitles: string[],
): Promise<string | null> {
  try {
    const topTitles = sceneOutlineTitles.slice(0, 3).join('; ');
    const context = topTitles ? `Scene titles: "${topTitles}"` : '';

    const { model: languageModel, modelString } = await resolveModel({});
    const fallbackModels = await resolveFallbackModels(modelString);

    const result = await callLLM(
      {
        model: languageModel,
        system:
          'You are a course naming assistant. Generate a concise, human-readable course title. ' +
          'Return ONLY the title — no quotes, no punctuation at the end, no extra explanation.',
        prompt:
          `Course requirement: "${requirement.slice(0, 300)}"\n` +
          (context ? `${context}\n` : '') +
          '\nGenerate a clear course title in 5-8 words.',
      },
      'generate-course-title',
      undefined,
      undefined,
      fallbackModels,
    );

    const title = result.text
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 100);
    if (title.length < 3) return null;
    log.info(`Generated course title: "${title}"`);
    return title;
  } catch (err) {
    log.warn(
      'generateCourseTitle failed, using fallback:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Generate a short course title (max 6 words) from the requirement.
 * Used for course identification and the course title field.
 */
export async function generateShortTitle(requirement: string): Promise<string | null> {
  try {
    const { model: languageModel, modelString } = await resolveModel({});
    const fallbackModels = await resolveFallbackModels(modelString);

    const result = await callLLM(
      {
        model: languageModel,
        system:
          'You are a course naming assistant. Generate a short, concise course title (max 6 words). ' +
          'Return ONLY the title — no quotes, no punctuation at the end, no extra explanation.',
        prompt: `Generate a short course title (max 6 words) based on this topic: ${requirement.slice(0, 500)}`,
      },
      'generate-short-title',
      undefined,
      undefined,
      fallbackModels,
    );

    const title = result.text
      .trim()
      .replace(/^["']|["']$/g, '')
      .slice(0, 60);
    if (title.length < 3) return null;
    log.info(`Generated short course title: "${title}"`);
    return title;
  } catch (err) {
    log.warn('generateShortTitle failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Classify a course into one of the known subjects via LLM.
 */
export async function classifySubject(title: string, requirement: string): Promise<string | null> {
  try {
    const admin = getSupabaseAdmin();
    const { data: subjects } = await admin
      .from('subjects')
      .select('id, name')
      .order('is_default', { ascending: false });

    if (!subjects?.length) return null;

    const subjectList = subjects.map((s) => s.name as string).join(', ');
    const { model: languageModel, modelString } = await resolveModel({});
    const fallbackModels = await resolveFallbackModels(modelString);

    const result = await callLLM(
      {
        model: languageModel,
        system:
          'You are a subject classifier. Respond with ONLY the subject name from the given list, nothing else.',
        prompt:
          `Course title: "${title}"\n` +
          `Course requirement: "${requirement.slice(0, 300)}"\n\n` +
          `Classify into ONE of these subjects: ${subjectList}\n\n` +
          'Respond with only the subject name.',
      },
      'subject-classify',
      undefined,
      undefined,
      fallbackModels,
    );

    const classified = result.text.trim();
    const match = subjects.find(
      (s) => (s.name as string).toLowerCase() === classified.toLowerCase(),
    );
    if (match) {
      log.info(`Classified course "${title}" → subject "${match.name}" (${match.id})`);
      return match.id as string;
    }
    log.warn(`classifySubject: no match for LLM response "${classified}"`);
    return null;
  } catch (err) {
    log.warn('classifySubject failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}
