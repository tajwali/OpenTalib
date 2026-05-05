import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const GOTRUE_URL = process.env.SUPABASE_AUTH_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

/** Call GoTrue admin REST API */
async function gotrueAdmin(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${GOTRUE_URL}/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_KEY}`,
      ...(options.headers ?? {}),
    },
  });
}

export async function GET() {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const admin = getSupabaseAdmin();

    // Fetch profiles and GoTrue users in parallel
    const [{ data: profiles, error: profilesError }, gotrue] = await Promise.all([
      admin
        .from('user_profiles')
        .select('id, display_name, role, teacher_id, grade, school, invite_code')
        .order('role', { ascending: true }),
      gotrueAdmin('/users?per_page=1000'),
    ]);

    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

    // Build email + metadata map from GoTrue response
    const emailMap = new Map<string, string>();
    const bannedMap = new Map<string, boolean>();
    const metadataMap = new Map<string, { last_login?: string; created_at?: string }>();

    if (gotrue.ok) {
      const body = (await gotrue.json()) as {
        users?: {
          id: string;
          email?: string;
          banned_until?: string;
          last_sign_in_at?: string;
          created_at?: string;
        }[];
      };
      for (const u of body.users ?? []) {
        emailMap.set(u.id, u.email ?? '');
        if (u.banned_until && new Date(u.banned_until) > new Date()) {
          bannedMap.set(u.id, true);
        }
        metadataMap.set(u.id, {
          last_login: u.last_sign_in_at,
          created_at: u.created_at,
        });
      }
    }

    const users = (profiles ?? []).map((p) => ({
      id: p.id,
      email: emailMap.get(p.id as string) ?? '',
      display_name: p.display_name,
      role: p.role,
      teacher_id: p.teacher_id,
      grade: p.grade,
      school: p.school,
      disabled: bannedMap.get(p.id as string) ?? false,
      last_login_at: metadataMap.get(p.id as string)?.last_login ?? null,
      created_at: metadataMap.get(p.id as string)?.created_at ?? null,
    }));

    return NextResponse.json(users);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const body = (await req.json()) as { email?: string; password?: string; displayName?: string };
    if (!body.email?.trim())
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    if (!body.password || body.password.length < 6)
      return NextResponse.json(
        { error: 'password must be at least 6 characters' },
        { status: 400 },
      );
    if (!body.displayName?.trim())
      return NextResponse.json({ error: 'displayName is required' }, { status: 400 });

    // Create user via GoTrue admin REST API
    const createRes = await gotrueAdmin('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: body.email.trim(),
        password: body.password,
        email_confirm: true,
      }),
    });

    const newUser = (await createRes.json()) as {
      id?: string;
      email?: string;
      msg?: string;
      error?: string;
    };
    if (!createRes.ok) {
      return NextResponse.json(
        { error: newUser.msg ?? newUser.error ?? 'Failed to create user' },
        { status: 400 },
      );
    }
    if (!newUser.id) return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });

    const admin = getSupabaseAdmin();
    const { error: profileError } = await admin.from('user_profiles').insert({
      id: newUser.id,
      display_name: body.displayName.trim(),
      role: 'teacher',
    });

    if (profileError) {
      // Cleanup the auth user if profile insert fails
      await gotrueAdmin(`/users/${newUser.id}`, { method: 'DELETE' });
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, user: { id: newUser.id, email: newUser.email } },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const body = (await req.json()) as {
      user_id?: string;
      new_role?: string;
      display_name?: string;
      new_password?: string;
      disabled?: boolean;
    };
    if (!body.user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

    const hasChange =
      body.new_role !== undefined ||
      body.display_name !== undefined ||
      body.new_password !== undefined ||
      body.disabled !== undefined;
    if (!hasChange) return NextResponse.json({ error: 'No changes specified' }, { status: 400 });

    if (body.user_id === auth.user.id && (body.new_role !== undefined || body.disabled)) {
      return NextResponse.json(
        { error: 'Cannot change your own role or disable your own account' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();

    // Role change
    if (body.new_role !== undefined) {
      const validRoles = ['admin', 'teacher', 'school_student', 'mature_student'];
      if (!validRoles.includes(body.new_role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      const { error } = await admin
        .from('user_profiles')
        .update({ role: body.new_role })
        .eq('id', body.user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Display name change
    if (body.display_name !== undefined) {
      const name = body.display_name.trim();
      if (!name)
        return NextResponse.json({ error: 'display_name cannot be empty' }, { status: 400 });
      const { error } = await admin
        .from('user_profiles')
        .update({ display_name: name })
        .eq('id', body.user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Password change via GoTrue admin
    if (body.new_password !== undefined) {
      if (body.new_password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 },
        );
      }
      const res = await gotrueAdmin(`/users/${body.user_id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: body.new_password }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { msg?: string };
        return NextResponse.json(
          { error: errBody.msg ?? 'Failed to update password' },
          { status: 500 },
        );
      }
    }

    // Disable / re-enable via GoTrue ban_duration
    if (body.disabled !== undefined) {
      const res = await gotrueAdmin(`/users/${body.user_id}`, {
        method: 'PUT',
        body: JSON.stringify({ ban_duration: body.disabled ? '876600h' : 'none' }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { msg?: string };
        return NextResponse.json(
          { error: errBody.msg ?? 'Failed to update user status' },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if ('error' in auth) return auth.error;

    const userId = new URL(req.url).searchParams.get('user_id');
    if (!userId) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

    if (userId === auth.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Delete via GoTrue admin REST API (cascades to user_profiles via DB trigger)
    const delRes = await gotrueAdmin(`/users/${userId}`, { method: 'DELETE' });
    if (!delRes.ok && delRes.status !== 404) {
      const errBody = (await delRes.json().catch(() => ({}))) as { msg?: string };
      return NextResponse.json({ error: errBody.msg ?? 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
