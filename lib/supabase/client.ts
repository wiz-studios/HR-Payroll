'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { getSupabaseAnonKey, getSupabaseUrl } from './env';

let client: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
  }

  return client;
}
