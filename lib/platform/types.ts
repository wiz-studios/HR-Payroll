export type CompanyRole =
  | 'platform_admin'
  | 'company_admin'
  | 'hr_manager'
  | 'payroll_manager'
  | 'manager'
  | 'employee'
  | 'finance_approver';

export type PayFrequency = 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'off_cycle';

export type EmploymentType = 'permanent' | 'contract' | 'casual' | 'intern' | 'consultant';

export type PayRunStatus =
  | 'draft'
  | 'validation'
  | 'review'
  | 'pending_approval'
  | 'approved'
  | 'locked'
  | 'processed'
  | 'paid'
  | 'reversed';

export interface CoreCompany {
  id: string;
  legalName: string;
  displayName: string;
  registrationNumber: string;
  taxPin: string;
  defaultCurrency: string;
  countryCode: string;
}

export interface Branch {
  id: string;
  companyId: string;
  branchCode: string;
  name: string;
  location: string | null;
}

export interface Department {
  id: string;
  companyId: string;
  departmentCode: string;
  name: string;
  parentDepartmentId?: string;
  branchId?: string;
}

export interface CostCenter {
  id: string;
  companyId: string;
  costCenterCode: string;
  name: string;
  departmentId?: string;
  branchId?: string;
}

export interface PayrollGroup {
  id: string;
  companyId: string;
  groupCode: string;
  name: string;
  payFrequency: PayFrequency;
  isDefault: boolean;
}

export interface EmployeeProfile {
  id: string;
  companyId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phoneNumber: string;
  idNumber: string;
  taxPin: string;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
}

export interface EmploymentRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employmentType: EmploymentType;
  jobTitle: string;
  departmentId?: string;
  costCenterId?: string;
  payrollGroupId?: string;
  managerEmployeeId?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isCurrent: boolean;
}

export interface CompensationRecord {
  id: string;
  companyId: string;
  employeeId: string;
  payFrequency: PayFrequency;
  baseSalary: number;
  allowances: Record<string, number>;
  recurringDeductions: Record<string, number>;
  effectiveFrom: string;
  effectiveTo?: string;
  isCurrent: boolean;
}

export interface ApprovalDefinition {
  id: string;
  companyId: string;
  workflowKey: string;
  entityType: string;
  triggerEvent: string;
  version: number;
  isActive: boolean;
}

export interface ApprovalInstance {
  id: string;
  companyId: string;
  definitionId: string;
  entityType: string;
  entityId: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  currentStepOrder: number;
}

export interface StatutoryRuleSet {
  id: string;
  companyId?: string;
  countryCode: string;
  ruleType: 'paye' | 'nssf' | 'shif' | 'housing_levy' | 'relief' | 'benefit_tax';
  name: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  isActive: boolean;
}

export interface PayRun {
  id: string;
  companyId: string;
  payrollGroupId?: string;
  payPeriodLabel: string;
  payFrequency: PayFrequency;
  status: PayRunStatus;
}
