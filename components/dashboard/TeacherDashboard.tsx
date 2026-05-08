'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  BookOpen,
  ClipboardList,
  LogOut,
  Copy,
  Check,
  RefreshCw,
  X,
  ChevronRight,
  FileText,
  BarChart2,
  ChevronDown,
  UserCircle,
  Pencil,
  Trash2,
  Activity,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Student {
  id: string;
  display_name: string;
  grade: string | null;
  school: string | null;
  coursesAssigned: number;
  lastQuizScore: number | null;
  lastAccessed: string | null;
}

interface Course {
  id: string;
  title: string;
  short_title: string | null;
  topic: string;
  status: string;
  created_at: string;
  grade: string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_icon: string | null;
}

interface Subject {
  id: string;
  name: string;
  icon: string;
}

interface Assignment {
  id: string;
  classroom_id: string;
  classroom_title: string;
  student_id: string;
  student_name: string;
  assigned_at: string;
}

interface StudentProgress {
  student: { id: string; display_name: string; grade: string | null; school: string | null };
  stats: { quizzesTaken: number; avgScore: number | null };
  assignments: {
    classroom_id: string;
    classroom_title: string;
    assigned_at: string;
    completed: boolean;
    last_accessed: string | null;
  }[];
  recentQuizzes: {
    classroom_title: string;
    score: number;
    total: number;
    percentage: number;
    taken_at: string;
  }[];
}

interface TeacherStats {
  totalStudents: number;
  totalCourses: number;
  totalAssignments: number;
  avgQuizScore: number;
  studentProgress: {
    id: string;
    name: string;
    grade: string | null;
    coursesAssigned: number;
    coursesCompleted: number;
    lastQuizScore: number | null;
    lastActive: string | null;
  }[];
  popularSubjects: { name: string; icon: string; courseCount: number }[];
  recentActivity: {
    type: string;
    student: string;
    course_title: string;
    score: number;
    date: string;
  }[];
}

interface HeatmapData {
  students: { id: string; display_name: string }[];
  heatmap: Record<string, Record<string, number>>;
  atRisk: string[];
}

type Tab = 'students' | 'courses' | 'assignments' | 'exam-results' | 'analytics';

interface ExamResultRow {
  student_name: string;
  score: number;
  total_questions: number;
  percentage: number;
  completed_at: string | null;
}

interface ExamWithResults {
  exam_id: string;
  exam_title: string;
  results: ExamResultRow[];
}

interface Props {
  userEmail?: string;
  displayName?: string;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function TeacherDashboard({ userEmail, displayName }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('students');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentProgress | null>(null);
  const [assignModal, setAssignModal] = useState<Course | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);
  const [examResults, setExamResults] = useState<ExamWithResults[]>([]);
  const [examResultsLoading, setExamResultsLoading] = useState(false);
  const [expandedExams, setExpandedExams] = useState<Set<string>>(new Set());
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmCourse, setDeleteConfirmCourse] = useState<Course | null>(null);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);

  // Student edit modal
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentGrade, setEditStudentGrade] = useState('');
  const [editStudentPassword, setEditStudentPassword] = useState('');
  const [editStudentSaving, setEditStudentSaving] = useState(false);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    const safeJson = (r: Response) => (r.ok ? r.json().catch(() => null) : Promise.resolve(null));
    Promise.all([
      fetch('/api/teacher/invite-code').then(safeJson).catch(() => null),
      fetch('/api/teacher/students').then(safeJson).catch(() => null),
      fetch('/api/teacher/courses').then(safeJson).catch(() => null),
      fetch('/api/teacher/assign-course').then(safeJson).catch(() => null),
      fetch('/api/subjects').then(safeJson).catch(() => null),
      fetch('/api/teacher/stats').then(safeJson).catch(() => null),
      fetch('/api/teacher/heatmap').then(safeJson).catch(() => null),
    ])
      .then(([ic, studs, crses, asns, subs, stats, heat]) => {
        setInviteCode((ic as { invite_code?: string } | null)?.invite_code ?? null);
        setStudents(Array.isArray(studs) ? (studs as Student[]) : []);
        setCourses(Array.isArray(crses) ? (crses as Course[]) : []);
        setAssignments(Array.isArray(asns) ? (asns as Assignment[]) : []);
        setSubjects(Array.isArray(subs) ? (subs as Subject[]) : []);
        setTeacherStats(stats as TeacherStats | null);
        setHeatmapData(heat as HeatmapData | null);
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
      if (res.ok) loadAll();
    } catch {}
  };

  const unassignCourse = async (assignment: Assignment) => {
    setUnassigningId(assignment.id);
    try {
      const res = await fetch('/api/teacher/assign-course', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroom_id: assignment.classroom_id,
          student_id: assignment.student_id,
        }),
      });
      if (res.ok) setAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
    } finally {
      setUnassigningId(null);
    }
  };

  const deleteCourse = async (course: Course) => {
    setDeletingId(course.id);
    try {
      const res = await fetch(`/api/user/classrooms?id=${course.id}`, { method: 'DELETE' });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c.id !== course.id));
        setDeleteConfirmCourse(null);
        loadAll();
      }
    } finally {
      setDeletingId(null);
    }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submitAssign = async () => {
    if (!assignModal || selectedStudentIds.size === 0) return;
    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await fetch('/api/teacher/assign-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classroom_id: assignModal.id,
          student_ids: Array.from(selectedStudentIds),
        }),
      });
      if (res.ok) {
        setAssignResult(`✓ Assigned to ${selectedStudentIds.size} students`);
        setTimeout(() => {
          setAssignModal(null);
          setAssignResult(null);
          setSelectedStudentIds(new Set());
          loadAll();
        }, 1500);
      } else {
        setAssignResult('Failed to assign course');
      }
    } catch {
      setAssignResult('Error assigning course');
    } finally {
      setAssigning(false);
    }
  };

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showStudentProgress = async (studentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/student-progress?id=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedStudent(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const handleEditStudent = (s: Student) => {
    setEditingStudent(s);
    setEditStudentName(s.display_name);
    setEditStudentGrade(s.grade || '');
    setEditStudentPassword('');
    setEditStudentError(null);
  };

  const handleSaveStudent = async () => {
    if (!editingStudent) return;
    if (editStudentName.trim().length < 2) {
      setEditStudentError('Name too short');
      return;
    }
    setEditStudentSaving(true);
    try {
      const res = await fetch(`/api/teacher/students`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStudent.id,
          display_name: editStudentName,
          grade: editStudentGrade || null,
          password: editStudentPassword || undefined,
        }),
      });
      if (res.ok) {
        setEditingStudent(null);
        loadAll();
      } else {
        const err = await res.json();
        setEditStudentError(err.error || 'Failed to save');
      }
    } catch {
      setEditStudentError('Error saving changes');
    } finally {
      setEditStudentSaving(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* ── Sidebar ── */}
      <aside className="w-full lg:w-72 border-b lg:border-r border-border flex flex-col bg-card shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight text-foreground uppercase">
                OpenTalib
              </h1>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Teacher Panel
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            <NavItem
              active={tab === 'students'}
              onClick={() => setTab('students')}
              icon={<Users className="w-4 h-4" />}
              label="My Students"
            />
            <NavItem
              active={tab === 'courses'}
              onClick={() => setTab('courses')}
              icon={<BookOpen className="w-4 h-4" />}
              label="My Courses"
            />
            <NavItem
              active={tab === 'assignments'}
              onClick={() => setTab('assignments')}
              icon={<ClipboardList className="w-4 h-4" />}
              label="Assignments"
            />
            <NavItem
              active={tab === 'exam-results'}
              onClick={() => setTab('exam-results')}
              icon={<FileText className="w-4 h-4" />}
              label="Exam Results"
            />
            <NavItem
              active={tab === 'analytics'}
              onClick={() => setTab('analytics')}
              icon={<BarChart2 className="w-4 h-4" />}
              label="Analytics"
            />
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-border space-y-4">
          <div className="bg-muted/40 rounded-xl p-4 border border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Student Invite Code
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border border-border px-2 py-1.5 rounded text-sm font-mono font-bold text-primary">
                {inviteCode || '...'}
              </code>
              <button
                onClick={handleCopy}
                className="p-2 rounded-lg bg-background border border-border hover:bg-muted transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground border border-border">
              <UserCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">
                {displayName || userEmail || 'Teacher'}
              </p>
              <button
                onClick={handleLogout}
                className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-destructive transition-colors flex items-center gap-1"
              >
                Sign Out <LogOut className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        {/* ── Tab: Students ── */}
        {tab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
                My Students
              </h2>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-24 border-2 border-dashed border-border rounded-2xl bg-muted/20">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium mb-2">No students yet</p>
                <p className="text-sm text-muted-foreground/60 max-w-xs mx-auto">
                  Share your invite code with students so they can join your class.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer flex flex-col"
                    onClick={() => showStudentProgress(s.id)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          <UserCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground leading-tight">
                            {s.display_name}
                          </h3>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                            {s.grade ? `Grade ${s.grade}` : 'No Grade'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditStudent(s);
                          }}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-foreground">
                          {s.coursesAssigned}
                        </p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                          Assigned
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black text-foreground">
                          {s.lastQuizScore !== null ? `${s.lastQuizScore}%` : '—'}
                        </p>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                          Last Quiz
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Courses ── */}
        {tab === 'courses' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-2xl font-black tracking-tight text-foreground uppercase">
                My Courses
              </h2>
              <div className="flex flex-wrap gap-2">
                <select
                  className="px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-bold uppercase tracking-wider text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                >
                  <option value="all">All Subjects</option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => router.push('/generate')}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" /> Create New
                </button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-24 border-2 border-dashed border-border rounded-2xl bg-muted/20">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground font-medium">No courses found</p>
                <button
                  onClick={() => router.push('/generate')}
                  className="mt-4 text-sm font-bold text-primary hover:underline"
                >
                  Create your first course →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courses
                  .filter((c) => selectedSubjectId === 'all' || c.subject_id === selectedSubjectId)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 flex flex-col"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl group-hover:bg-primary/10 transition-colors">
                          {c.subject_icon || '📚'}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setDeleteConfirmCourse(c)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h3 className="font-bold text-foreground mb-1 leading-tight line-clamp-2 min-h-[2.5rem]">
                        {c.title}
                      </h3>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-0.5 rounded">
                          {c.grade ? `Grade ${c.grade}` : 'General'}
                        </span>
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                          {c.subject_name || 'Uncategorized'}
                        </span>
                      </div>

                      <div className="mt-auto pt-4 border-t border-border/50 flex items-center justify-between">
                        <button
                          onClick={() => router.push(`/classroom/${c.id}`)}
                          className="text-xs font-bold text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                        >
                          View <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => {
                            setAssignModal(c);
                            setSelectedStudentIds(new Set());
                          }}
                          className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
                        >
                          Assign Students
                        </button>
                      </div>
                    </div>
                  ))}
                {courses.filter((c) => selectedSubjectId === 'all' || c.subject_id === selectedSubjectId).length === 0 && (
                  <div className="col-span-full py-12 text-center">
                    <p className="text-muted-foreground text-sm">
                      No courses found for this subject.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Assignments ── */}
        {tab === 'assignments' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">Course Assignments</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  No assignments yet — assign courses from the My Courses tab
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Course
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Student
                      </th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">
                        Assigned
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-foreground truncate max-w-[200px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate">{a.classroom_title}</span>
                            <span
                              className="shrink-0 px-1 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-mono hover:bg-muted/80 transition-colors cursor-pointer"
                              title="Click to copy full ID"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(a.classroom_id);
                              }}
                            >
                              #{a.classroom_id.slice(-6)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{a.student_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(a.assigned_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => unassignCourse(a)}
                            disabled={unassigningId === a.id}
                            className="px-3 py-1 rounded-md text-xs font-medium text-destructive border border-destructive/40 hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          >
                            {unassigningId === a.id ? 'Removing…' : 'Unassign'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* ── Tab: Exam Results ── */}
        {tab === 'exam-results' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Exam Results</h2>
            {examResultsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : examResults.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-border rounded-xl">
                <BarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No exams created yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {examResults.map((exam) => {
                  const isExpanded = expandedExams.has(exam.exam_id);
                  const completed = exam.results.length;
                  return (
                    <div
                      key={exam.exam_id}
                      className="bg-card border border-border rounded-xl overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setExpandedExams((prev) => {
                            const next = new Set(prev);
                            if (next.has(exam.exam_id)) next.delete(exam.exam_id);
                            else next.add(exam.exam_id);
                            return next;
                          })
                        }
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="text-left">
                          <p className="font-medium text-foreground">{exam.exam_title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {completed} student{completed !== 1 ? 's' : ''} completed
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {isExpanded && (
                        <div className="border-t border-border">
                          {exam.results.length === 0 ? (
                            <p className="px-5 py-4 text-sm text-muted-foreground">
                              No students have completed this exam yet.
                            </p>
                          ) : (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  <th className="text-left px-5 py-2.5 font-medium text-muted-foreground">
                                    Student
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
                                {exam.results.map((r, i) => (
                                  <tr
                                    key={i}
                                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                                  >
                                    <td className="px-5 py-3 font-medium text-foreground">
                                      {r.student_name}
                                    </td>
                                    <td className="px-4 py-3 text-center text-muted-foreground">
                                      {r.score}/{r.total_questions}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <ScoreBadge pct={r.percentage} />
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                                      {r.completed_at
                                        ? new Date(r.completed_at).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                          })
                                        : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Analytics ── */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Student Analytics</h2>

            {loading || !teacherStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                  ))}
                </div>
                <div className="h-64 rounded-xl bg-muted animate-pulse" />
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Total Students
                    </p>
                    <p className="text-3xl font-black text-foreground">
                      {teacherStats.totalStudents}
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Total Courses
                    </p>
                    <p className="text-3xl font-black text-foreground">
                      {teacherStats.totalCourses}
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Assignments
                    </p>
                    <p className="text-3xl font-black text-foreground">
                      {teacherStats.totalAssignments}
                    </p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Avg Quiz Score
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-black text-foreground">
                        {teacherStats.avgQuizScore}%
                      </p>
                      <ScoreBadge pct={teacherStats.avgQuizScore} />
                    </div>
                  </div>
                </div>

                {/* Concept Mastery Heatmap */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-border bg-muted/10 flex items-center justify-between">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                      Concept Mastery Heatmap
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Weak</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Mastered</span>
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    {!heatmapData || Object.keys(heatmapData.heatmap).length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground italic text-sm">
                        No mastery data available yet.
                      </div>
                    ) : (
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border">
                            <th className="text-left px-5 py-3 font-bold text-muted-foreground sticky left-0 bg-card z-10 border-r border-border min-w-[150px]">Concept</th>
                            {heatmapData.students.map(s => (
                              <th key={s.id} className="px-2 py-3 font-bold text-muted-foreground text-center min-w-[60px]">
                                <div className="truncate w-12 mx-auto">
                                  {s.display_name}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {Object.entries(heatmapData.heatmap).map(([concept, studentScores]) => (
                            <tr key={concept} className="hover:bg-muted/5 transition-colors">
                              <td className="px-5 py-2 font-medium text-foreground sticky left-0 bg-card z-10 border-r border-border truncate max-w-[200px]" title={concept}>
                                {concept}
                              </td>
                              {heatmapData.students.map(s => {
                                const score = studentScores[s.id];
                                return (
                                  <td key={s.id} className="p-0.5 text-center">
                                    {score !== undefined ? (
                                      <div 
                                        className={`w-full h-8 rounded flex items-center justify-center font-bold transition-all ${
                                          score >= 80 ? 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30' :
                                          score >= 50 ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30' :
                                          'bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500/30'
                                        }`}
                                        title={`${s.display_name}: ${score}%`}
                                      >
                                        {score}
                                      </div>
                                    ) : (
                                      <div className="w-full h-8 rounded bg-muted/20 border border-transparent" />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Student Progress Table */}
                  <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-border bg-muted/10">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                        Student Progress
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                            <th className="text-left px-5 py-2.5 font-medium">Student</th>
                            <th className="text-center px-4 py-2.5 font-medium">Grade</th>
                            <th className="text-center px-4 py-2.5 font-medium">Assigned</th>
                            <th className="text-center px-4 py-2.5 font-medium">Completed</th>
                            <th className="text-center px-4 py-2.5 font-medium">Last Quiz</th>
                            <th className="text-right px-5 py-2.5 font-medium">Active</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {teacherStats.studentProgress.map((s) => (
                            <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-5 py-3 font-medium text-foreground">{s.name}</td>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                {s.grade || '—'}
                              </td>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                {s.coursesAssigned}
                              </td>
                              <td className="px-4 py-3 text-center text-muted-foreground">
                                {s.coursesCompleted}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {s.lastQuizScore !== null ? (
                                  <ScoreBadge pct={s.lastQuizScore} />
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </td>
                              <td className="px-5 py-3 text-right text-[10px] text-muted-foreground whitespace-nowrap">
                                {s.lastActive
                                  ? new Date(s.lastActive).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Popular Subjects */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-border bg-muted/10">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                        Popular Subjects
                      </h3>
                    </div>
                    <div className="p-0">
                      {teacherStats.popularSubjects.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground italic">
                          No course data yet
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-border">
                            {teacherStats.popularSubjects.map((s, i) => (
                              <tr key={i} className="hover:bg-muted/10 transition-colors">
                                <td className="px-5 py-3 flex items-center gap-3">
                                  <span className="text-lg">{s.icon}</span>
                                  <span className="font-medium">{s.name}</span>
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-muted-foreground">
                                  {s.courseCount} courses
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-4 border-b border-border bg-muted/10">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                      Recent Activity
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                          <th className="text-left px-5 py-2 font-medium">Student</th>
                          <th className="text-left px-5 py-2 font-medium">Activity</th>
                          <th className="text-left px-5 py-2 font-medium">Course</th>
                          <th className="text-center px-5 py-2 font-medium">Result</th>
                          <th className="text-right px-5 py-2 font-medium">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {teacherStats.recentActivity.map((act, i) => (
                          <tr key={i} className="hover:bg-muted/10 transition-colors">
                            <td className="px-5 py-3 font-medium text-foreground">{act.student}</td>
                            <td className="px-5 py-3 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                              {act.type}
                            </td>
                            <td
                              className="px-5 py-3 text-muted-foreground truncate max-w-[200px]"
                              title={act.course_title}
                            >
                              {act.course_title}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <ScoreBadge pct={act.score} />
                            </td>
                            <td className="px-5 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(act.date).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                        {teacherStats.recentActivity.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-5 py-8 text-center text-muted-foreground italic"
                            >
                              No recent activity
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Student Progress Modal ── */}
      {selectedStudent && (
        <Modal
          onClose={() => setSelectedStudent(null)}
          title={`Progress — ${selectedStudent.student.display_name}`}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold">{selectedStudent.stats.quizzesTaken}</p>
                <p className="text-xs text-muted-foreground">Quizzes Taken</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold">
                  {selectedStudent.stats.avgScore !== null
                    ? `${selectedStudent.stats.avgScore}%`
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </div>

            {selectedStudent.assignments.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Assigned Courses</p>
                <div className="space-y-1.5">
                  {selectedStudent.assignments.map((a) => (
                    <div
                      key={a.classroom_id}
                      className="flex items-center justify-between text-sm rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <span className="text-foreground truncate mr-2">{a.classroom_title}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${a.completed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}
                      >
                        {a.completed ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedStudent.recentQuizzes.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Recent Quiz Results</p>
                <div className="space-y-1.5">
                  {selectedStudent.recentQuizzes.map((q, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <span className="text-foreground truncate mr-2">{q.classroom_title}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground text-xs">
                          {q.score}/{q.total}
                        </span>
                        <ScoreBadge pct={q.percentage} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Edit Student Modal ── */}
      {editingStudent && (
        <Modal
          onClose={() => setEditingStudent(null)}
          title={`Edit: ${editingStudent.display_name}`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={editStudentName}
                onChange={(e) => setEditStudentName(e.target.value)}
                placeholder="Student name"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grade</label>
              <select
                value={editStudentGrade}
                onChange={(e) => setEditStudentGrade(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              >
                <option value="">No Grade</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                New Password <span className="font-normal">(leave blank to keep current)</span>
              </label>
              <input
                type="password"
                value={editStudentPassword}
                onChange={(e) => setEditStudentPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {editStudentError && <p className="text-xs text-red-500">{editStudentError}</p>}
            <button
              onClick={handleSaveStudent}
              disabled={editStudentSaving}
              className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {editStudentSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Assign Course Modal ── */}
      {assignModal && (
        <Modal onClose={() => setAssignModal(null)} title={`Assign: ${assignModal.title}`}>
          <div className="space-y-4">
            {students.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No students available. Share your invite code first.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Select students to assign this course:
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {students.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm font-medium text-foreground">{s.display_name}</span>
                      {s.grade && (
                        <span className="text-xs text-muted-foreground">Grade {s.grade}</span>
                      )}
                    </label>
                  ))}
                </div>
                {assignResult && (
                  <p
                    className={`text-sm ${assignResult.startsWith('✓') ? 'text-green-600' : 'text-destructive'}`}
                  >
                    {assignResult}
                  </p>
                )}
                <button
                  onClick={submitAssign}
                  disabled={assigning || selectedStudentIds.size === 0}
                  className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {assigning
                    ? 'Assigning…'
                    : `Assign to ${selectedStudentIds.size} student${selectedStudentIds.size !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ── Delete Course Confirmation Modal ── */}
      {deleteConfirmCourse && (
        <Modal onClose={() => setDeleteConfirmCourse(null)} title="Delete Course">
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 text-destructive rounded-xl border border-destructive/20">
              <p className="text-sm font-medium">
                Are you sure you want to delete{' '}
                <strong>&quot;{deleteConfirmCourse.title}&quot;</strong>?
              </p>
              <p className="text-xs mt-2 opacity-90 leading-relaxed">
                This action is permanent. It will also remove all student assignments and quiz
                results for this course.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmCourse(null)}
                className="flex-1 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteCourse(deleteConfirmCourse)}
                disabled={deletingId === deleteConfirmCourse.id}
                className="flex-1 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deletingId === deleteConfirmCourse.id ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

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
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function NavItem({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
        active
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
