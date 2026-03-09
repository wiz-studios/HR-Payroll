import type { SupabaseClient } from '@supabase/supabase-js';
import type { ServerSession } from '@/lib/server/auth';

type UntypedClient = SupabaseClient<any, any, any>;

async function upsertEmployeeLinkFromEmailMatch(
  client: UntypedClient,
  session: ServerSession,
  employeeId: string
) {
  const now = new Date().toISOString();

  await client
    .schema('hr')
    .from('employee_user_links')
    .update({
      is_active: false,
      updated_at: now,
    })
    .eq('company_id', session.companyId)
    .eq('is_active', true)
    .eq('user_id', session.userId)
    .neq('employee_id', employeeId);

  await client
    .schema('hr')
    .from('employee_user_links')
    .upsert(
      {
        company_id: session.companyId,
        employee_id: employeeId,
        user_id: session.userId,
        linked_via: 'email_match',
        is_active: true,
        updated_at: now,
      },
      { onConflict: 'company_id,employee_id,user_id' }
    );
}

export async function findSessionEmployee(client: UntypedClient, session: ServerSession) {
  const { data: linkedEmployee, error: linkError } = await client
    .schema('hr')
    .from('employee_user_links')
    .select('employee_id')
    .eq('company_id', session.companyId)
    .eq('user_id', session.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (linkError) {
    throw new Error(linkError.message);
  }

  if (linkedEmployee?.employee_id) {
    const { data: employee, error } = await client
      .schema('HR')
      .from('employees')
      .select('*')
      .eq('company_id', session.companyId)
      .eq('id', linkedEmployee.employee_id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (employee) {
      return employee;
    }
  }

  const { data: employeeProfile, error: profileError } = await client
    .schema('hr')
    .from('employee_profiles')
    .select('id')
    .eq('company_id', session.companyId)
    .ilike('work_email', session.userEmail)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!employeeProfile?.id) {
    return null;
  }

  await upsertEmployeeLinkFromEmailMatch(client, session, employeeProfile.id as string);

  const { data: employee, error } = await client
    .schema('HR')
    .from('employees')
    .select('*')
    .eq('company_id', session.companyId)
    .eq('id', employeeProfile.id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return employee ?? null;
}

export async function getSessionEmployeeDocuments(client: UntypedClient, session: ServerSession) {
  const employee = await findSessionEmployee(client, session);
  if (!employee) {
    return { employee: null, documents: [] };
  }

  const { data: documents, error } = await client
    .schema('hr')
    .from('employee_documents')
    .select('id,document_type,file_path,status,metadata,created_at')
    .eq('company_id', session.companyId)
    .eq('employee_id', employee.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    employee,
    documents: documents ?? [],
  };
}
