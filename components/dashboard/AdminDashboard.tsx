'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  LogOut,
  Plus,
  X,
  Users,
  BookOpen,
  Trash2,
  Pencil,
  Check,
  UserCircle,
  BarChart3,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  icon: string;
  is_default: boolean;
}

interface UserRecord {
  id: string;
  email: string;
  display_name: string;
  role: string;
  teacher_id: string | null;
  grade: string | null;
  school: string | null;
  disabled: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

interface StatsData {
  userRoles: Record<string, number>;
  totalCourses: number;
  totalScenes: number;
  popularSubjects: { id: string; name: string; icon: string; count: number }[];
  recentActivity: { id: string; title: string; teacher_name: string; created_at: string }[];
  storage: {
    mediaFilesCount: number;
    totalBytes: number;
    formattedSize: string;
  };
}

type Tab = 'users' | 'subjects' | 'stats';

type UserRole = 'admin' | 'teacher' | 'school_student' | 'mature_student';

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  teacher: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  mature_student: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  school_student: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
};

interface Props {
  userEmail?: string;
  displayName?: string;
  userId?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminDashboard({ userEmail, displayName, userId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('users');
  const [userCount, setUserCount] = useState<number | null>(null);

  // Users tab state
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Inline edit state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Subjects tab state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [newIcon, setNewIcon] = useState('📚');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Stats tab state
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/stats')
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: Record<string, unknown>) => {
        if (typeof data?.totalUsers === 'number') setUserCount(data.totalUsers as number);
      })
      .catch(() => {});
  }, []);

  // ─── Users ────────────────────────────────────────────────────────────────

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    fetch('/api/admin/users')
      .then((r) =>
        r.ok
          ? r.json()
          : r.json().then((e: { error: string }) => {
              throw new Error(e.error);
            }),
      )
      .then((data: UserRecord[]) => setUsers(Array.isArray(data) ? data : []))
      .catch((e: Error) => setUsersError(e.message))
      .finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateTeacher = async () => {
    if (!createName.trim() || !createEmail.trim() || !createPassword) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createEmail.trim(),
          password: createPassword,
          displayName: createName.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed');
        return;
      }
      setShowCreateForm(false);
      setCreateName('');
      setCreateEmail('');
      setCreatePassword('');
      loadUsers();
    } catch {
      setCreateError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const handleChangeRole = async (targetId: string, newRole: UserRole) => {
    setActionError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetId, new_role: newRole }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? 'Failed to change role');
        return;
      }
      loadUsers();
    } catch {
      setActionError('Network error');
    }
  };

  const handleDeleteUser = async (targetId: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/users?user_id=${targetId}`, { method: 'DELETE' });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? 'Failed to delete user');
        return;
      }
      loadUsers();
    } catch {
      setActionError('Network error');
    }
  };

  const openEditUser = (u: UserRecord) => {
    setEditingUserId(u.id);
    setEditName(u.display_name ?? '');
    setEditPassword('');
    setEditError(null);
  };

  const handleSaveEdit = async (targetId: string) => {
    if (!editName.trim() && !editPassword) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const patch: Record<string, unknown> = { user_id: targetId };
      if (editName.trim()) patch.display_name = editName.trim();
      if (editPassword) patch.new_password = editPassword;
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(data.error ?? 'Failed');
        return;
      }
      setEditingUserId(null);
      loadUsers();
    } catch {
      setEditError('Network error');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleDisable = async (targetId: string, currentlyDisabled: boolean) => {
    setActionError(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetId, disabled: !currentlyDisabled }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setActionError(data.error ?? 'Failed');
        return;
      }
      loadUsers();
    } catch {
      setActionError('Network error');
    }
  };

  // ─── Subjects ─────────────────────────────────────────────────────────────

  const loadSubjects = useCallback(() => {
    setSubjectsLoading(true);
    fetch('/api/subjects')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Subject[]) => setSubjects(Array.isArray(data) ? data : []))
      .catch(() => setSubjects([]))
      .finally(() => setSubjectsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'subjects') loadSubjects();
  }, [tab, loadSubjects]);

  const handleAddSubject = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), icon: newIcon }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: 'Failed' }))) as { error: string };
        setAddError(err.error ?? 'Failed to add subject');
      } else {
        setNewName('');
        setNewIcon('📚');
        loadSubjects();
      }
    } catch {
      setAddError('Network error');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    try {
      const res = await fetch(`/api/subjects?id=${id}`, { method: 'DELETE' });
      if (res.ok) loadSubjects();
    } catch {
      /* ignore */
    }
  };

  // ─── Stats ────────────────────────────────────────────────────────────────

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    fetch('/api/admin/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StatsData | null) => {
        if (data) setStats(data);
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  useEffect(() => {
    if (tab === 'stats') loadStats();
  }, [tab, loadStats]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">OpenMAIC</h1>
            <p className="text-sm text-muted-foreground">
              {displayName ?? userEmail ?? 'Admin Dashboard'}
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

      {/* Tabs */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 flex gap-1">
          {(
            [
              { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
              { id: 'subjects', label: 'Subjects', icon: <BookOpen className="w-4 h-4" /> },
              { id: 'stats', label: 'Statistics', icon: <BarChart3 className="w-4 h-4" /> },
            ] as { id: Tab; label: string; icon: React.ReactNode }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Admin header */}
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-xl">
            <Shield className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Admin Dashboard</h2>
            {userCount !== null && (
              <p className="text-sm text-muted-foreground">
                Total users: <span className="font-semibold text-foreground">{userCount}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">All Users</h3>
              <button
                onClick={() => {
                  setShowCreateForm((v) => !v);
                  setCreateError(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
                Create Teacher
              </button>
            </div>

            {/* Create teacher form */}
            {showCreateForm && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <p className="text-sm font-medium text-foreground">New Teacher Account</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Display name"
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="Email"
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="Password (min 6 chars)"
                    className="px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                {createError && <p className="text-xs text-red-500">{createError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateTeacher}
                    disabled={
                      creating || !createName.trim() || !createEmail.trim() || !createPassword
                    }
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateError(null);
                    }}
                    className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {actionError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">
                {actionError}
              </p>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {usersLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : usersError ? (
                <div className="py-8 text-center text-sm text-red-500">{usersError}</div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">No users found</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        User
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Role
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                        Created
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">
                        Last Login
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {users.map((u) => {
                      const isSelf = u.id === userId;
                      const isEditing = editingUserId === u.id;
                      const formatDate = (d: string | null) =>
                        d
                          ? new Date(d).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: '2-digit',
                            })
                          : '—';
                      const formatTime = (d: string | null) =>
                        d
                          ? new Date(d).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '';

                      return (
                        <React.Fragment key={u.id}>
                          <tr
                            className={`hover:bg-muted/20 transition-colors ${u.disabled ? 'opacity-60' : ''}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground flex items-center gap-2">
                                  {u.display_name || (
                                    <span className="text-muted-foreground italic">—</span>
                                  )}
                                  {u.disabled && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold uppercase">
                                      banned
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground">{u.email}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] ?? 'bg-muted text-muted-foreground'}`}
                              >
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">
                              {formatDate(u.created_at)}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                              <div>{formatDate(u.last_login_at)}</div>
                              <div className="text-[10px] opacity-70">
                                {formatTime(u.last_login_at)}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <select
                                  value={u.role}
                                  disabled={isSelf}
                                  onChange={(e) =>
                                    handleChangeRole(u.id, e.target.value as UserRole)
                                  }
                                  className="text-xs px-2 py-1 border border-border rounded-lg bg-background text-foreground disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                  <option value="admin">admin</option>
                                  <option value="teacher">teacher</option>
                                  <option value="mature_student">mature_student</option>
                                  <option value="school_student">school_student</option>
                                </select>
                                <button
                                  onClick={() =>
                                    isEditing ? setEditingUserId(null) : openEditUser(u)
                                  }
                                  className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                                  title="Edit name / Reset password"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleToggleDisable(u.id, u.disabled)}
                                  disabled={isSelf}
                                  className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${u.disabled ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'}`}
                                  title={
                                    u.disabled ? 'Enable account (unban)' : 'Disable account (ban)'
                                  }
                                >
                                  {u.disabled ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  disabled={isSelf}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  title={isSelf ? 'Cannot delete your own account' : 'Delete user'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isEditing && (
                            <tr key={`${u.id}-edit`} className="bg-muted/20 border-b border-border">
                              <td colSpan={5} className="px-4 py-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold">
                                      Display Name
                                    </label>
                                    <input
                                      type="text"
                                      value={editName}
                                      onChange={(e) => setEditName(e.target.value)}
                                      placeholder="Display name"
                                      className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-44"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-muted-foreground uppercase font-bold">
                                      Reset Password
                                    </label>
                                    <input
                                      type="password"
                                      value={editPassword}
                                      onChange={(e) => setEditPassword(e.target.value)}
                                      placeholder="New password (optional)"
                                      className="px-3 py-1.5 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-52"
                                    />
                                  </div>
                                  <div className="flex items-end gap-2 mt-4">
                                    <button
                                      onClick={() => handleSaveEdit(u.id)}
                                      disabled={editSaving || (!editName.trim() && !editPassword)}
                                      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                                    >
                                      {editSaving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                    <button
                                      onClick={() => setEditingUserId(null)}
                                      className="px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  {editError && (
                                    <div className="w-full text-xs text-red-500 mt-1 font-medium">
                                      {editError}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}

        {/* ── Subjects Tab ── */}
        {tab === 'subjects' && (
          <section className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Manage Subjects</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Default subjects cannot be deleted. Custom subjects can be added and removed.
              </p>
            </div>

            <div className="divide-y divide-border">
              {subjectsLoading ? (
                <div className="px-5 py-8 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : subjects.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-muted-foreground">
                  No subjects found
                </div>
              ) : (
                subjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{s.icon}</span>
                      <span className="text-sm font-medium text-foreground">{s.name}</span>
                      {s.is_default && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          default
                        </span>
                      )}
                    </div>
                    {!s.is_default && (
                      <button
                        onClick={() => handleDeleteSubject(s.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Delete subject"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-4 border-t border-border bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-3">Add Subject</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  placeholder="📚"
                  className="w-14 text-center px-2 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  maxLength={4}
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddSubject();
                  }}
                  placeholder="Subject name"
                  className="flex-1 px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  onClick={handleAddSubject}
                  disabled={adding || !newName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              {addError && <p className="text-xs text-red-500 mt-2">{addError}</p>}
            </div>
          </section>
        )}

        {/* ── Stats Tab ── */}
        {tab === 'stats' && (
          <div className="space-y-6">
            {statsLoading ? (
              <div className="py-20 flex justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : !stats ? (
              <div className="py-12 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                Failed to load statistics
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Total Courses
                    </p>
                    <p className="text-3xl font-black text-foreground">{stats.totalCourses}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Total Scenes
                    </p>
                    <p className="text-3xl font-black text-foreground">{stats.totalScenes}</p>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Storage Usage
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-foreground">
                        {stats.storage.formattedSize}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.storage.mediaFilesCount} files
                      </p>
                    </div>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Total Users
                    </p>
                    <p className="text-3xl font-black text-foreground">
                      {Object.values(stats.userRoles).reduce((a, b) => a + b, 0)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* User Roles */}
                  <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-border bg-muted/10">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                        Users by Role
                      </h3>
                    </div>
                    <div className="p-5 space-y-4">
                      {Object.entries(stats.userRoles)
                        .sort((a, b) => b[1] - a[1])
                        .map(([role, count]) => (
                          <div key={role} className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium capitalize">
                                {role.replace('_', ' ')}
                              </span>
                              <span className="font-bold">{count}</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${role === 'admin' ? 'bg-red-500' : role === 'teacher' ? 'bg-blue-500' : 'bg-green-500'}`}
                                style={{
                                  width: `${(count / Object.values(stats.userRoles).reduce((a, b) => a + b, 0)) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
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
                      {stats.popularSubjects.length === 0 ? (
                        <p className="p-8 text-center text-sm text-muted-foreground italic">
                          No course data yet
                        </p>
                      ) : (
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-border">
                            {stats.popularSubjects.map((s) => (
                              <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                                <td className="px-5 py-3 flex items-center gap-3">
                                  <span className="text-lg">{s.icon}</span>
                                  <span className="font-medium">{s.name}</span>
                                </td>
                                <td className="px-5 py-3 text-right font-bold text-muted-foreground">
                                  {s.count} courses
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
                  <div className="px-5 py-4 border-b border-border bg-muted/10 flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                      Recent Activity
                    </h3>
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Last 10 courses
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border text-[10px] uppercase tracking-widest text-muted-foreground">
                          <th className="text-left px-5 py-2 font-medium">Course Title</th>
                          <th className="text-left px-5 py-2 font-medium">Teacher</th>
                          <th className="text-right px-5 py-2 font-medium">Generated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {stats.recentActivity.map((course) => (
                          <tr key={course.id} className="hover:bg-muted/10 transition-colors">
                            <td
                              className="px-5 py-3 font-medium text-foreground truncate max-w-[200px]"
                              title={course.title}
                            >
                              {course.title}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground truncate max-w-[150px]">
                              {course.teacher_name || 'System'}
                            </td>
                            <td className="px-5 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(course.created_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                          </tr>
                        ))}
                        {stats.recentActivity.length === 0 && (
                          <tr>
                            <td
                              colSpan={3}
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
    </div>
  );
}
