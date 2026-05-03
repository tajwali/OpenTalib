import { createLogger } from '@/lib/logger';
import {
  generateClassroom,
  type GenerateClassroomInput,
  type ModelParams,
} from '@/lib/server/classroom-generation';
import {
  markClassroomGenerationJobFailed,
  markClassroomGenerationJobRunning,
  markClassroomGenerationJobSucceeded,
  updateClassroomGenerationJobProgress,
} from '@/lib/server/classroom-job-store';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { generateCourseTitle, classifySubject } from '@/lib/server/classroom-utils';

const log = createLogger('ClassroomJob');
const runningJobs = new Map<string, Promise<void>>();

async function saveClassroomToDatabase(
  userId: string,
  classroomId: string,
  requirement: string,
  scenes: unknown,
): Promise<void> {
  const admin = getSupabaseAdmin();

  // Collect scene titles for title generation
  const sceneOutlineTitles: string[] = [];
  if (Array.isArray(scenes)) {
    for (const scene of scenes as Record<string, unknown>[]) {
      if (scene.title && typeof scene.title === 'string') {
        sceneOutlineTitles.push(scene.title);
      }
    }
  }

  // Generate a clean LLM title; fall back to truncated requirement
  const generatedTitle = await generateCourseTitle(requirement, sceneOutlineTitles);
  const title = (generatedTitle || requirement).slice(0, 100);
  log.info(`Course title for ${classroomId}: "${title}"`);

  // short_title = first scene title, fallback to requirement
  const shortTitle = (sceneOutlineTitles[0] ?? requirement).slice(0, 60);

  // Auto-classify subject (null on failure)
  const subjectId = await classifySubject(title, requirement);
  log.info(`Subject classification for ${classroomId}: ${subjectId ?? 'null (unclassified)'}`);

  const { error } = await admin.from('classrooms').insert({
    id: classroomId,
    user_id: userId,
    title,
    short_title: shortTitle,
    subject_id: subjectId,
    topic: requirement.slice(0, 500),
    scenes,
    status: 'complete',
  });
  if (error) {
    log.error(`Failed to save classroom ${classroomId} to database:`, error.message);
  } else {
    log.info(`Classroom ${classroomId} saved to database for user ${userId}`);
  }
}

export function runClassroomGenerationJob(
  jobId: string,
  input: GenerateClassroomInput,
  baseUrl: string,
  userId?: string,
  modelParams?: ModelParams,
): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) {
    return existing;
  }

  const jobPromise = (async () => {
    try {
      await markClassroomGenerationJobRunning(jobId);

      const result = await generateClassroom(input, {
        modelParams,
        baseUrl,
        onProgress: async (progress) => {
          await updateClassroomGenerationJobProgress(jobId, progress);
        },
      });

      await markClassroomGenerationJobSucceeded(jobId, result);

      log.info(`Job ${jobId} succeeded. userId=${userId ?? 'undefined'}, classroomId=${result.id}`);

      if (userId) {
        try {
          await saveClassroomToDatabase(userId, result.id, input.requirement, result.scenes);
        } catch (dbError) {
          log.error(`Database save failed for classroom ${result.id}:`, dbError);
          // Never fail the job due to DB errors — filesystem save already succeeded
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Classroom generation job ${jobId} failed:`, error);
      try {
        await markClassroomGenerationJobFailed(jobId, message);
      } catch (markFailedError) {
        log.error(`Failed to persist failed status for job ${jobId}:`, markFailedError);
      }
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
