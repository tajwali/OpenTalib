import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export type UserRole = 'admin' | 'teacher' | 'school_student' | 'mature_student';

export interface UserWithRole {
  user: { id: string; email?: string } | null;
  role: UserRole | null;
  displayName: string | null;
}

export async function getUserRole(): Promise<UserWithRole> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, role: null, displayName: null };
    }

    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from('user_profiles')
      .select('role, display_name')
      .eq('id', user.id)
      .single();

    return {
      user: { id: user.id, email: user.email },
      role: (profile?.role as UserRole) ?? null,
      displayName: profile?.display_name ?? null,
    };
  } catch {
    return { user: null, role: null, displayName: null };
  }
}
