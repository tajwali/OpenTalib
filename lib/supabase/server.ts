import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Supabase self-hosted: nginx on port 8000 doesn't route /auth/v1 to GoTrue.
// This fetch rewriter redirects auth calls directly to GoTrue on port 9999.
function makeAuthFetch() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const authUrl = process.env.SUPABASE_AUTH_URL;
  if (!authUrl) {
    console.error(
      '[supabase/server] SUPABASE_AUTH_URL is not set — auth will fail. Check .env.local is copied to .next/standalone/',
    );
    return undefined;
  }

  return (url: RequestInfo | URL, options?: RequestInit) => {
    const urlStr = url.toString();
    const authPrefix = supabaseUrl + '/auth/v1';
    if (urlStr.startsWith(authPrefix)) {
      const path = urlStr.slice(authPrefix.length);
      return fetch(authUrl + path, options);
    }
    return fetch(url, options);
  };
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { fetch: makeAuthFetch() },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server component — can be ignored
        }
      },
    },
  });
}

/**
 * getSession - reads the session from the cookies locally without a network call.
 * Reliable for simple auth checks through Cloudflare tunnels.
 */
export async function getSession() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * getUser - calls GoTrue to verify the user.
 * More secure but requires a network call (may be unreliable through tunnels).
 */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
