'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, GraduationCap, Check } from 'lucide-react';

type Role = 'mature_student' | 'school_student';

export default function SignupPage() {
  const [role, setRole] = useState<Role>('mature_student');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [grade, setGrade] = useState('');
  const [school, setSchool] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/setup/status')
      .then((res) => res.json())
      .then((data) => setIsFirstUser(data.isFirstUser))
      .catch(() => {});
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        displayName,
        role,
        inviteCode: inviteCode.trim() || undefined,
        grade: role === 'school_student' ? grade.trim() || undefined : undefined,
        school: role === 'school_student' ? school.trim() || undefined : undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Signup failed');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {isFirstUser && (
          <div className="bg-indigo-600 text-white rounded-xl p-4 flex items-start gap-3 shadow-md">
            <div className="text-2xl">🎉</div>
            <div>
              <p className="font-bold">Welcome to OpenTalib! You are the first user.</p>
              <p className="text-sm text-indigo-100 mt-0.5">
                Your account will automatically be set as Administrator.
              </p>
            </div>
          </div>
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-muted-foreground mt-1">Join OpenTalib today</p>
        </div>

        {/* Role Selection */}
        <div className="grid grid-cols-2 gap-3">
          <RoleCard
            selected={role === 'mature_student'}
            onClick={() => setRole('mature_student')}
            icon={<BookOpen className="w-5 h-5" />}
            title="Independent Learner"
            description="Generate your own courses, take quizzes and exams"
          />
          <RoleCard
            selected={role === 'school_student'}
            onClick={() => setRole('school_student')}
            icon={<GraduationCap className="w-5 h-5" />}
            title="School Student"
            description="Access courses assigned by your teacher"
          />
        </div>

        <div className="bg-card rounded-xl border border-border p-6 space-y-4 shadow-lg">
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
              />
            </div>
            {role === 'school_student' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Grade</label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select Grade</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">School</label>
                  <input
                    type="text"
                    value={school}
                    onChange={(e) => setSchool(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Your school name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Invite Code</label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter code from your teacher"
                  />
                </div>
              </>
            )}
            {error && <p className="text-destructive text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <a href="/login" className="text-primary hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

function RoleCard({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative text-left rounded-xl border-2 p-4 transition-all ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      {selected && (
        <span className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
          <Check className="w-2.5 h-2.5 text-primary-foreground" />
        </span>
      )}
      <div className={`mb-2 ${selected ? 'text-primary' : 'text-muted-foreground'}`}>{icon}</div>
      <p className="font-semibold text-sm text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
    </button>
  );
}
