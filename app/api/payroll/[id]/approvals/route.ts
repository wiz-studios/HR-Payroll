import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canSubmitPayrollForApproval } from '@/lib/platform/roles';
import { createPayrollApprovalRequest, getPayrollApprovalRequests } from '@/lib/platform/workflow';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: payroll, error } = await admin.schema('HR').from('payroll_runs').select('id,company_id').eq('id', id).maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!payroll || payroll.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Payroll run not found.' }, { status: 404 });
  }

  try {
    const requests = await getPayrollApprovalRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : 'Unable to load payroll approvals.' },
      { status: 400 }
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canSubmitPayrollForApproval(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can submit payroll approvals.' }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const payload = await request.json();

  try {
    await createPayrollApprovalRequest(admin, auth.session.companyId, id, auth.session.userId, payload.reason ?? 'Submitted for approval');
    const requests = await getPayrollApprovalRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : 'Unable to submit payroll approval request.' },
      { status: 400 }
    );
  }
}
