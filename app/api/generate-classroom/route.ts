import { after, type NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { type GenerateClassroomInput, type ModelParams } from '@/lib/server/classroom-generation';
import { runClassroomGenerationJob } from '@/lib/server/classroom-job-runner';
import { createClassroomGenerationJob } from '@/lib/server/classroom-job-store';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { createLogger } from '@/lib/logger';

const log = createLogger('GenerateClassroom');
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const rawBody = (text ? JSON.parse(text) : {}) as Partial<GenerateClassroomInput>;

    const modelParams: ModelParams = {
      modelString: req.headers.get('x-model') || undefined,
      apiKey: req.headers.get('x-api-key') || undefined,
      baseUrl: req.headers.get('x-base-url') || undefined,
      providerType: req.headers.get('x-provider-type') || undefined,
    };
    const body: GenerateClassroomInput = {
      requirement: rawBody.requirement || '',
      ...(rawBody.pdfContent ? { pdfContent: rawBody.pdfContent } : {}),

      ...(rawBody.enableWebSearch != null ? { enableWebSearch: rawBody.enableWebSearch } : {}),
      ...(rawBody.enableImageGeneration != null
        ? { enableImageGeneration: rawBody.enableImageGeneration }
        : {}),
      ...(rawBody.enableVideoGeneration != null
        ? { enableVideoGeneration: rawBody.enableVideoGeneration }
        : {}),
      ...(rawBody.enableTTS != null ? { enableTTS: rawBody.enableTTS } : {}),
      ...(rawBody.agentMode ? { agentMode: rawBody.agentMode } : {}),
    };

    const { requirement } = body;
    if (!requirement) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: requirement');
    }

    // Auth check - get user from session
    let userId: string | undefined;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    log.info('Auth check - user:', user?.id ?? 'null', 'error:', authError?.message ?? 'none');

    if (user) {
      // Always check role from user_profiles - never trust JWT claims
      const adminClient = getSupabaseAdmin();
      const { data: profile, error: profileError } = await adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      log.info(
        'Profile check - role:',
        profile?.role ?? 'null',
        'error:',
        profileError?.message ?? 'none',
      );

      // Block school_student explicitly
      if (profile?.role === 'school_student') {
        log.warn('Blocked school_student from generating course:', user.id);
        return apiError('FORBIDDEN', 403, 'School students cannot generate courses');
      }

      // If no profile found - fail safe, block the request
      if (!profile) {
        log.warn('No profile found for user:', user.id, '- blocking');
        return apiError('FORBIDDEN', 403, 'Access denied');
      }

      userId = user.id;
      log.info('userId resolved:', userId, 'role:', profile.role);
    } else {
      // No session - allow anonymous generation (existing behavior)
      log.warn('No user in session - allowing anonymous generation');
    }

    const baseUrl = buildRequestOrigin(req);
    const jobId = nanoid(10);
    const job = await createClassroomGenerationJob(jobId, body);
    const pollUrl = `${baseUrl}/api/generate-classroom/${jobId}`;

    after(() => runClassroomGenerationJob(jobId, body, baseUrl, userId, modelParams));

    return apiSuccess(
      {
        jobId,
        status: job.status,
        step: job.step,
        message: job.message,
        pollUrl,
        pollIntervalMs: 5000,
      },
      202,
    );
  } catch (err) {
    log.error('Error in generate-classroom:', err);
    return apiError('INTERNAL_ERROR', 500, 'Internal server error');
  }
}
