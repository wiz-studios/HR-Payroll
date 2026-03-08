import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import {
  getCompany,
  getCompanyUserByUserId,
  getAuditLogsByEntity,
  getComplianceRecordsByCompany,
  getEmployee,
  getEmployeesByCompany,
  getLeaveRequestsByCompany,
  getPayroll,
  getPayrollByMonth,
  getPayrollDetail,
  getPayrollDetailsByPayroll,
  getPayrollsByCompany,
  getUsersByCompany,
  mapCompany,
  mapComplianceRecord,
  mapEmployee,
  mapLeaveRequest,
  mapPayroll,
  mapPayrollDetail,
  mapUser,
} from '@/lib/hr/repository';
export type {
  AuditLog,
  Company,
  ComplianceRecord,
  Employee,
  LeaveRequest,
  Payroll,
  PayrollDetail,
  User,
} from '@/lib/hr/types';

const HR_SCHEMA = 'HR';

function browserClient() {
  return getSupabaseBrowserClient();
}

function nowIso() {
  return new Date().toISOString();
}

export const db = {
  async getCompany(id: string) {
    return getCompany(browserClient(), id);
  },

  async getUserById(userId: string) {
    const membership = await getCompanyUserByUserId(browserClient(), userId);
    return membership;
  },

  async getUsersByCompany(companyId: string) {
    return getUsersByCompany(browserClient(), companyId);
  },

  async updateCompany(id: string, updates: Partial<Database['HR']['Tables']['companies']['Update']> & Record<string, unknown>) {
    const payload: Database['HR']['Tables']['companies']['Update'] = {
      name: updates.name as string | undefined,
      registration_number: updates.registrationNumber as string | undefined,
      tax_pin: updates.taxPin as string | undefined,
      nssf_number: updates.nssf as string | undefined,
      nhif_number: updates.nhif as string | undefined,
      address: updates.address as string | undefined,
      phone: updates.phone as string | undefined,
      email: updates.email as string | undefined,
      updated_at: nowIso(),
    };

    const { data, error } = await browserClient()
      .schema(HR_SCHEMA)
      .from('companies')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return mapCompany(data);
  },

  async createEmployee(employee: Record<string, unknown>) {
    const payload: Database['HR']['Tables']['employees']['Insert'] = {
      company_id: employee.companyId as string,
      employee_number: employee.employeeNumber as string,
      first_name: employee.firstName as string,
      last_name: employee.lastName as string,
      email: employee.email as string,
      phone_number: employee.phoneNumber as string,
      id_number: employee.idNumber as string,
      tax_pin: employee.taxPin as string,
      account_number: employee.accountNumber as string,
      bank_code: employee.bankCode as string,
      bank_name: employee.bankName as string,
      department: employee.department as string,
      position: employee.position as string,
      joining_date: employee.joiningDate instanceof Date ? employee.joiningDate.toISOString().slice(0, 10) : (employee.joiningDate as string),
      status: employee.status as Database['HR']['Tables']['employees']['Insert']['status'],
      employment_type: employee.employmentType as Database['HR']['Tables']['employees']['Insert']['employment_type'],
      base_salary: Number(employee.baseSalary),
      salary_frequency: employee.salaryFrequency as Database['HR']['Tables']['employees']['Insert']['salary_frequency'],
      allowances: (employee.allowances as Record<string, number>) ?? {},
      deductions: (employee.deductions as Record<string, number>) ?? {},
    };

    const { data, error } = await browserClient().schema(HR_SCHEMA).from('employees').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return mapEmployee(data);
  },

  async getEmployee(id: string) {
    return getEmployee(browserClient(), id);
  },

  async getEmployeesByCompany(companyId: string) {
    return getEmployeesByCompany(browserClient(), companyId);
  },

  async getActiveEmployeesByCompany(companyId: string) {
    const employees = await getEmployeesByCompany(browserClient(), companyId);
    return employees.filter((employee) => employee.status === 'active');
  },

  async updateEmployee(id: string, updates: Record<string, unknown>) {
    const payload: Database['HR']['Tables']['employees']['Update'] = {
      first_name: updates.firstName as string | undefined,
      last_name: updates.lastName as string | undefined,
      email: updates.email as string | undefined,
      phone_number: updates.phoneNumber as string | undefined,
      id_number: updates.idNumber as string | undefined,
      tax_pin: updates.taxPin as string | undefined,
      account_number: updates.accountNumber as string | undefined,
      bank_code: updates.bankCode as string | undefined,
      bank_name: updates.bankName as string | undefined,
      department: updates.department as string | undefined,
      position: updates.position as string | undefined,
      status: updates.status as Database['HR']['Tables']['employees']['Update']['status'],
      employment_type: updates.employmentType as Database['HR']['Tables']['employees']['Update']['employment_type'],
      base_salary: updates.baseSalary ? Number(updates.baseSalary) : undefined,
      allowances: updates.allowances as Database['HR']['Tables']['employees']['Update']['allowances'],
      deductions: updates.deductions as Database['HR']['Tables']['employees']['Update']['deductions'],
      updated_at: nowIso(),
    };

    const { data, error } = await browserClient()
      .schema(HR_SCHEMA)
      .from('employees')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapEmployee(data);
  },

  async getPayroll(id: string) {
    return getPayroll(browserClient(), id);
  },

  async createPayroll(payroll: Database['HR']['Tables']['payroll_runs']['Insert']) {
    const { data, error } = await browserClient().schema(HR_SCHEMA).from('payroll_runs').insert(payroll).select('*').single();
    if (error) throw new Error(error.message);
    return mapPayroll(data);
  },

  async getPayrollsByCompany(companyId: string) {
    return getPayrollsByCompany(browserClient(), companyId);
  },

  async getAuditLogsByEntity(companyId: string, entityType: string, entityId: string) {
    return getAuditLogsByEntity(browserClient(), companyId, entityType, entityId);
  },

  async getPayrollByMonth(companyId: string, month: string) {
    return getPayrollByMonth(browserClient(), companyId, month);
  },

  async updatePayroll(id: string, updates: Database['HR']['Tables']['payroll_runs']['Update']) {
    const { data, error } = await browserClient()
      .schema(HR_SCHEMA)
      .from('payroll_runs')
      .update({ ...updates, updated_at: nowIso() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapPayroll(data);
  },

  async createPayrollDetail(detail: Database['HR']['Tables']['payroll_details']['Insert']) {
    const { data, error } = await browserClient().schema(HR_SCHEMA).from('payroll_details').insert(detail).select('*').single();
    if (error) throw new Error(error.message);
    return mapPayrollDetail(data);
  },

  async getPayrollDetail(id: string) {
    return getPayrollDetail(browserClient(), id);
  },

  async getPayrollDetailsByPayroll(payrollId: string) {
    return getPayrollDetailsByPayroll(browserClient(), payrollId);
  },

  async createLeaveRequest(payload: Database['HR']['Tables']['leave_requests']['Insert']) {
    const { data, error } = await browserClient().schema(HR_SCHEMA).from('leave_requests').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return mapLeaveRequest(data);
  },

  async updateLeaveRequest(id: string, updates: Database['HR']['Tables']['leave_requests']['Update']) {
    const { data, error } = await browserClient()
      .schema(HR_SCHEMA)
      .from('leave_requests')
      .update({ ...updates, updated_at: nowIso() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapLeaveRequest(data);
  },

  async getLeaveRequestsByCompany(companyId: string) {
    return getLeaveRequestsByCompany(browserClient(), companyId);
  },

  async createComplianceRecord(payload: Database['HR']['Tables']['compliance_records']['Insert']) {
    const { data, error } = await browserClient().schema(HR_SCHEMA).from('compliance_records').insert(payload).select('*').single();
    if (error) throw new Error(error.message);
    return mapComplianceRecord(data);
  },

  async updateComplianceRecord(id: string, updates: Database['HR']['Tables']['compliance_records']['Update']) {
    const { data, error } = await browserClient()
      .schema(HR_SCHEMA)
      .from('compliance_records')
      .update({ ...updates, updated_at: nowIso() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapComplianceRecord(data);
  },

  async getComplianceRecordsByCompany(companyId: string) {
    return getComplianceRecordsByCompany(browserClient(), companyId);
  },

  async getAllCompanies() {
    const { data, error } = await browserClient().schema(HR_SCHEMA).from('companies').select('*').order('created_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapCompany);
  },
};
