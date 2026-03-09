import type { SupabaseClient } from '@supabase/supabase-js';

type UntypedClient = SupabaseClient<any, any, any>;

function slugifyCompanyName(name: string) {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'company';
}

function mapLegacyRoleToCore(role: 'admin' | 'manager' | 'employee') {
  if (role === 'admin') return 'company_admin';
  if (role === 'manager') return 'hr_manager';
  return 'employee';
}

export async function syncCompanyToEnterprise(
  client: UntypedClient,
  company: {
    id: string;
    name: string;
    registration_number: string;
    tax_pin: string;
    phone: string;
    email: string;
    currency?: string;
    created_at?: string;
    updated_at?: string;
  }
) {
  const now = new Date().toISOString();
  const { error } = await client
    .schema('core')
    .from('companies')
    .upsert(
      {
        id: company.id,
        tenant_code: `${slugifyCompanyName(company.name)}-${company.id.slice(0, 8)}`,
        legal_name: company.name,
        display_name: company.name,
        registration_number: company.registration_number,
        tax_pin: company.tax_pin,
        primary_phone: company.phone,
        primary_email: company.email,
        default_currency: company.currency ?? 'KES',
        country_code: 'KE',
        legacy_hr_company_id: company.id,
        created_at: company.created_at ?? now,
        updated_at: company.updated_at ?? now,
      },
      { onConflict: 'id' }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function syncMembershipToEnterprise(
  client: UntypedClient,
  membership: {
    company_id: string;
    user_id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'admin' | 'manager' | 'employee';
    created_at?: string;
    updated_at?: string;
  }
) {
  const now = new Date().toISOString();
  const { error } = await client
    .schema('core')
    .from('company_memberships')
    .upsert(
      {
        company_id: membership.company_id,
        user_id: membership.user_id,
        email: membership.email,
        first_name: membership.first_name,
        last_name: membership.last_name,
        role: mapLegacyRoleToCore(membership.role),
        created_at: membership.created_at ?? now,
        updated_at: membership.updated_at ?? now,
      },
      { onConflict: 'company_id,user_id' }
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function ensureDepartment(client: UntypedClient, companyId: string, departmentName: string) {
  const normalizedName = departmentName.trim();
  const { data: existing, error: findError } = await client
    .schema('core')
    .from('departments')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', normalizedName)
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }
  if (existing?.id) return existing.id as string;

  const { count } = await client
    .schema('core')
    .from('departments')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId);

  const departmentCode = `DEPT-${String((count ?? 0) + 1).padStart(3, '0')}`;
  const { data, error } = await client
    .schema('core')
    .from('departments')
    .insert({
      company_id: companyId,
      department_code: departmentCode,
      name: normalizedName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to create department.');
  }

  return data.id as string;
}

async function ensureDefaultPayrollGroup(client: UntypedClient, companyId: string) {
  const { data: existing, error: findError } = await client
    .schema('core')
    .from('payroll_groups')
    .select('id')
    .eq('company_id', companyId)
    .eq('group_code', 'DEFAULT-MONTHLY')
    .maybeSingle();

  if (findError) {
    throw new Error(findError.message);
  }
  if (existing?.id) return existing.id as string;

  const { data: company, error: companyError } = await client
    .schema('core')
    .from('companies')
    .select('display_name')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message ?? 'Company not found in core schema.');
  }

  const { data, error } = await client
    .schema('core')
    .from('payroll_groups')
    .insert({
      company_id: companyId,
      group_code: 'DEFAULT-MONTHLY',
      name: `${company.display_name} Monthly Payroll`,
      pay_frequency: 'monthly',
      is_default: true,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Unable to create payroll group.');
  }

  return data.id as string;
}

export async function syncEmployeeToEnterprise(
  client: UntypedClient,
  employee: {
    id: string;
    company_id: string;
    employee_number: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    id_number: string;
    tax_pin: string;
    account_number: string;
    bank_code: string;
    bank_name: string;
    department: string;
    position: string;
    joining_date: string;
    status: 'active' | 'inactive' | 'on_leave' | 'terminated';
    employment_type: 'permanent' | 'contract' | 'casual';
    base_salary: number;
    salary_frequency: 'monthly' | 'weekly' | 'daily';
    allowances: Record<string, number>;
    deductions: Record<string, number>;
    created_at?: string;
    updated_at?: string;
  }
) {
  const now = new Date().toISOString();
  await syncCompanyShellIfMissing(client, employee.company_id);

  const departmentId = await ensureDepartment(client, employee.company_id, employee.department);
  const payrollGroupId = await ensureDefaultPayrollGroup(client, employee.company_id);

  const { error: profileError } = await client
    .schema('hr')
    .from('employee_profiles')
    .upsert(
      {
        id: employee.id,
        company_id: employee.company_id,
        employee_number: employee.employee_number,
        first_name: employee.first_name,
        last_name: employee.last_name,
        work_email: employee.email,
        phone_number: employee.phone_number,
        id_number: employee.id_number,
        tax_pin: employee.tax_pin,
        bank_details: {
          accountNumber: employee.account_number,
          bankCode: employee.bank_code,
          bankName: employee.bank_name,
        },
        status: employee.status,
        created_at: employee.created_at ?? now,
        updated_at: employee.updated_at ?? now,
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { data: employmentExisting, error: employmentFindError } = await client
    .schema('hr')
    .from('employment_records')
    .select('id')
    .eq('employee_id', employee.id)
    .eq('is_current', true)
    .maybeSingle();

  if (employmentFindError) {
    throw new Error(employmentFindError.message);
  }

  if (employmentExisting?.id) {
    const { error } = await client
      .schema('hr')
      .from('employment_records')
      .update({
        department_id: departmentId,
        payroll_group_id: payrollGroupId,
        job_title: employee.position,
        employment_type: employee.employment_type,
      })
      .eq('id', employmentExisting.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client
      .schema('hr')
      .from('employment_records')
      .insert({
        company_id: employee.company_id,
        employee_id: employee.id,
        department_id: departmentId,
        payroll_group_id: payrollGroupId,
        job_title: employee.position,
        employment_type: employee.employment_type,
        join_date: employee.joining_date,
        effective_from: employee.joining_date,
        is_current: true,
        created_at: employee.created_at ?? now,
      });
    if (error) throw new Error(error.message);
  }

  const { data: compensationExisting, error: compensationFindError } = await client
    .schema('hr')
    .from('compensation_records')
    .select('id')
    .eq('employee_id', employee.id)
    .eq('is_current', true)
    .maybeSingle();

  if (compensationFindError) {
    throw new Error(compensationFindError.message);
  }

  const compensationPayload = {
    company_id: employee.company_id,
    employee_id: employee.id,
    currency: 'KES',
    salary_frequency: employee.salary_frequency,
    payment_method: 'bank_transfer',
    base_salary: employee.base_salary,
    allowances: employee.allowances ?? {},
    recurring_deductions: employee.deductions ?? {},
    effective_from: employee.joining_date,
    is_current: true,
  };

  if (compensationExisting?.id) {
    const { error } = await client
      .schema('hr')
      .from('compensation_records')
      .update(compensationPayload)
      .eq('id', compensationExisting.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.schema('hr').from('compensation_records').insert(compensationPayload);
    if (error) throw new Error(error.message);
  }
}

async function syncCompanyShellIfMissing(client: UntypedClient, companyId: string) {
  const { data: existing, error } = await client.schema('core').from('companies').select('id').eq('id', companyId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (existing?.id) return;

  const { data: legacyCompany, error: legacyError } = await client
    .schema('HR')
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (legacyError || !legacyCompany) {
    throw new Error(legacyError?.message ?? 'Legacy company not found.');
  }

  await syncCompanyToEnterprise(client, legacyCompany);
}

export async function getCompanyStructure(client: UntypedClient, companyId: string) {
  const [departmentsResult, payrollGroupsResult] = await Promise.all([
    client.schema('core').from('departments').select('id,name,department_code').eq('company_id', companyId).order('name'),
    client.schema('core').from('payroll_groups').select('id,name,group_code,pay_frequency,is_default').eq('company_id', companyId).order('name'),
  ]);

  if (departmentsResult.error) {
    throw new Error(departmentsResult.error.message);
  }
  if (payrollGroupsResult.error) {
    throw new Error(payrollGroupsResult.error.message);
  }

  return {
    departments: departmentsResult.data ?? [],
    payrollGroups: payrollGroupsResult.data ?? [],
  };
}
