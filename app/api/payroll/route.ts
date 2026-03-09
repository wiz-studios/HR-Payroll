import { NextResponse } from 'next/server';
import { calculateBulkPayroll } from '@/lib/payroll-calculator';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getEmployeesByCompany, insertAuditLog, mapPayroll, mapPayrollDetail } from '@/lib/hr/repository';
import { syncPayrollRunToEnterprise } from '@/lib/platform/payments';

export async function POST(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const payload = await request.json();
  if (!payload.payrollMonth || typeof payload.payrollMonth !== 'string') {
    return NextResponse.json({ error: 'Payroll month is required.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const employees = (await getEmployeesByCompany(admin, auth.session.companyId)).filter((employee) => employee.status === 'active');
  if (employees.length === 0) {
    return NextResponse.json({ error: 'No active employees are available for payroll.' }, { status: 400 });
  }

  const { data: existing } = await admin
    .schema('HR')
    .from('payroll_runs')
    .select('id')
    .eq('company_id', auth.session.companyId)
    .eq('payroll_month', payload.payrollMonth)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Payroll for this month already exists.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const calculations = calculateBulkPayroll(employees);

  const { data: payroll, error: payrollError } = await admin
    .schema('HR')
    .from('payroll_runs')
    .insert({
      company_id: auth.session.companyId,
      payroll_month: payload.payrollMonth,
      payroll_cycle: 'monthly',
      status: 'draft',
      locked_at: null,
      locked_by: null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (payrollError || !payroll) {
    return NextResponse.json({ error: payrollError?.message ?? 'Unable to create payroll run.' }, { status: 400 });
  }

  const detailRows = employees.map((employee) => {
    const calculation = calculations.get(employee.id)!;
    return {
      payroll_id: payroll.id,
      employee_id: employee.id,
      company_id: auth.session.companyId,
      basic_salary: calculation.basicSalary,
      allowances_total: calculation.allowances.total,
      allowance_breakdown: calculation.allowances.breakdown,
      gross_pay: calculation.grossSalary,
      nssf_amount: calculation.deductions.nssf,
      nhif_amount: calculation.deductions.nhif,
      income_tax_amount: calculation.deductions.incomeTax,
      other_deductions_total: calculation.deductions.other.total,
      other_deductions_breakdown: calculation.deductions.other.breakdown,
      total_deductions: calculation.deductions.total,
      net_pay: calculation.netPay,
      payment_status: 'pending' as const,
      payment_method: 'bank_transfer' as const,
      created_at: now,
      updated_at: now,
    };
  });

  const { data: details, error: detailError } = await admin
    .schema('HR')
    .from('payroll_details')
    .insert(detailRows)
    .select('*');

  if (detailError) {
    await admin.schema('HR').from('payroll_runs').delete().eq('id', payroll.id);
    return NextResponse.json({ error: detailError.message }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'payroll_created',
    entity_type: 'payroll_runs',
    entity_id: payroll.id,
    after: {
      payrollMonth: payroll.payroll_month,
      status: payroll.status,
      employeeCount: employees.length,
      grossPay: detailRows.reduce((sum, row) => sum + row.gross_pay, 0),
      totalDeductions: detailRows.reduce((sum, row) => sum + row.total_deductions, 0),
      netPay: detailRows.reduce((sum, row) => sum + row.net_pay, 0),
    },
  });

  await syncPayrollRunToEnterprise(admin, auth.session.companyId, payroll.id);

  return NextResponse.json({
    payroll: mapPayroll(payroll),
    payrollDetails: (details ?? []).map(mapPayrollDetail),
  });
}
