import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerSession } from '@/lib/server/auth';

type UntypedClient = SupabaseClient<any, any, any>;

export async function findSessionEmployee(client: UntypedClient, session: ServerSession) {
  const { data: employee, error } = await client
    .schema('HR')
    .from('employees')
    .select('*')
    .eq('company_id', session.companyId)
    .eq('email', session.userEmail)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return employee ?? null;
}
