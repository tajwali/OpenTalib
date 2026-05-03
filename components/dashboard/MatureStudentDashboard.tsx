'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Plus,
  Trophy,
  BarChart2,
  LogOut,
  FileText,
  CheckCircle,
  Trash2,
  UserCircle,
  X,
} from 'lucide-react';

interface Classroom {
  id: string;
  title: string;
  short_title: string | null;
  topic: string;
  status: string;
  created_at: string;
  subject_id: string | null;
  subject_name: string | null;
  subject_icon: string | null;
  grade: string | null;
  completed?: boolean;
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
  last_scene_id: string | null;
  last_accessed: string | null;
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

export default function MatureStudentDashboard({ userEmail, displayName }: Props) {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
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
  const [addingSubject, setAddingSubject] = useState(false);
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('📚');
  const [subSaving, setSubSaving] = useState(false);

  const loadAll = useCallback(() => {
    const safeJson = (r: Response) => (r.ok ? r.json().catch(() => null) : Promise.resolve(null));
    Promise.all([
      fetch('/api/user/classrooms')
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
      fetch('/api/subjects')
        .then(safeJson)
        .catch(() => null),
    ])
      .then(([courses, userStats, quizzes, examList, progressList, subs]) => {
        const progressMap = new Map<string, boolean>();
        if (Array.isArray(progressList)) {
          for (const p of progressList as CourseProgress[]) {
            progressMap.set(p.classroom_id, p.completed ?? false);
          }
        }
        const rawCourses = Array.isArray(courses) ? (courses as Classroom[]) : [];
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
        setSubjects(Array.isArray(subs) ? (subs as Subject[]) : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const updateCourseSubject = async (courseId: string, subjectId: string) => {
    try {
      const res = await fetch(`/api/user/classrooms/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subjectId === 'none' ? null : subjectId }),
      });
      if (res.ok) {
        loadAll();
      }
    } catch {
      /* ignore */
    }
  };

  const handleAddSubject = async () => {
    if (!newSubName.trim()) return;
    setSubSaving(true);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSubName, icon: newSubIcon }),
      });
      if (res.ok) {
        setAddingSubject(false);
        setNewSubName('');
        loadAll();
      }
    } finally {
      setSubSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm('Delete this course? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/user/classrooms?id=${id}`, { method: 'DELETE' });
      if (res.ok) setClassrooms((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* ignore */
    }
  };

  // Group classrooms by subject
  const grouped: { label: string; icon: string; courses: Classroom[] }[] = [];
  const seen = new Set<string>();
  for (const c of classrooms) {
    const key = c.subject_id ?? '__none__';
    if (!seen.has(key)) {
      seen.add(key);
      grouped.push({
        label: c.subject_name ?? 'Other',
        icon: c.subject_icon ?? '📚',
        courses: classrooms.filter((x) => (x.subject_id ?? '__none__') === key),
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenMAIC</h1>
            <p className="text-sm text-muted-foreground">
              {displayName ?? userEmail ?? 'My Dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/exam/create')}
              className="flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <FileText className="w-4 h-4" />
              Create Exam
            </button>
            <button
              onClick={() => router.push('/generate')}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              New Course
            </button>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-blue-500" />}
            label="Courses Owned"
            value={stats.totalCourses}
          />
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-blue-500" />}
            label="Assigned Courses"
            value={stats.assignedCourses}
          />
          <StatCard
            icon={<Trophy className="w-5 h-5 text-yellow-500" />}
            label="Quizzes Taken"
            value={stats.quizzesTaken}
          />
          <StatCard
            icon={<BarChart2 className="w-5 h-5 text-green-500" />}
            label="Avg Score"
            value={stats.avgScore !== null ? `${stats.avgScore}%` : '--'}
          />
          <StatCard
            icon={<BookOpen className="w-5 h-5 text-purple-500" />}
            label="Completed"
            value={stats.coursesCompleted}
          />
        </div>

        {/* Courses grouped by subject */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">My Courses</h2>

            {/* Subject Filter Bar */}
            {!loading && classrooms.length > 0 && subjects.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-nowrap">
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
                <button
                  onClick={() => setAddingSubject(true)}
                  className="shrink-0 p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                  title="Add custom subject"
                >
                  <Plus className="w-4 h-4" />
                </button>
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
                No courses yet — generate your first!
              </p>
              <button
                onClick={() => router.push('/generate')}
                className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Generate a Course
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {grouped
                .filter((group) => {
                  if (selectedSubjectId === 'all') return true;
                  // Find the subject id for this group label
                  const sampleCourse = group.courses[0];
                  return sampleCourse?.subject_id === selectedSubjectId;
                })
                .map((group) => (
                  <div key={group.label}>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      <span>{group.icon}</span>
                      <span>{group.label}</span>
                      <span className="ml-1 text-xs font-normal normal-case">
                        ({group.courses.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {group.courses.map((c) => (
                        <CourseCard
                          key={c.id}
                          classroom={c}
                          subjects={subjects}
                          onUpdateSubject={updateCourseSubject}
                          onClick={() => router.push(`/classroom/${c.id}`)}
                          onDelete={() => handleDeleteCourse(c.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              {grouped.filter((group) => {
                if (selectedSubjectId === 'all') return true;
                const sampleCourse = group.courses[0];
                return sampleCourse?.subject_id === selectedSubjectId;
              }).length === 0 && (
                <div className="text-center py-12 border border-dashed border-border rounded-xl bg-muted/20">
                  <p className="text-muted-foreground text-sm">
                    No courses found for this subject.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Exams */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">My Exams</h2>
            <button
              onClick={() => router.push('/exam/create')}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Create Exam
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">
                No exams yet — create one from your courses
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {exams.map((e) => (
                <ExamCard key={e.id} exam={e} onNavigate={() => router.push(`/exam/${e.id}`)} />
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

      {/* ── Add Subject Modal ── */}
      {addingSubject && (
        <Modal onClose={() => setAddingSubject(false)} title="Add Custom Subject">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Subject Name
              </label>
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="e.g. Astrophysics, Digital Art"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">
                Select Icon
              </label>
              <div className="grid grid-cols-6 gap-2">
                {['📚', '🔬', '💻', '🎨', '🏥', '⚖️', '🌍', '🛠️', '🧬', '🧠', '🎹', '🏀'].map(
                  (icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewSubIcon(icon)}
                      className={`text-xl p-2 rounded-lg border transition-all ${newSubIcon === icon ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'border-border hover:bg-muted'}`}
                    >
                      {icon}
                    </button>
                  ),
                )}
              </div>
            </div>
            <button
              onClick={handleAddSubject}
              disabled={subSaving || !newSubName.trim()}
              className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-md shadow-primary/20"
            >
              {subSaving ? 'Adding...' : 'Add Subject'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ExamCard({ exam, onNavigate }: { exam: Exam; onNavigate: () => void }) {
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
        <p className="font-medium text-sm text-foreground line-clamp-2">{exam.title}</p>
        {exam.attempted && <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{exam.question_count} questions</span>
        <span>{exam.time_limit_minutes} min</span>
        <span className="capitalize">{exam.difficulty}</span>
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
              Review
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

function ScoreBadge({ pct, label }: { pct: number; label?: string }) {
  const rounded = Math.round(pct);
  const color =
    rounded >= 80
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : rounded >= 60
        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label ?? `${rounded}%`}
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

function CourseCard({
  classroom,
  subjects,
  onUpdateSubject,
  onClick,
  onDelete,
}: {
  classroom: Classroom;
  subjects: Subject[];
  onUpdateSubject: (id: string, subId: string) => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  const date = new Date(classroom.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const displayTitle = (classroom.short_title ?? classroom.title ?? '').slice(0, 60);
  return (
    <div className="relative group bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-md transition-all flex flex-col h-full">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        title="Delete course"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
      <div onClick={onClick} className="flex-1 cursor-pointer">
        <div className="flex items-start justify-between mb-2 pr-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold uppercase tracking-wider">
              {classroom.status}
            </span>
            {classroom.grade && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold">
                G{classroom.grade}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
            {displayTitle}
          </p>
          <span
            className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono hover:bg-muted/80 transition-colors cursor-pointer shrink-0"
            title="Click to copy full course ID"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(classroom.id);
            }}
          >
            #{classroom.id.slice(-6)}
          </span>
        </div>
        {classroom.short_title && classroom.title !== classroom.short_title && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{classroom.title}</p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {classroom.completed && (
            <span title="Completed" className="text-green-500">
              <CheckCircle className="w-3.5 h-3.5" />
            </span>
          )}
          <select
            value={classroom.subject_id || 'none'}
            onChange={(e) => onUpdateSubject(classroom.id, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-bold border-0 cursor-pointer focus:ring-1 focus:ring-purple-400/50 appearance-none hover:bg-purple-200 dark:hover:bg-purple-800/40 transition-colors"
          >
            <option value="none">No Subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icon} {s.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={onClick} className="text-xs font-medium text-primary hover:underline">
          Open →
        </button>
      </div>
    </div>
  );
}
