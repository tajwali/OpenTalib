'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Mail,
  Shield,
  GraduationCap,
  Lock,
  Save,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface UserProfile {
  id: string;
  display_name: string;
  email: string;
  role: string;
  grade: number | null;
  school: string | null;
  gender: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => {
        if (res.status === 401) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setProfile(data);
          setDisplayName(data.display_name || '');
          setGender(data.gender || '');
        }
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        display_name: displayName,
        gender: gender || null,
      };

      if (newPassword) {
        body.current_password = currentPassword;
        body.new_password = newPassword;
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update profile');
      } else {
        setSuccess('Profile updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Update local profile state
        setProfile((prev) =>
          prev ? { ...prev, display_name: displayName, gender: gender || null } : null,
        );
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold">Account Profile</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={handleSave} className="space-y-8">
          {/* Basic Info Section */}
          <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <User className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Email Address
                </label>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed">
                  <Mail className="w-4 h-4" />
                  <span className="text-sm">{profile?.email}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Role
                </label>
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed">
                  <Shield className="w-4 h-4" />
                  <span className="text-sm capitalize">{profile?.role?.replace('_', ' ')}</span>
                </div>
              </div>

              {profile?.role === 'school_student' && (
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                    Grade Level
                  </label>
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-muted/50 text-muted-foreground cursor-not-allowed">
                    <GraduationCap className="w-4 h-4" />
                    <span className="text-sm">Grade {profile?.grade}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Gender (for AI Voice)
                </label>
                <select
                  value={gender || ''}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                >
                  <option value="">Select Gender (Optional)</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Neutral</option>
                </select>
              </div>
            </div>
          </section>

          {/* Password Section */}
          <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-lg">Change Password</h2>
            </div>

            <div className="space-y-4 max-w-md">
              <p className="text-xs text-muted-foreground mb-4">
                Leave these fields blank if you do not want to change your password.
              </p>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder="Verify your current identity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-muted-foreground">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  placeholder="Repeat your new password"
                />
              </div>
            </div>
          </section>

          {/* Feedback Messages */}
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm animate-in fade-in slide-in-from-top-1">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
