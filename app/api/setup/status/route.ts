import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET() {
  const admin = getSupabaseAdmin();
  const { count } = await admin.from('user_profiles').select('*', { count: 'exact', head: true });
  return NextResponse.json({ isFirstUser: count === 0 });
}
