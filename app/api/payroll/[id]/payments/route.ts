import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canManagePaymentBatches } from '@/lib/platform/roles';
import { createPaymentBatch, listPaymentBatches } from '@/lib/platform/payments';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const admin = createAdminClient();

  try {
    const batches = await listPaymentBatches(admin, auth.session.companyId, id);
    return NextResponse.json({ batches });
  } catch (batchError) {
    return NextResponse.json(
      { error: batchError instanceof Error ? batchError.message : 'Unable to load payment batches.' },
      { status: 400 }
    );
  }
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canManagePaymentBatches(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators can create payment batches.' }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  try {
    await createPaymentBatch(admin, auth.session.companyId, id, auth.session.userId);
    const batches = await listPaymentBatches(admin, auth.session.companyId, id);
    return NextResponse.json({ batches });
  } catch (batchError) {
    return NextResponse.json(
      { error: batchError instanceof Error ? batchError.message : 'Unable to create payment batch.' },
      { status: 400 }
    );
  }
}
