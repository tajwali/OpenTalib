import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { requireRole } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET() {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const admin = getSupabaseAdmin();

    // 1. User roles count
    const { data: roleData } = await admin.from('user_profiles').select('role');

    const userRoles: Record<string, number> = {
      admin: 0,
      teacher: 0,
      school_student: 0,
      mature_student: 0,
    };
    (roleData || []).forEach((p) => {
      if (p.role) userRoles[p.role] = (userRoles[p.role] || 0) + 1;
    });

    // 2. Courses and Scenes count
    // PostgREST doesn't support sum of jsonb_array_length directly easily without RPC
    // So we'll fetch them and calculate or use a simple estimate if too many.
    // For now, let's fetch all rows (only title and scenes to keep it light)
    const { data: courses } = await admin
      .from('classrooms')
      .select('id, title, scenes, subject_id, user_id, created_at')
      .order('created_at', { ascending: false });

    const totalCourses = courses?.length || 0;
    let totalScenes = 0;
    const subjectCounts: Record<string, number> = {};

    (courses || []).forEach((c) => {
      if (Array.isArray(c.scenes)) totalScenes += c.scenes.length;
      if (c.subject_id) subjectCounts[c.subject_id] = (subjectCounts[c.subject_id] || 0) + 1;
    });

    // 3. Popular Subjects
    const { data: allSubjects } = await admin.from('subjects').select('id, name, icon');
    const popularSubjects = (allSubjects || [])
      .map((s) => ({
        id: s.id,
        name: s.name,
        icon: s.icon,
        count: subjectCounts[s.id] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 4. Recent Activity (last 10)
    // We need teacher names, so let's get unique user IDs from the last 10 courses
    const recentRaw = (courses || []).slice(0, 10);
    const uniqueUserIds = Array.from(new Set(recentRaw.map((c) => c.user_id).filter(Boolean)));

    const { data: teachers } = await admin
      .from('user_profiles')
      .select('id, display_name')
      .in('id', uniqueUserIds);

    const teacherMap = new Map((teachers || []).map((t) => [t.id, t.display_name]));

    const recentActivity = recentRaw.map((c) => ({
      id: c.id,
      title: c.title,
      teacher_name: teacherMap.get(c.user_id) || 'Unknown',
      created_at: c.created_at,
    }));

    // 5. Storage Usage (Real data from filesystem)
    const classroomsDir = path.join(process.cwd(), 'data', 'classrooms');
    let mediaFilesCount = 0;
    let totalBytes = 0;

    const countMediaFiles = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const res = path.resolve(dir, entry.name);
          if (entry.isDirectory()) {
            await countMediaFiles(res);
          } else {
            const stats = await fs.stat(res);
            totalBytes += stats.size;
            // Count media and audio files
            if (/\.(png|jpg|jpeg|webp|mp4|mp3|wav|aac|ogg|flac)$/i.test(entry.name)) {
              mediaFilesCount++;
            }
          }
        }
      } catch (e) {
        // Ignore errors if directory doesn't exist
      }
    };
    await countMediaFiles(classroomsDir);

    const storageUsage = {
      mediaFilesCount,
      totalBytes,
      formattedSize:
        totalBytes > 1024 * 1024
          ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
          : `${(totalBytes / 1024).toFixed(1)} KB`,
    };

    return NextResponse.json({
      userRoles,
      totalCourses,
      totalScenes,
      popularSubjects,
      recentActivity,
      storage: storageUsage,
    });
  } catch (err) {
    console.error('[stats] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
