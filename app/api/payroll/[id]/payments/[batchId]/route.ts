import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { listPaymentBatches, updatePaymentBatchStatus } from '@/lib/platform/payments';

export async function PATCH(request: Request, context: { params: Promise<{ id: string; batchId: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can manage payment batches.' }, { status: 403 });
  }

  const { id, batchId } = await context.params;
  const admin = createAdminClient();
  const payload = await request.json();

  try {
    await updatePaymentBatchStatus(
      admin,
      auth.session.companyId,
      id,
      batchId,
      auth.session.userId,
      payload.status,
      payload.reference
    );
    const batches = await listPaymentBatches(admin, auth.session.companyId, id);
    return NextResponse.json({ batches });
  } catch (batchError) {
    return NextResponse.json(
      { error: batchError instanceof Error ? batchError.message : 'Unable to update payment batch.' },
      { status: 400 }
    );
  }
}
