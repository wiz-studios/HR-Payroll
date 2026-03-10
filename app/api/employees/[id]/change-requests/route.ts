import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canManageEmployees, isEmployeeRole } from '@/lib/platform/roles';
import { createEmployeeChangeRequest, getEmployeeChangeRequests } from '@/lib/platform/workflow';
import { findSessionEmployee } from '@/lib/server/self-service';

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
    const requests = await getEmployeeChangeRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : 'Unable to load change requests.' },
      { status: 400 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const admin = createAdminClient();
  const payload = await request.json();
  const selfEmployee = isEmployeeRole(auth.session.userRole) ? await findSessionEmployee(admin, auth.session) : null;

  const canSubmitAsManager = canManageEmployees(auth.session.userRole);
  const canSubmitOwnBankChange =
    isEmployeeRole(auth.session.userRole) &&
    selfEmployee?.id === id &&
    payload.requestType === 'bank_details';

  if (!canSubmitAsManager && !canSubmitOwnBankChange) {
    return NextResponse.json(
      { error: 'Only administrators/managers or the employee requesting their own bank-detail change can submit this request.' },
      { status: 403 }
    );
  }

  const { data: employee, error } = await admin.schema('HR').from('employees').select('id,company_id').eq('id', id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!employee || employee.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  }

  try {
    await createEmployeeChangeRequest(admin, auth.session.companyId, id, auth.session.userId, payload);
    const requests = await getEmployeeChangeRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : 'Unable to create change request.' },
      { status: 400 }
    );
  }
}
