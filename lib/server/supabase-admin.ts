import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): SupabaseClient<any> {
  if (!adminClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      const missing = [!url && 'SUPABASE_URL', !key && 'SUPABASE_SERVICE_KEY']
        .filter(Boolean)
        .join(', ');
      throw new Error(
        `getSupabaseAdmin: missing env vars: ${missing} — check .env.local is copied to .next/standalone/`,
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminClient = createClient<any>(url, key);
  }
  return adminClient;
}
