import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { createLeaveApprovalRequest, getLeaveApprovalRequests } from '@/lib/platform/workflow';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: leaveRequest, error } = await admin
    .schema('HR')
    .from('leave_requests')
    .select('id,company_id')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!leaveRequest || leaveRequest.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 });
  }

  try {
    const requests = await getLeaveApprovalRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : 'Unable to load leave approvals.' },
      { status: 400 }
    );
  }
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: leaveRequest, error } = await admin
    .schema('HR')
    .from('leave_requests')
    .select('id,company_id')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!leaveRequest || leaveRequest.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 });
  }

  try {
    await createLeaveApprovalRequest(admin, auth.session.companyId, id, auth.session.userId);
    const requests = await getLeaveApprovalRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (requestError) {
    return NextResponse.json(
      { error: requestError instanceof Error ? requestError.message : 'Unable to create leave approval request.' },
      { status: 400 }
    );
  }
}
