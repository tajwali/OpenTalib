import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    // Get student's grade first
    const { data: profile } = await admin
      .from('user_profiles')
      .select('grade')
      .eq('id', user.id)
      .single();

    const studentGrade = profile?.grade ? parseInt(String(profile.grade)) : null;

    let query = admin
      .from('course_assignments')
      .select(
        `
        classroom_id,
        assigned_at,
        assigned_by,
        classrooms (
          id,
          title,
          short_title,
          topic,
          status,
          grade
        )
      `,
      )
      .eq('assigned_to', user.id);

    if (studentGrade) {
      // If student has a grade, only show courses for that grade OR courses with no grade (null)
      // Note: we filter in JS below for simpler join logic if nested filtering is tricky in PostgREST
    }

    const { data, error } = await query.order('assigned_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = (data ?? [])
      .filter((row: any) => {
        if (!studentGrade) return true;
        const classroomGrade = row.classrooms?.grade;
        return !classroomGrade || classroomGrade === studentGrade;
      })
      .map((row: any) => ({
        id: row.classrooms?.id ?? row.classroom_id,
        title: row.classrooms?.title ?? '',
        short_title: row.classrooms?.short_title ?? null,
        topic: row.classrooms?.topic ?? '',
        status: row.classrooms?.status ?? '',
        assigned_at: row.assigned_at,
        assigned_by: row.assigned_by,
        grade: row.classrooms?.grade ?? null,
      }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
