import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getEmployeeEnterpriseHistory } from '@/lib/platform/sync';

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
    const history = await getEmployeeEnterpriseHistory(admin, auth.session.companyId, id);
    return NextResponse.json(history);
  } catch (historyError) {
    return NextResponse.json(
      { error: historyError instanceof Error ? historyError.message : 'Unable to load employee history.' },
      { status: 400 }
    );
  }
}
