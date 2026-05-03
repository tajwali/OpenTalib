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

interface AssignedClassroom {
  id: string;
  title: string;
  short_title: string | null;
  topic: string;
  status: string;
  assigned_at: string;
  completed?: boolean;
  grade: number | null;
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
              <h1 className="text-xl font-bold text-foreground">OpenMAIC</h1>
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
              <p className="text-muted-foreground font-medium">
                No courses assigned yet — ask your teacher
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms
                .filter(
                  (c) => selectedSubjectId === 'all' || (c as any).subject_id === selectedSubjectId,
                )
                .map((c) => {
                  const displayTitle = (c.short_title || c.title || '').slice(0, 60);
                  const subjectIcon = (c as any).subject_icon;
                  const subjectName = (c as any).subject_name;
                  return (
                    <button
                      key={c.id}
                      onClick={() => router.push(`/classroom/${c.id}`)}
                      className="text-left bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider">
                            assigned
                          </span>
                          {c.grade && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold">
                              G{c.grade}
                            </span>
                          )}
                          {subjectName && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold flex items-center gap-1">
                              <span>{subjectIcon}</span>
                              <span>{subjectName}</span>
                            </span>
                          )}
                          {c.completed && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(c.assigned_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {displayTitle}
                        </p>
                        <span
                          className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono hover:bg-muted/80 transition-colors cursor-pointer shrink-0"
                          title="Click to copy full course ID"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(c.id);
                          }}
                        >
                          #{c.id.slice(-6)}
                        </span>
                      </div>
                      {c.short_title && c.title !== c.short_title && (
                        <p
                          className="text-[11px] text-muted-foreground line-clamp-1"
                          title={c.title}
                        >
                          {c.title}
                        </p>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
          {classrooms.filter(
            (c) => selectedSubjectId === 'all' || (c as any).subject_id === selectedSubjectId,
          ).length === 0 &&
            classrooms.length > 0 && (
              <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
                <p className="text-muted-foreground text-sm">
                  No assigned courses found for this subject.
                </p>
              </div>
            )}
        </section>

        {/* My Exams */}
        <section>
          <h2 className="text-lg font-semibold mb-4">My Exams</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No exams assigned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {exams.map((e, i) => (
                <ExamCard
                  key={e.id}
                  exam={e}
                  index={i}
                  onNavigate={() => router.push(`/exam/${e.id}`)}
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
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                      Course
                    </th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                      Score
                    </th>
                    <th className="text-center px-4 py-2.5 font-medium text-muted-foreground">
                      Result
                    </th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {quizHistory.map((q) => (
                    <tr
                      key={q.id}
                      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="truncate text-foreground">
                          {q.classroom_title ?? q.classroom_id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {q.score}/{q.total}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ScoreBadge pct={q.percentage} />
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">
                        {new Date(q.taken_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExamCard({
  exam,
  index,
  onNavigate,
}: {
  exam: Exam;
  index: number;
  onNavigate: () => void;
}) {
  const r = exam.result;
  const pct = r ? Math.round(r.percentage) : null;
  const scoreColor =
    pct === null
      ? ''
      : pct >= 80
        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
        : pct >= 60
          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sm text-foreground line-clamp-2">
          Exam #{index + 1} — {exam.title}
        </p>
        {exam.attempted && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{exam.question_count} questions</span>
        <span>{exam.time_limit_minutes} min</span>
      </div>
      {r ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${scoreColor}`}>
              {r.score}/{r.total_questions} — {pct}%
            </span>
            {r.submitted_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(r.submitted_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onNavigate}
              className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              Review Results
            </button>
            <button
              onClick={onNavigate}
              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Retake
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Not taken yet</span>
          <button
            onClick={onNavigate}
            className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
          >
            Take Exam →
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreBadge({ pct }: { pct: number }) {
  const rounded = Math.round(pct);
  const color =
    rounded >= 80
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : rounded >= 60
        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {rounded}%
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
