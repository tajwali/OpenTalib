import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET() {
  try {
    const auth = await requireRole(['teacher', 'admin']);
    if ('error' in auth) return auth.error;

    const teacherId = auth.user.id;
    const admin = getSupabaseAdmin();

    // 1. Basic Counts: Students, Courses, Assignments
    const [studentsRes, coursesRes, assignmentsRes] = await Promise.all([
      admin.from('user_profiles').select('id, display_name, grade').eq('teacher_id', teacherId),
      admin.from('classrooms').select('id, subject_id').eq('user_id', teacherId),
      admin.from('course_assignments').select('id').eq('assigned_by', teacherId),
    ]);

    const students = studentsRes.data || [];
    const courses = coursesRes.data || [];
    const assignments = assignmentsRes.data || [];

    const totalStudents = students.length;
    const totalCourses = courses.length;
    const totalAssignments = assignments.length;

    if (totalStudents === 0) {
      return NextResponse.json({
        totalStudents: 0,
        totalCourses,
        totalAssignments,
        avgQuizScore: 0,
        studentProgress: [],
        popularSubjects: [],
        recentActivity: [],
      });
    }

    const studentIds = students.map((s) => s.id);

    // 2. Quiz Results & Progress for teacher's students
    const [quizRes, progressRes, studentAssignmentsRes] = await Promise.all([
      admin
        .from('quiz_results')
        .select('user_id, percentage, taken_at, classroom_id')
        .in('user_id', studentIds)
        .order('taken_at', { ascending: false }),
      admin
        .from('course_progress')
        .select('user_id, classroom_id, completed, last_accessed')
        .in('user_id', studentIds),
      admin
        .from('course_assignments')
        .select('assigned_to, classroom_id')
        .in('assigned_to', studentIds),
    ]);

    const allQuizzes = quizRes.data || [];
    const allProgress = progressRes.data || [];
    const allStudentAssignments = studentAssignmentsRes.data || [];

    // Calculate average quiz score
    const avgQuizScore =
      allQuizzes.length > 0
        ? Math.round(
            allQuizzes.reduce((acc, q) => acc + (q.percentage || 0), 0) / allQuizzes.length,
          )
        : 0;

    // 3. Student Progress List
    const quizMap: Record<string, (typeof allQuizzes)[0]> = {};
    allQuizzes.forEach((q) => {
      if (!quizMap[q.user_id]) quizMap[q.user_id] = q;
    });

    const studentProgress = students.map((s) => {
      const studentAssns = allStudentAssignments.filter((a) => a.assigned_to === s.id);
      const studentProgs = allProgress.filter((p) => p.user_id === s.id);

      return {
        id: s.id,
        name: s.display_name,
        grade: s.grade,
        coursesAssigned: studentAssns.length,
        coursesCompleted: studentProgs.filter((p) => p.completed).length,
        lastQuizScore: quizMap[s.id]?.percentage || null,
        lastActive: quizMap[s.id]?.taken_at || studentProgs[0]?.last_accessed || null,
      };
    });

    // 4. Popular Subjects
    const subjectCounts: Record<string, number> = {};
    courses.forEach((c) => {
      if (c.subject_id) {
        subjectCounts[c.subject_id] = (subjectCounts[c.subject_id] || 0) + 1;
      }
    });

    const { data: subjects } = await admin.from('subjects').select('id, name, icon');
    const popularSubjects = (subjects || [])
      .map((sub) => ({
        name: sub.name,
        icon: sub.icon,
        courseCount: subjectCounts[sub.id] || 0,
      }))
      .filter((sub) => sub.courseCount > 0)
      .sort((a, b) => b.courseCount - a.courseCount)
      .slice(0, 5);

    // 5. Recent Activity (Recent quizzes)
    const recentQuizzes = allQuizzes.slice(0, 10);
    const uniqueClassIds = Array.from(new Set(recentQuizzes.map((q) => q.classroom_id)));
    const { data: classTitles } = await admin
      .from('classrooms')
      .select('id, title')
      .in('id', uniqueClassIds);

    const titleMap = new Map((classTitles || []).map((c) => [c.id, c.title]));
    const studentMap = new Map(students.map((s) => [s.id, s.display_name]));

    const recentActivity = recentQuizzes.map((q) => ({
      type: 'quiz',
      student: studentMap.get(q.user_id) || 'Unknown',
      course_title: titleMap.get(q.classroom_id) || 'Unknown',
      score: q.percentage,
      date: q.taken_at,
    }));

    return NextResponse.json({
      totalStudents,
      totalCourses,
      totalAssignments,
      avgQuizScore,
      studentProgress,
      popularSubjects,
      recentActivity,
    });
  } catch (err) {
    console.error('[teacher-stats] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
