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
import { ReviewQueue } from '@/components/dashboard/ReviewQueue';
import { StudyPlanner } from '@/components/dashboard/StudyPlanner';

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
            <h1 className="text-xl font-bold text-foreground">OpenTalib</h1>
            <p className="text-sm text-muted-foreground">
              {displayName ?? userEmail ?? 'My Dashboard'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/exam"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              📝 Mock Exam
            </a>
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
        <section className="mb-6">
          <h2 className="text-base font-medium mb-3">Today's Review</h2>
          <ReviewQueue />
        </section>

        <section className="mb-6">
          <StudyPlanner />
        </section>

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
                  <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
                    <th className="px-4 py-3 font-medium text-nowrap">Course</th>
                    <th className="px-4 py-3 font-medium text-nowrap">Score</th>
                    <th className="px-4 py-3 font-medium text-nowrap">Date</th>
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
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
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

      {/* Add Subject Modal */}
      {addingSubject && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold">Add Custom Subject</h3>
              <button
                onClick={() => setAddingSubject(false)}
                className="p-1 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Subject Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Physics"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Icon (Emoji)
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {['📚', '🧪', '🧬', '📐', '🌍', '⚖️', '💻', '🎨', '🧠', '🎭', '🎼', '⚽'].map(
                    (emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewSubIcon(emoji)}
                        className={`text-xl p-2 rounded-lg border transition-all ${
                          newSubIcon === emoji
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:bg-muted'
                        }`}
                      >
                        {emoji}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <button
                onClick={handleAddSubject}
                disabled={subSaving || !newSubName.trim()}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
              >
                {subSaving ? 'Saving...' : 'Add Subject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <div className="bg-card border border-border p-4 rounded-xl flex items-center gap-4">
      <div className="p-2 bg-muted rounded-lg">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
          {label}
        </p>
        <p className="text-lg font-bold">{value}</p>
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
  onUpdateSubject: (cid: string, sid: string) => void;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [showSubjectMenu, setShowSubjectMenu] = useState(false);

  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all flex flex-col relative">
      <div className="p-5 flex-1 cursor-pointer" onClick={onClick}>
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-2xl shadow-inner">
            {classroom.subject_icon || '📚'}
          </div>
          {classroom.completed && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5" />
              Completed
            </div>
          )}
        </div>

        <h3 className="font-bold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
          {classroom.short_title || classroom.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-4 line-clamp-1 opacity-80 font-medium">
          {classroom.subject_name || classroom.topic}
        </p>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          <span className="opacity-60">Created {new Date(classroom.created_at).toLocaleDateString()}</span>
          <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all group-hover:translate-x-1">
            →
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
        <div className="relative flex-1">
          <button
            onClick={() => setShowSubjectMenu(!showSubjectMenu)}
            className="w-full text-left px-3 py-1.5 rounded-lg border border-border bg-background text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors flex items-center justify-between"
          >
            <span className="truncate">{classroom.subject_name || 'Set Subject'}</span>
            <Plus className={`w-3 h-3 transition-transform ${showSubjectMenu ? 'rotate-45' : ''}`} />
          </button>

          {showSubjectMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowSubjectMenu(false)} />
              <div className="absolute bottom-full left-0 w-full mb-1 bg-card border border-border rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto p-1 animate-in slide-in-from-bottom-2 duration-200">
                <button
                  onClick={() => {
                    onUpdateSubject(classroom.id, 'none');
                    setShowSubjectMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted"
                >
                  None
                </button>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      onUpdateSubject(classroom.id, s.id);
                      setShowSubjectMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-muted ${
                      classroom.subject_id === s.id ? 'text-primary bg-primary/5' : 'text-foreground'
                    }`}
                  >
                    <span>{s.icon}</span>
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Delete course"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ExamCard({ exam, onNavigate }: { exam: Exam; onNavigate: () => void }) {
  return (
    <div
      onClick={onNavigate}
      className="group bg-card border border-border p-4 rounded-xl cursor-pointer hover:shadow-md transition-all flex items-center justify-between relative overflow-hidden"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold group-hover:text-primary transition-colors">
            {exam.title}
          </h4>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              {exam.difficulty} · {exam.time_limit_minutes}m
            </span>
            {exam.attempted && exam.result && (
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                  exam.result.percentage >= 50
                    ? 'bg-green-50 text-green-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                Score: {exam.result.percentage}%
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-muted-foreground group-hover:text-primary transition-colors translate-x-0 group-hover:translate-x-1 transition-transform">
        →
      </div>
    </div>
  );
}
