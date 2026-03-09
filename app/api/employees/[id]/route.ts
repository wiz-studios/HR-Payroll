import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapEmployee } from '@/lib/hr/repository';
import { syncEmployeeToEnterprise } from '@/lib/platform/sync';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!['admin', 'manager'].includes(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can update employees.' }, { status: 403 });
  }

  const { id } = await context.params;
  const updates = await request.json();
  const admin = createAdminClient();
  const effectiveFrom = typeof updates.effectiveFrom === 'string' && updates.effectiveFrom ? updates.effectiveFrom : null;

  if (effectiveFrom && effectiveFrom > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: 'Future-dated changes are not available until the app reads employee state from versioned enterprise records.' },
      { status: 400 }
    );
  }

  const { data: existing } = await admin.schema('HR').from('employees').select('*').eq('id', id).maybeSingle();
  if (!existing || existing.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  }

  const { data, error } = await admin
    .schema('HR')
    .from('employees')
    .update({
      first_name: updates.firstName,
      last_name: updates.lastName,
      email: updates.email,
      phone_number: updates.phoneNumber,
      id_number: updates.idNumber,
      tax_pin: updates.taxPin,
      account_number: updates.accountNumber,
      bank_code: updates.bankCode,
      bank_name: updates.bankName,
      department: updates.department,
      position: updates.position,
      status: updates.status,
      employment_type: updates.employmentType,
      base_salary: updates.baseSalary,
      allowances: updates.allowances,
      deductions: updates.deductions,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to update employee.' }, { status: 400 });
  }

  try {
    await syncEmployeeToEnterprise(admin, data, {
      branchId: updates.branchId,
      departmentId: updates.departmentId,
      costCenterId: updates.costCenterId,
      payrollGroupId: updates.payrollGroupId,
      jobGrade: updates.jobGrade,
      workLocation: updates.workLocation,
      effectiveFrom: updates.effectiveFrom,
    });
  } catch (syncError) {
    return NextResponse.json(
      { error: syncError instanceof Error ? syncError.message : 'Employee updated in HR but failed to sync to enterprise schema.' },
      { status: 400 }
    );
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'employee_updated',
    entity_type: 'employees',
    entity_id: data.id,
    before: existing,
    after: data,
  });

  return NextResponse.json({ employee: mapEmployee(data) });
}
