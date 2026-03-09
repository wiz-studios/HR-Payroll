import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { mapPayroll, mapPayrollDetail } from '@/lib/hr/repository';
import { findSessionEmployee } from '@/lib/server/self-service';

export async function GET() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();

  try {
    const employee = await findSessionEmployee(admin, auth.session);
    if (!employee) {
      return NextResponse.json({ error: 'No employee profile is linked to this account yet.' }, { status: 404 });
    }

    const { data: details, error } = await admin
      .schema('HR')
      .from('payroll_details')
      .select('*')
      .eq('company_id', auth.session.companyId)
      .eq('employee_id', employee.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const payrollIds = (details ?? []).map((detail) => detail.payroll_id as string);
    const { data: payrollRuns, error: payrollError } = await admin
      .schema('HR')
      .from('payroll_runs')
      .select('*')
      .in('id', payrollIds.length > 0 ? payrollIds : ['00000000-0000-0000-0000-000000000000']);

    if (payrollError) {
      return NextResponse.json({ error: payrollError.message }, { status: 400 });
    }

    const payrollDirectory = new Map((payrollRuns ?? []).map((payroll) => [payroll.id, mapPayroll(payroll)]));
    return NextResponse.json({
      employee: mapEmployee(employee),
      payslips: (details ?? []).map((detail) => ({
        detail: mapPayrollDetail(detail),
        payroll: payrollDirectory.get(detail.payroll_id as string) ?? null,
      })),
    });
  } catch (payslipError) {
    return NextResponse.json(
      { error: payslipError instanceof Error ? payslipError.message : 'Unable to load self-service payslips.' },
      { status: 400 }
    );
  }
}
