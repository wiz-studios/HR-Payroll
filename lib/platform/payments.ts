import type { SupabaseClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/lib/hr/repository';

type UntypedClient = SupabaseClient<any, any, any>;

type BatchStatus = 'draft' | 'exported' | 'submitted' | 'reconciled' | 'failed';

export const BATCH_TRANSITIONS = {
  draft: ['exported', 'failed'],
  exported: ['submitted', 'failed'],
  submitted: ['reconciled', 'failed'],
  reconciled: [],
  failed: ['draft'],
} satisfies Record<BatchStatus, BatchStatus[]>;

export function canTransitionPaymentBatchStatus(currentStatus: BatchStatus, nextStatus: BatchStatus) {
  return BATCH_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function getPaymentBatchItemStatus(nextStatus: BatchStatus) {
  return nextStatus === 'submitted'
    ? 'submitted'
    : nextStatus === 'reconciled'
      ? 'reconciled'
      : nextStatus === 'failed'
        ? 'failed'
        : 'pending';
}

async function getDefaultPayrollGroupId(client: UntypedClient, companyId: string) {
  const { data: payrollGroup, error } = await client
    .schema('core')
    .from('payroll_groups')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (payrollGroup?.id as string | undefined) ?? null;
}

export async function syncPayrollRunToEnterprise(client: UntypedClient, companyId: string, payrollId: string) {
  const { data: payrollRun, error: payrollError } = await client
    .schema('HR')
    .from('payroll_runs')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', payrollId)
    .single();

  if (payrollError || !payrollRun) {
    throw new Error(payrollError?.message ?? 'Payroll run not found.');
  }

  const payrollGroupId = await getDefaultPayrollGroupId(client, companyId);
  const { error: syncRunError } = await client.schema('payroll').from('pay_runs').upsert(
    {
      id: payrollRun.id,
      company_id: companyId,
      payroll_group_id: payrollGroupId,
      pay_period_label: payrollRun.payroll_month,
      pay_frequency: payrollRun.payroll_cycle,
      status: payrollRun.status,
      approved_at: payrollRun.approved_at,
      approved_by: payrollRun.approved_by,
      locked_at: payrollRun.locked_at,
      locked_by: payrollRun.locked_by,
      processed_at: payrollRun.processed_at,
      processed_by: payrollRun.processed_by,
      created_at: payrollRun.created_at,
      updated_at: payrollRun.updated_at,
    },
    { onConflict: 'id' }
  );

  if (syncRunError) throw new Error(syncRunError.message);

  const { data: payrollDetails, error: detailsError } = await client
    .schema('HR')
    .from('payroll_details')
    .select('*')
    .eq('company_id', companyId)
    .eq('payroll_id', payrollId);

  if (detailsError) throw new Error(detailsError.message);

  if ((payrollDetails ?? []).length === 0) return;

  const { error: itemsError } = await client.schema('payroll').from('pay_run_items').upsert(
    (payrollDetails ?? []).map((detail) => ({
      id: detail.id,
      pay_run_id: detail.payroll_id,
      company_id: companyId,
      employee_id: detail.employee_id,
      compensation_snapshot: {
        basicSalary: detail.basic_salary,
        allowancesTotal: detail.allowances_total,
      },
      earnings: {
        basicSalary: detail.basic_salary,
        allowances: detail.allowance_breakdown,
        allowancesTotal: detail.allowances_total,
      },
      deductions: {
        nssf: detail.nssf_amount,
        nhif: detail.nhif_amount,
        incomeTax: detail.income_tax_amount,
        other: detail.other_deductions_breakdown,
        otherTotal: detail.other_deductions_total,
      },
      employer_contributions: {},
      gross_pay: detail.gross_pay,
      taxable_pay: Math.max(Number(detail.gross_pay) - Number(detail.nssf_amount) - Number(detail.nhif_amount), 0),
      total_deductions: detail.total_deductions,
      net_pay: detail.net_pay,
      payment_status: detail.payment_status,
      payment_date: detail.payment_date,
      payment_reference: detail.bank_transfer_reference ?? detail.mpesa_reference,
      validation_summary: {},
      created_at: detail.created_at,
      updated_at: detail.updated_at,
    })),
    { onConflict: 'id' }
  );

  if (itemsError) throw new Error(itemsError.message);
}

export async function listPaymentBatches(client: UntypedClient, companyId: string, payrollId: string) {
  await syncPayrollRunToEnterprise(client, companyId, payrollId);

  const { data: batches, error } = await client
    .schema('payroll')
    .from('payment_batches')
    .select('*')
    .eq('company_id', companyId)
    .eq('pay_run_id', payrollId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const batchIds = (batches ?? []).map((batch) => batch.id as string);
  const { data: items, error: itemsError } = await client
    .schema('payroll')
    .from('payment_batch_items')
    .select('batch_id,status,amount')
    .in('batch_id', batchIds.length > 0 ? batchIds : ['00000000-0000-0000-0000-000000000000']);

  if (itemsError) throw new Error(itemsError.message);

  return (batches ?? []).map((batch) => {
    const batchItems = (items ?? []).filter((item) => item.batch_id === batch.id);
    return {
      id: batch.id as string,
      payRunId: batch.pay_run_id as string,
      batchType: batch.batch_type as string,
      status: batch.status as BatchStatus,
      filePath: batch.file_path as string | null,
      reference: batch.reference as string | null,
      totalAmount: Number(batch.total_amount ?? 0),
      totalEmployees: Number(batch.total_employees ?? 0),
      createdAt: batch.created_at as string,
      updatedAt: batch.updated_at as string,
      itemBreakdown: {
        pending: batchItems.filter((item) => item.status === 'pending').length,
        submitted: batchItems.filter((item) => item.status === 'submitted').length,
        paid: batchItems.filter((item) => item.status === 'paid').length,
        failed: batchItems.filter((item) => item.status === 'failed').length,
        reconciled: batchItems.filter((item) => item.status === 'reconciled').length,
      },
    };
  });
}

export async function createPaymentBatch(
  client: UntypedClient,
  companyId: string,
  payrollId: string,
  actorUserId: string
) {
  await syncPayrollRunToEnterprise(client, companyId, payrollId);

  const { data: payrollRun, error: payrollError } = await client
    .schema('HR')
    .from('payroll_runs')
    .select('id,status,payroll_month')
    .eq('company_id', companyId)
    .eq('id', payrollId)
    .single();

  if (payrollError || !payrollRun) throw new Error(payrollError?.message ?? 'Payroll run not found.');
  if (!['processed', 'paid'].includes(payrollRun.status as string)) {
    throw new Error('Payment batches can only be created after payroll has been processed.');
  }

  const { data: openBatch } = await client
    .schema('payroll')
    .from('payment_batches')
    .select('id,status')
    .eq('company_id', companyId)
    .eq('pay_run_id', payrollId)
    .in('status', ['draft', 'exported', 'submitted'])
    .maybeSingle();

  if (openBatch?.id) {
    throw new Error(`A ${openBatch.status} payment batch already exists for this payroll run.`);
  }

  const { data: payRunItems, error: payRunItemsError } = await client
    .schema('payroll')
    .from('pay_run_items')
    .select('id,employee_id,net_pay')
    .eq('company_id', companyId)
    .eq('pay_run_id', payrollId);

  if (payRunItemsError) throw new Error(payRunItemsError.message);
  if ((payRunItems ?? []).length === 0) {
    throw new Error('No pay run items are available for this payment batch.');
  }

  const employeeIds = (payRunItems ?? []).map((item) => item.employee_id as string);
  const { data: employees, error: employeesError } = await client
    .schema('HR')
    .from('employees')
    .select('id,account_number,bank_code,bank_name,first_name,last_name')
    .in('id', employeeIds);

  if (employeesError) throw new Error(employeesError.message);

  const employeeDirectory = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const totalAmount = (payRunItems ?? []).reduce((sum, item) => sum + Number(item.net_pay ?? 0), 0);
  const now = new Date().toISOString();

  const { data: batch, error: batchError } = await client
    .schema('payroll')
    .from('payment_batches')
    .insert({
      company_id: companyId,
      pay_run_id: payrollId,
      batch_type: 'bank_transfer',
      status: 'draft',
      total_amount: totalAmount,
      total_employees: payRunItems?.length ?? 0,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (batchError || !batch) throw new Error(batchError?.message ?? 'Unable to create payment batch.');

  const { error: itemsError } = await client.schema('payroll').from('payment_batch_items').insert(
    (payRunItems ?? []).map((item) => {
      const employee = employeeDirectory.get(item.employee_id as string);
      return {
        batch_id: batch.id,
        pay_run_item_id: item.id,
        employee_id: item.employee_id,
        amount: item.net_pay,
        destination: {
          method: 'bank_transfer',
          accountNumber: employee?.account_number ?? '',
          bankCode: employee?.bank_code ?? '',
          bankName: employee?.bank_name ?? '',
          employeeName: `${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim(),
        },
        status: 'pending',
        created_at: now,
        updated_at: now,
      };
    })
  );

  if (itemsError) {
    await client.schema('payroll').from('payment_batches').delete().eq('id', batch.id);
    throw new Error(itemsError.message);
  }

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: actorUserId,
    action: 'payment_batch_created',
    entity_type: 'payroll.payment_batches',
    entity_id: batch.id,
    after: {
      payrollId,
      payrollMonth: payrollRun.payroll_month,
      totalAmount,
      totalEmployees: payRunItems?.length ?? 0,
    },
  });

  return batch.id as string;
}

export async function updatePaymentBatchStatus(
  client: UntypedClient,
  companyId: string,
  payrollId: string,
  batchId: string,
  actorUserId: string,
  nextStatus: BatchStatus,
  reference?: string | null
) {
  const { data: batch, error } = await client
    .schema('payroll')
    .from('payment_batches')
    .select('*')
    .eq('company_id', companyId)
    .eq('pay_run_id', payrollId)
    .eq('id', batchId)
    .single();

  if (error || !batch) throw new Error(error?.message ?? 'Payment batch not found.');
  if (!canTransitionPaymentBatchStatus(batch.status as BatchStatus, nextStatus)) {
    throw new Error(`Invalid transition from ${batch.status} to ${nextStatus}.`);
  }

  const now = new Date().toISOString();
  const { error: batchUpdateError } = await client
    .schema('payroll')
    .from('payment_batches')
    .update({
      status: nextStatus,
      reference: reference ?? batch.reference,
      updated_at: now,
    })
    .eq('id', batchId);

  if (batchUpdateError) throw new Error(batchUpdateError.message);

  const itemStatus = getPaymentBatchItemStatus(nextStatus);

  const { error: itemUpdateError } = await client
    .schema('payroll')
    .from('payment_batch_items')
    .update({
      status: itemStatus,
      provider_reference: reference ?? null,
      failure_reason: nextStatus === 'failed' ? reference ?? 'Marked as failed' : null,
      updated_at: now,
    })
    .eq('batch_id', batchId);

  if (itemUpdateError) throw new Error(itemUpdateError.message);

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: actorUserId,
    action: `payment_batch_${nextStatus}`,
    entity_type: 'payroll.payment_batches',
    entity_id: batchId,
    before: { status: batch.status, reference: batch.reference },
    after: { status: nextStatus, reference: reference ?? batch.reference },
  });
}

export async function exportPaymentBatchCsv(
  client: UntypedClient,
  companyId: string,
  payrollId: string,
  batchId: string,
  actorUserId: string
) {
  const { data: batch, error: batchError } = await client
    .schema('payroll')
    .from('payment_batches')
    .select('*')
    .eq('company_id', companyId)
    .eq('pay_run_id', payrollId)
    .eq('id', batchId)
    .single();

  if (batchError || !batch) throw new Error(batchError?.message ?? 'Payment batch not found.');
  if (!['draft', 'exported'].includes(batch.status as string)) {
    throw new Error('Only draft or exported batches can be exported.');
  }

  const { data: items, error: itemsError } = await client
    .schema('payroll')
    .from('payment_batch_items')
    .select('employee_id,amount,destination')
    .eq('batch_id', batchId)
    .order('created_at');

  if (itemsError) throw new Error(itemsError.message);

  const employeeIds = (items ?? []).map((item) => item.employee_id as string);
  const { data: employees, error: employeesError } = await client
    .schema('HR')
    .from('employees')
    .select('id,employee_number,first_name,last_name')
    .in('id', employeeIds);

  if (employeesError) throw new Error(employeesError.message);

  const employeeDirectory = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const header = ['employee_number', 'employee_name', 'amount', 'bank_code', 'bank_name', 'account_number'];
  const rows = (items ?? []).map((item) => {
    const employee = employeeDirectory.get(item.employee_id as string);
    const destination = (item.destination as Record<string, string | undefined>) ?? {};
    return [
      employee?.employee_number ?? '',
      `${employee?.first_name ?? ''} ${employee?.last_name ?? ''}`.trim(),
      Number(item.amount ?? 0).toFixed(2),
      destination.bankCode ?? '',
      destination.bankName ?? '',
      destination.accountNumber ?? '',
    ];
  });

  if (batch.status === 'draft') {
    await updatePaymentBatchStatus(client, companyId, payrollId, batchId, actorUserId, 'exported', batch.reference);
  }

  return [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
}

export async function hasReconciledPaymentBatch(client: UntypedClient, companyId: string, payrollId: string) {
  const { data, error } = await client
    .schema('payroll')
    .from('payment_batches')
    .select('id')
    .eq('company_id', companyId)
    .eq('pay_run_id', payrollId)
    .eq('status', 'reconciled')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data?.id);
}
