const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseUrl() {
  if (!publicUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }

  return publicUrl;
}

export function getSupabaseAnonKey() {
  if (!publicAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured.');
  }

  return publicAnonKey;
}

export function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return key;
}
