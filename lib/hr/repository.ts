import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type {
  AuditLog,
  Company,
  ComplianceRecord,
  Employee,
  LeaveRequest,
  Payroll,
  PayrollDetail,
  User,
} from './types';

const HR_SCHEMA = 'HR';

function assertNoError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

function asRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, Number(entry ?? 0)])
  );
}

export function mapCompany(row: Database['HR']['Tables']['companies']['Row']): Company {
  return {
    id: row.id,
    name: row.name,
    registrationNumber: row.registration_number,
    taxPin: row.tax_pin,
    nssf: row.nssf_number,
    nhif: row.nhif_number,
    address: row.address,
    phone: row.phone,
    email: row.email,
    country: row.country,
    currency: row.currency,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapUser(row: Database['HR']['Tables']['company_users']['Row']): User {
  return {
    id: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    companyId: row.company_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapEmployee(row: Database['HR']['Tables']['employees']['Row']): Employee {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeNumber: row.employee_number,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phoneNumber: row.phone_number,
    idNumber: row.id_number,
    taxPin: row.tax_pin,
    accountNumber: row.account_number,
    bankCode: row.bank_code,
    bankName: row.bank_name,
    department: row.department,
    position: row.position,
    joiningDate: new Date(row.joining_date),
    status: row.status,
    employmentType: row.employment_type,
    baseSalary: Number(row.base_salary),
    salaryFrequency: row.salary_frequency,
    allowances: asRecord(row.allowances),
    deductions: asRecord(row.deductions),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapPayroll(row: Database['HR']['Tables']['payroll_runs']['Row']): Payroll {
  return {
    id: row.id,
    companyId: row.company_id,
    payrollMonth: row.payroll_month,
    payrollCycle: row.payroll_cycle,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    approvedBy: row.approved_by ?? undefined,
    processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
    processedBy: row.processed_by ?? undefined,
    lockedAt: row.locked_at ? new Date(row.locked_at) : undefined,
    lockedBy: row.locked_by ?? undefined,
  };
}

export function mapPayrollDetail(row: Database['HR']['Tables']['payroll_details']['Row']): PayrollDetail {
  return {
    id: row.id,
    payrollId: row.payroll_id,
    employeeId: row.employee_id,
    companyId: row.company_id,
    basicSalary: Number(row.basic_salary),
    allowancesTotal: Number(row.allowances_total),
    allowanceBreakdown: asRecord(row.allowance_breakdown),
    grossPay: Number(row.gross_pay),
    nssfAmount: Number(row.nssf_amount),
    nhifAmount: Number(row.nhif_amount),
    incomeTaxAmount: Number(row.income_tax_amount),
    otherDeductionsTotal: Number(row.other_deductions_total),
    otherDeductionsBreakdown: asRecord(row.other_deductions_breakdown),
    totalDeductions: Number(row.total_deductions),
    netPay: Number(row.net_pay),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method,
    paymentDate: row.payment_date ? new Date(row.payment_date) : undefined,
    mpesaReference: row.mpesa_reference ?? undefined,
    bankTransferReference: row.bank_transfer_reference ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapLeaveRequest(row: Database['HR']['Tables']['leave_requests']['Row']): LeaveRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    employeeId: row.employee_id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: row.days,
    status: row.status,
    reason: row.reason,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ? new Date(row.approved_at) : undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapComplianceRecord(row: Database['HR']['Tables']['compliance_records']['Row']): ComplianceRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    recordType: row.record_type,
    authority: row.authority,
    period: row.period,
    status: row.status,
    submissionDate: row.submission_date ? new Date(row.submission_date) : undefined,
    responseDate: row.response_date ? new Date(row.response_date) : undefined,
    details: (row.details as Record<string, unknown>) ?? {},
    createdBy: row.created_by ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapAuditLog(row: Database['HR']['Tables']['audit_logs']['Row']): AuditLog {
  return {
    id: row.id,
    companyId: row.company_id,
    actorUserId: row.actor_user_id ?? undefined,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    before: (row.before as Record<string, unknown> | null) ?? null,
    after: (row.after as Record<string, unknown> | null) ?? null,
    createdAt: new Date(row.created_at),
  };
}

export async function getCompany(client: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await client.schema(HR_SCHEMA).from('companies').select('*').eq('id', companyId).maybeSingle();
  assertNoError(error);
  return data ? mapCompany(data) : null;
}

export async function getCompanyUserByUserId(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.schema(HR_SCHEMA).from('company_users').select('*').eq('user_id', userId).maybeSingle();
  assertNoError(error);
  return data ? mapUser(data) : null;
}

export async function getUsersByCompany(client: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await client.schema(HR_SCHEMA).from('company_users').select('*').eq('company_id', companyId).order('created_at');
  assertNoError(error);
  return (data ?? []).map(mapUser);
}

export async function getEmployee(client: SupabaseClient<Database>, employeeId: string) {
  const { data, error } = await client.schema(HR_SCHEMA).from('employees').select('*').eq('id', employeeId).maybeSingle();
  assertNoError(error);
  return data ? mapEmployee(data) : null;
}

export async function getEmployeesByCompany(client: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await client
    .schema(HR_SCHEMA)
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapEmployee);
}

export async function getPayroll(client: SupabaseClient<Database>, payrollId: string) {
  const { data, error } = await client.schema(HR_SCHEMA).from('payroll_runs').select('*').eq('id', payrollId).maybeSingle();
  assertNoError(error);
  return data ? mapPayroll(data) : null;
}

export async function getPayrollsByCompany(client: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await client
    .schema(HR_SCHEMA)
    .from('payroll_runs')
    .select('*')
    .eq('company_id', companyId)
    .order('payroll_month', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapPayroll);
}

export async function getAuditLogsByEntity(
  client: SupabaseClient<Database>,
  companyId: string,
  entityType: string,
  entityId: string
) {
  const { data, error } = await client
    .schema(HR_SCHEMA)
    .from('audit_logs')
    .select('*')
    .eq('company_id', companyId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapAuditLog);
}

export async function getPayrollByMonth(client: SupabaseClient<Database>, companyId: string, month: string) {
  const { data, error } = await client
    .schema(HR_SCHEMA)
    .from('payroll_runs')
    .select('*')
    .eq('company_id', companyId)
    .eq('payroll_month', month)
    .maybeSingle();
  assertNoError(error);
  return data ? mapPayroll(data) : null;
}

export async function getPayrollDetail(client: SupabaseClient<Database>, detailId: string) {
  const { data, error } = await client.schema(HR_SCHEMA).from('payroll_details').select('*').eq('id', detailId).maybeSingle();
  assertNoError(error);
  return data ? mapPayrollDetail(data) : null;
}

export async function getPayrollDetailsByPayroll(client: SupabaseClient<Database>, payrollId: string) {
  const { data, error } = await client
    .schema(HR_SCHEMA)
    .from('payroll_details')
    .select('*')
    .eq('payroll_id', payrollId)
    .order('created_at');
  assertNoError(error);
  return (data ?? []).map(mapPayrollDetail);
}

export async function getLeaveRequestsByCompany(client: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await client
    .schema(HR_SCHEMA)
    .from('leave_requests')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapLeaveRequest);
}

export async function getComplianceRecordsByCompany(client: SupabaseClient<Database>, companyId: string) {
  const { data, error } = await client
    .schema(HR_SCHEMA)
    .from('compliance_records')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  assertNoError(error);
  return (data ?? []).map(mapComplianceRecord);
}

export async function insertAuditLog(
  client: SupabaseClient<Database>,
  payload: Database['HR']['Tables']['audit_logs']['Insert']
) {
  const { error } = await client.schema(HR_SCHEMA).from('audit_logs').insert(payload);
  assertNoError(error);
}
