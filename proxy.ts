import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

export async function proxy(request: NextRequest) {
  // Allow all API routes through without auth
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public auth routes through
  const publicRoutes = ['/login', '/signup', '/auth/callback'];
  if (publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { fetch: makeAuthFetch() },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
