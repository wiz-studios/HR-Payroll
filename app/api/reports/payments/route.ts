import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';

export async function GET() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!['admin', 'manager'].includes(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can access payment reports.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: batches, error } = await admin
    .schema('payroll')
    .from('payment_batches')
    .select('id,pay_run_id,batch_type,status,reference,total_amount,total_employees,created_at,updated_at')
    .eq('company_id', auth.session.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const payRunIds = (batches ?? []).map((batch) => batch.pay_run_id as string);
  const { data: payRuns, error: payRunsError } = await admin
    .schema('payroll')
    .from('pay_runs')
    .select('id,pay_period_label,status')
    .in('id', payRunIds.length > 0 ? payRunIds : ['00000000-0000-0000-0000-000000000000']);

  if (payRunsError) {
    return NextResponse.json({ error: payRunsError.message }, { status: 400 });
  }

  const payRunDirectory = new Map((payRuns ?? []).map((payRun) => [payRun.id, payRun]));
  const items = (batches ?? []).map((batch) => ({
    id: batch.id as string,
    payRunId: batch.pay_run_id as string,
    month: (payRunDirectory.get(batch.pay_run_id as string)?.pay_period_label as string | undefined) ?? 'Unknown',
    payrollStatus: (payRunDirectory.get(batch.pay_run_id as string)?.status as string | undefined) ?? 'unknown',
    batchType: batch.batch_type as string,
    status: batch.status as string,
    reference: batch.reference as string | null,
    totalAmount: Number(batch.total_amount ?? 0),
    totalEmployees: Number(batch.total_employees ?? 0),
    createdAt: batch.created_at as string,
    updatedAt: batch.updated_at as string,
  }));

  return NextResponse.json({ items });
}
