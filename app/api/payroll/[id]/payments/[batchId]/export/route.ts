import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canManagePaymentBatches } from '@/lib/platform/roles';
import { exportPaymentBatchCsv } from '@/lib/platform/payments';

export async function GET(_: Request, context: { params: Promise<{ id: string; batchId: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canManagePaymentBatches(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators can export payment batches.' }, { status: 403 });
  }

  const { id, batchId } = await context.params;
  const admin = createAdminClient();

  try {
    const csv = await exportPaymentBatchCsv(admin, auth.session.companyId, id, batchId, auth.session.userId);
    const filename = `${id}-payment-batch-${batchId.slice(0, 8)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (batchError) {
    return NextResponse.json(
      { error: batchError instanceof Error ? batchError.message : 'Unable to export payment batch.' },
      { status: 400 }
    );
  }
}
