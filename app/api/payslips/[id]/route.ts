import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getCompany, mapEmployee, mapPayroll, mapPayrollDetail } from '@/lib/hr/repository';
import { findSessionEmployee } from '@/lib/server/self-service';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: detail, error: detailError } = await admin
    .schema('HR')
    .from('payroll_details')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (detailError) {
    return NextResponse.json({ error: detailError.message }, { status: 400 });
  }
  if (!detail || detail.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Payslip not found.' }, { status: 404 });
  }

  if (auth.session.userRole === 'employee') {
    const employee = await findSessionEmployee(admin, auth.session);
    if (!employee || employee.id !== detail.employee_id) {
      return NextResponse.json({ error: 'You can only access your own payslips.' }, { status: 403 });
    }
  }

  const [{ data: employee, error: employeeError }, { data: payroll, error: payrollError }, company] = await Promise.all([
    admin.schema('HR').from('employees').select('*').eq('id', detail.employee_id).single(),
    admin.schema('HR').from('payroll_runs').select('*').eq('id', detail.payroll_id).single(),
    getCompany(admin, auth.session.companyId),
  ]);

  if (employeeError || payrollError || !company) {
    return NextResponse.json(
      { error: employeeError?.message ?? payrollError?.message ?? 'Unable to load payslip payload.' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    detail: mapPayrollDetail(detail),
    employee: mapEmployee(employee),
    payroll: mapPayroll(payroll),
    company,
  });
}
