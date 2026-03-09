import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getPayrollApprovalRequests, reviewPayrollApprovalRequest } from '@/lib/platform/workflow';

export async function PATCH(request: Request, context: { params: Promise<{ id: string; requestId: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can review payroll approvals.' }, { status: 403 });
  }

  const { id, requestId } = await context.params;
  const admin = createAdminClient();
  const payload = await request.json();

  try {
    await reviewPayrollApprovalRequest(
      admin,
      auth.session.companyId,
      auth.session.userId,
      requestId,
      payload.decision,
      payload.comments
    );
    const requests = await getPayrollApprovalRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (reviewError) {
    return NextResponse.json(
      { error: reviewError instanceof Error ? reviewError.message : 'Unable to review payroll approval.' },
      { status: 400 }
    );
  }
}
