import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapEmployee } from '@/lib/hr/repository';
import { syncEmployeeToEnterprise } from '@/lib/platform/sync';

export async function POST(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!['admin', 'manager'].includes(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can create employees.' }, { status: 403 });
  }

  const payload = await request.json();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .schema('HR')
    .from('employees')
    .insert({
      company_id: auth.session.companyId,
      employee_number: payload.employeeNumber,
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone_number: payload.phoneNumber,
      id_number: payload.idNumber,
      tax_pin: payload.taxPin,
      account_number: payload.accountNumber,
      bank_code: payload.bankCode,
      bank_name: payload.bankName,
      department: payload.department,
      position: payload.position,
      joining_date: payload.joiningDate,
      status: payload.status ?? 'active',
      employment_type: payload.employmentType,
      base_salary: payload.baseSalary,
      salary_frequency: payload.salaryFrequency ?? 'monthly',
      allowances: payload.allowances ?? {},
      deductions: payload.deductions ?? {},
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to create employee.' }, { status: 400 });
  }

  try {
    await syncEmployeeToEnterprise(admin, data, {
      branchId: payload.branchId,
      departmentId: payload.departmentId,
      costCenterId: payload.costCenterId,
      payrollGroupId: payload.payrollGroupId,
      jobGrade: payload.jobGrade,
      workLocation: payload.workLocation,
      effectiveFrom: payload.joiningDate,
    });
  } catch (syncError) {
    await admin.schema('HR').from('employees').delete().eq('id', data.id);
    return NextResponse.json(
      { error: syncError instanceof Error ? syncError.message : 'Unable to sync employee to enterprise schema.' },
      { status: 400 }
    );
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'employee_created',
    entity_type: 'employees',
    entity_id: data.id,
    after: data,
  });

  return NextResponse.json({ employee: mapEmployee(data) });
}
