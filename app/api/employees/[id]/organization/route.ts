import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getEmployeeEnterpriseContext } from '@/lib/platform/sync';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: employee, error } = await admin.schema('HR').from('employees').select('id,company_id').eq('id', id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!employee || employee.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  }

  try {
    const organization = await getEmployeeEnterpriseContext(admin, auth.session.companyId, id);
    return NextResponse.json(organization);
  } catch (organizationError) {
    return NextResponse.json(
      { error: organizationError instanceof Error ? organizationError.message : 'Unable to load employee organization context.' },
      { status: 400 }
    );
  }
}
