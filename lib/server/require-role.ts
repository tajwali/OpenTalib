import { getSession } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { NextResponse } from 'next/server';

export type UserRole = 'admin' | 'teacher' | 'school_student' | 'mature_student';

export interface AuthResult {
  user: { id: string; email?: string };
  role: UserRole;
  error?: never;
}

export interface AuthError {
  error: NextResponse;
  user?: never;
  role?: never;
}

export async function requireAuth(): Promise<AuthResult | AuthError> {
  try {
    const session = await getSession();

    if (!session || !session.user) {
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const user = session.user;
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile?.role) {
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    return { user: { id: user.id, email: user.email }, role: profile.role as UserRole };
  } catch {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthResult | AuthError> {
  const result = await requireAuth();
  if ('error' in result) return result;

  if (!allowedRoles.includes(result.role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return result;
}
