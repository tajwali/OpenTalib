import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/require-role';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const GOTRUE_URL = process.env.SUPABASE_AUTH_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

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
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('user_profiles')
      .select('id, display_name, role, grade, school')
      .eq('id', auth.user.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // gender column added in migration 004 — fetch separately so old DBs don't break
    let gender: string | null = null;
    try {
      const { data: gData } = await admin
        .from('user_profiles')
        .select('gender')
        .eq('id', auth.user.id)
        .single();
      gender = (gData as { gender?: string | null } | null)?.gender ?? null;
    } catch {
      /* column not yet migrated */
    }

    // Get email from GoTrue
    const gotrueRes = await gotrueAdmin(`/users/${auth.user.id}`);
    let email = auth.user.email ?? '';
    if (gotrueRes.ok) {
      const u = (await gotrueRes.json()) as { email?: string };
      email = u.email ?? email;
    }

    return NextResponse.json({ ...data, gender, email });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;

    const body = (await req.json()) as {
      display_name?: string;
      current_password?: string;
      new_password?: string;
      gender?: string;
      grade?: string;
    };

    const admin = getSupabaseAdmin();

    // Collect profile field updates
    const profileUpdates: Record<string, any> = {};
    if (body.display_name !== undefined) {
      const name = body.display_name.trim();
      if (!name)
        return NextResponse.json({ error: 'display_name cannot be empty' }, { status: 400 });
      profileUpdates.display_name = name;
    }
    if (body.gender !== undefined) profileUpdates.gender = body.gender;
    if (body.grade !== undefined) {
      profileUpdates.grade = body.grade ? parseInt(String(body.grade)) || null : null;
    }

    // Separate gender from other fields — it requires migration 004 to be applied
    const genderUpdate = profileUpdates.gender;
    const coreUpdates = { ...profileUpdates };
    delete coreUpdates.gender;

    if (Object.keys(coreUpdates).length > 0) {
      const { error } = await admin
        .from('user_profiles')
        .update(coreUpdates)
        .eq('id', auth.user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Try gender separately — silently ignore if column not yet migrated
    if (genderUpdate !== undefined) {
      try {
        await admin.from('user_profiles').update({ gender: genderUpdate }).eq('id', auth.user.id);
      } catch {
        /* column not yet migrated */
      }
    }

    // Password update via GoTrue admin
    if (body.new_password !== undefined) {
      if (!body.current_password) {
        return NextResponse.json(
          { error: 'Current password is required to change password' },
          { status: 400 },
        );
      }
      if (body.new_password.length < 6) {
        return NextResponse.json(
          { error: 'New password must be at least 6 characters' },
          { status: 400 },
        );
      }

      // Verify old password by attempting a sign-in (via GoTrue direct API)
      const verifyRes = await fetch(`${GOTRUE_URL}/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: auth.user.email,
          password: body.current_password,
        }),
      });

      if (!verifyRes.ok) {
        return NextResponse.json({ error: 'Incorrect current password' }, { status: 401 });
      }

      const res = await gotrueAdmin(`/users/${auth.user.id}`, {
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

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    );
  }
}
