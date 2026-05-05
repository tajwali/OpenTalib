import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function makeAuthFetch() {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const authUrl = process.env.SUPABASE_AUTH_URL;
  if (!authUrl) return undefined;
  return (url: RequestInfo | URL, options?: RequestInit) => {
    const urlStr = url.toString();
    if (urlStr.startsWith(supabaseUrl + '/auth/v1')) {
      return fetch(authUrl + urlStr.slice((supabaseUrl + '/auth/v1').length), options);
    }
    return fetch(url, options);
  };
}

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { fetch: makeAuthFetch() },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  await supabase.auth.signOut();
  return NextResponse.json({ success: true });
}
