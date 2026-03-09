import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getLeaveApprovalRequests, reviewLeaveApprovalRequest } from '@/lib/platform/workflow';

export async function PATCH(request: Request, context: { params: Promise<{ id: string; requestId: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!['admin', 'manager'].includes(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can review leave approvals.' }, { status: 403 });
  }

  const { id, requestId } = await context.params;
  const admin = createAdminClient();
  const payload = await request.json();

  try {
    await reviewLeaveApprovalRequest(
      admin,
      auth.session.companyId,
      auth.session.userId,
      requestId,
      payload.decision,
      payload.comments
    );
    const requests = await getLeaveApprovalRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (reviewError) {
    return NextResponse.json(
      { error: reviewError instanceof Error ? reviewError.message : 'Unable to review leave approval.' },
      { status: 400 }
    );
  }
}
