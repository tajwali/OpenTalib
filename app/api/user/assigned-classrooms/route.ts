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

    const query = admin
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
          grade,
          subject_id,
          subjects (
            name,
            icon
          )
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

    // Define the shape of the raw database row based on Supabase join behavior
    interface RawAssignmentRow {
      classroom_id: string;
      assigned_at: string;
      assigned_by: string;
      classrooms: Array<{
        id: string;
        title: string;
        short_title: string | null;
        topic: string;
        status: string;
        grade: number | null;
        subject_id: string | null;
        subjects:
          | Array<{
              name: string;
              icon: string;
            }>
          | { name: string; icon: string }
          | null;
      }> | null;
    }

    const result = (data as unknown as RawAssignmentRow[])
      .filter((row) => {
        if (!studentGrade) return true;
        const classroom = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms;
        const classroomGrade = classroom?.grade;
        return !classroomGrade || classroomGrade === studentGrade;
      })
      .map((row) => {
        const classroom = Array.isArray(row.classrooms) ? row.classrooms[0] : row.classrooms;
        const subjectsData = classroom?.subjects;
        const subject = Array.isArray(subjectsData) ? subjectsData[0] : subjectsData;

        return {
          id: classroom?.id ?? row.classroom_id,
          title: classroom?.title ?? '',
          short_title: classroom?.short_title ?? null,
          topic: classroom?.topic ?? '',
          status: classroom?.status ?? '',
          assigned_at: row.assigned_at,
          assigned_by: row.assigned_by,
          grade: classroom?.grade ?? null,
          subject_id: classroom?.subject_id ?? null,
          subject_name: subject?.name ?? null,
          subject_icon: subject?.icon ?? null,
        };
      });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
