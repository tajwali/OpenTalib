import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(req, params.path);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(req, params.path);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(req, params.path);
}

export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(req, params.path);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(req, params.path);
}

export async function OPTIONS(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handleProxy(req, params.path);
}

async function handleProxy(req: NextRequest, path: string[]) {
  // Internal Supabase URL (nginx proxy on server)
  const supabaseUrl = 'http://localhost:8000';
  const targetPath = path.join('/');
  const searchParams = req.nextUrl.searchParams.toString();
  const url = `${supabaseUrl}/${targetPath}${searchParams ? `?${searchParams}` : ''}`;

  const headers = new Headers(req.headers);
  // Important: Remove the host header to let fetch set it correctly for the internal request
  headers.delete('host');
  // Remove connection headers that might cause issues
  headers.delete('connection');
  headers.delete('keep-alive');

  let body: any = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    try {
      body = await req.arrayBuffer();
    } catch (e) {
      // Body might be empty or unreadable
    }
  }

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
      // @ts-ignore - duplex is needed for streaming/body in some environments
      duplex: 'half',
    });

    const resHeaders = new Headers(res.headers);
    // Remove headers that should be set by the actual server response
    resHeaders.delete('content-encoding');
    resHeaders.delete('content-length');
    resHeaders.delete('transfer-encoding');

    // Add CORS headers just in case, though it's same-origin now
    resHeaders.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: resHeaders,
    });
  } catch (error) {
    console.error(`Supabase proxy error [${req.method}] ${url}:`, error);
    return NextResponse.json({ error: 'Proxy error', details: String(error) }, { status: 502 });
  }
}
