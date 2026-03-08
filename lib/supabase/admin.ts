import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env';

export function createSupabaseAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
