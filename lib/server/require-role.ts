import { getUser } from '@/lib/supabase/server';
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
    const user = await getUser();

    if (!user) {
      console.log("[requireAuth] No user found");
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    const admin = getSupabaseAdmin();
    const { data: profile, error: dbError } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (dbError) {
      console.log("[requireAuth] DB error:", dbError.message);
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    if (!profile?.role) {
      console.log("[requireAuth] No role found for user:", user.id);
      return {
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      };
    }

    return { user: { id: user.id, email: user.email }, role: profile.role as UserRole };
  } catch (err) {
    console.log("[requireAuth] Catch error:", err);
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthResult | AuthError> {
  const result = await requireAuth();
  if ('error' in result) return result;

  if (!allowedRoles.includes(result.role)) {
    console.log("[requireRole] Forbidden. User role:", result.role, "Allowed:", allowedRoles);
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return result;
}
