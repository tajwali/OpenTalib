import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server/rate-limit';

function makeAuthFetch() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const authUrl = process.env.SUPABASE_AUTH_URL;
  // SUPABASE_AUTH_URL must be set — without it auth requests go to Kong which has no
  // /auth/v1 route and returns "404 page not found", causing a cryptic JSON parse error.
  if (!authUrl) {
    console.error(
      '[login] SUPABASE_AUTH_URL is not set — auth will fail. Check .env.local is copied to .next/standalone/',
    );
    return undefined;
  }
  return (url: RequestInfo | URL, options?: RequestInit) => {
    const urlStr = url.toString();
    if (urlStr.startsWith(supabaseUrl + '/auth/v1')) {
      return fetch(authUrl + urlStr.slice((supabaseUrl + '/auth/v1').length), options);
    }
    return fetch(url, options);
  };
}

export async function POST(request: Request) {
  try {
    // CF-Connecting-IP is set by Cloudflare and cannot be spoofed by clients.
    // Fall back to x-forwarded-for (first IP) when not behind Cloudflare.
    const ip =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown';

    const ipCheck = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Please try again in ${ipCheck.retryAfter} seconds.` },
        { status: 429 },
      );
    }

    const { email, password } = await request.json();

    // Per-email rate limit prevents targeted brute-force even if IP is spoofed
    if (email) {
      const emailCheck = checkRateLimit(`login:email:${email.toLowerCase()}`, 5, 15 * 60 * 1000);
      if (!emailCheck.allowed) {
        return NextResponse.json(
          { error: `Too many attempts. Please try again in ${emailCheck.retryAfter} seconds.` },
          { status: 429 },
        );
      }
    }
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { fetch: makeAuthFetch() },
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
