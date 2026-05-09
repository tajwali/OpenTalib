'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  BarChart2,
  Trophy,
  LogOut,
  FileText,
  CheckCircle,
  UserCircle,
} from 'lucide-react';
import { ReviewQueue } from '@/components/dashboard/ReviewQueue';
import { StudyPlanner } from '@/components/dashboard/StudyPlanner';

interface AssignedClassroom {
  id: string;
  title: string;
  short_title: string | null;
  topic: string;
  status: string;
  assigned_at: string;
  completed?: boolean;
  grade: number | null;
  subject_id: string | null;
  subject_icon: string | null;
  subject_name: string | null;
}

interface Stats {
  totalCourses: number;
  assignedCourses: number;
  quizzesTaken: number;
  avgScore: number | null;
  coursesCompleted: number;
}

interface QuizResult {
  id: string;
  classroom_id: string;
  classroom_title: string | null;
  scene_id: string;
  score: number;
  total: number;
  percentage: number;
  taken_at: string;
}

interface ExamResult {
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at?: string;
}

interface Exam {
  id: string;
  title: string;
  time_limit_minutes: number;
  difficulty: string;
  question_count: number;
  created_at: string;
  attempted: boolean;
  result: ExamResult | null;
}

interface CourseProgress {
  classroom_id: string;
  completed: boolean;
}

interface Subject {
  id: string;
  name: string;
  icon: string;
}

interface Props {
  userEmail?: string;
  displayName?: string;
}

export default function SchoolStudentDashboard({ userEmail, displayName }: Props) {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<AssignedClassroom[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [stats, setStats] = useState<Stats>({
    totalCourses: 0,
    assignedCourses: 0,
    quizzesTaken: 0,
    avgScore: null,
    coursesCompleted: 0,
  });
  const [quizHistory, setQuizHistory] = useState<QuizResult[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentGrade, setStudentGrade] = useState<number | null>(null);

  useEffect(() => {
    const safeJson = (r: Response) => (r.ok ? r.json().catch(() => null) : Promise.resolve(null));
    Promise.all([
      fetch('/api/user/assigned-classrooms')
        .then(safeJson)
        .catch(() => null),
      fetch('/api/user/stats')
        .then(safeJson)
        .catch(() => null),
      fetch('/api/user/quiz-results')
        .then(safeJson)
        .catch(() => null),
      fetch('/api/exams')
        .then(safeJson)
        .catch(() => null),
      fetch('/api/user/course-progress')
        .then(safeJson)
        .catch(() => null),
      fetch('/api/user/profile')
        .then(safeJson)
        .catch(() => null),
      fetch('/api/subjects')
        .then(safeJson)
        .catch(() => null),
    ])
      .then(([courses, userStats, quizzes, examList, progressList, profile, subs]) => {
        const progressMap = new Map<string, boolean>();
        if (Array.isArray(progressList)) {
          for (const p of progressList as CourseProgress[]) {
            progressMap.set(p.classroom_id, p.completed ?? false);
          }
        }
        const rawCourses = Array.isArray(courses) ? (courses as AssignedClassroom[]) : [];
        setClassrooms(rawCourses.map((c) => ({ ...c, completed: progressMap.get(c.id) ?? false })));
        setStats(
          (userStats as Stats | null) ?? {
            totalCourses: 0,
            assignedCourses: 0,
            quizzesTaken: 0,
            avgScore: null,
            coursesCompleted: 0,
          },
        );
        setQuizHistory(Array.isArray(quizzes) ? (quizzes as QuizResult[]).slice(0, 5) : []);
        setExams(Array.isArray(examList) ? (examList as Exam[]) : []);
        if (profile?.grade) setStudentGrade(parseInt(profile.grade));
        setSubjects(Array.isArray(subs) ? (subs as Subject[]) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">OpenTalib</h1>
              {studentGrade && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                  Grade {studentGrade}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {displayName ?? userEmail ?? 'My Dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <a
              href="/exam"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors mr-2"
            >
              📝 Mock Exam
            </a>
            <button
              onClick={() => router.push('/profile')}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              title="Profile settings"
            >
              <UserCircle className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section className="mb-6">
          <h2 className="text-base font-medium mb-3">Today's Review</h2>
          <ReviewQueue />
        </section>

        <section className="mb-6">
          <StudyPlanner />
        </section>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-blue-500" />}
            label="Assigned Courses"
            value={stats.assignedCourses}
          />
          <StatCard
            icon={<Trophy className="w-5 h-5 text-green-500" />}
            label="Completed"
            value={stats.coursesCompleted}
          />
          <StatCard
            icon={<BarChart2 className="w-5 h-5 text-yellow-500" />}
            label="Avg Score"
            value={stats.avgScore !== null ? `${stats.avgScore}%` : '--'}
          />
        </div>

        {/* Course Grid */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Assigned Courses</h2>

            {/* Subject Filter Bar */}
            {!loading && classrooms.length > 0 && subjects.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Filter by:
                </span>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm bg-background cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : classrooms.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
              <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No courses assigned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms
                .filter((c) => selectedSubjectId === 'all' || c.subject_id === selectedSubjectId)
                .map((c) => (
                  <CourseCard
                    key={c.id}
                    classroom={c}
                    onClick={() => router.push(`/classroom/${c.id}`)}
                  />
                ))}
            </div>
          )}
        </section>

        {/* Quiz History */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Recent Quiz Results</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : quizHistory.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">No quizzes taken yet</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium">Course</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quizHistory.map((q) => (
                    <tr key={q.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{q.classroom_title || 'Untitled'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold ${
                            q.percentage >= 80
                              ? 'text-green-600'
                              : q.percentage >= 50
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          {q.score}/{q.total} ({q.percentage}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(q.taken_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4">
      <div className="p-2 bg-muted rounded-lg">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {label}
        </p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  );
}

function CourseCard({ classroom, onClick }: { classroom: AssignedClassroom; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group bg-card border border-border p-5 rounded-xl cursor-pointer hover:shadow-md transition-all relative overflow-hidden"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-xl">
          {classroom.subject_icon || '📚'}
        </div>
        {classroom.completed && (
          <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full uppercase">
            <CheckCircle className="w-3 h-3" />
            Done
          </div>
        )}
      </div>

      <h3 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">
        {classroom.short_title || classroom.title}
      </h3>
      <p className="text-xs text-muted-foreground mb-4 line-clamp-1">
        {classroom.subject_name || classroom.topic}
      </p>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
        <span>Assigned {new Date(classroom.assigned_at).toLocaleDateString()}</span>
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          →
        </div>
      </div>
    </div>
  );
}
