import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canReviewEmployeeChangeRequests } from '@/lib/platform/roles';
import { getEmployeeChangeRequests, reviewEmployeeChangeRequest } from '@/lib/platform/workflow';

export async function PATCH(request: Request, context: { params: Promise<{ id: string; requestId: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canReviewEmployeeChangeRequests(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators can review change requests.' }, { status: 403 });
  }

  const { id, requestId } = await context.params;
  const admin = createAdminClient();
  const payload = await request.json();

  try {
    await reviewEmployeeChangeRequest(
      admin,
      auth.session.companyId,
      auth.session.userId,
      requestId,
      payload.decision,
      payload.comments
    );
    const requests = await getEmployeeChangeRequests(admin, auth.session.companyId, id);
    return NextResponse.json({ requests });
  } catch (reviewError) {
    return NextResponse.json(
      { error: reviewError instanceof Error ? reviewError.message : 'Unable to review change request.' },
      { status: 400 }
    );
  }
}
