import type { CompanyRole } from './types';
export type { CompanyRole } from './types';

export type LegacyRole = 'admin' | 'manager' | 'employee';
export type RuntimeRole = CompanyRole | LegacyRole;

const FULL_ADMIN_ROLES: CompanyRole[] = ['platform_admin', 'company_admin'];
const PEOPLE_MANAGER_ROLES: CompanyRole[] = ['platform_admin', 'company_admin', 'hr_manager', 'manager'];
const PAYROLL_OPERATOR_ROLES: CompanyRole[] = ['platform_admin', 'company_admin', 'payroll_manager'];
const FINANCE_REVIEW_ROLES: CompanyRole[] = ['platform_admin', 'company_admin', 'finance_approver'];
const REPORTING_ROLES: CompanyRole[] = [
  'platform_admin',
  'company_admin',
  'hr_manager',
  'payroll_manager',
  'manager',
  'finance_approver',
];

export function isLegacyRole(role: string): role is LegacyRole {
  return role === 'admin' || role === 'manager' || role === 'employee';
}

export function normalizeRole(role: RuntimeRole): CompanyRole {
  if (role === 'admin') return 'company_admin';
  if (role === 'manager') return 'hr_manager';
  return role;
}

export function mapEnterpriseRoleToLegacy(role: RuntimeRole): LegacyRole {
  const normalized = normalizeRole(role);
  if (normalized === 'employee') return 'employee';
  if (normalized === 'hr_manager' || normalized === 'manager') return 'manager';
  return 'admin';
}

export function getRoleDisplayName(role: RuntimeRole) {
  const normalized = normalizeRole(role);
  const labels: Record<CompanyRole, string> = {
    platform_admin: 'Platform Administrator',
    company_admin: 'Company Administrator',
    hr_manager: 'HR Manager',
    payroll_manager: 'Payroll Manager',
    manager: 'Manager',
    employee: 'Employee',
    finance_approver: 'Finance Approver',
  };

  return labels[normalized];
}

export function isEmployeeRole(role: RuntimeRole) {
  return normalizeRole(role) === 'employee';
}

export function canManageCompanySettings(role: RuntimeRole) {
  return FULL_ADMIN_ROLES.includes(normalizeRole(role));
}

export function canManageTeamMembers(role: RuntimeRole) {
  return FULL_ADMIN_ROLES.includes(normalizeRole(role));
}

export function canManageEmployees(role: RuntimeRole) {
  return PEOPLE_MANAGER_ROLES.includes(normalizeRole(role));
}

export function canReviewEmployeeChangeRequests(role: RuntimeRole) {
  return ['platform_admin', 'company_admin', 'hr_manager'].includes(normalizeRole(role));
}

export function canManageDocuments(role: RuntimeRole) {
  return PEOPLE_MANAGER_ROLES.includes(normalizeRole(role));
}

export function canManageStructure(role: RuntimeRole) {
  return PEOPLE_MANAGER_ROLES.includes(normalizeRole(role));
}

export function canAccessApprovalsInbox(role: RuntimeRole) {
  return !isEmployeeRole(role);
}

export function canReviewLeaveApprovals(role: RuntimeRole) {
  return PEOPLE_MANAGER_ROLES.includes(normalizeRole(role));
}

export function canAccessReports(role: RuntimeRole) {
  return REPORTING_ROLES.includes(normalizeRole(role));
}

export function canManageCompliance(role: RuntimeRole) {
  return PEOPLE_MANAGER_ROLES.includes(normalizeRole(role));
}

export function canFinalizeCompliance(role: RuntimeRole) {
  return FULL_ADMIN_ROLES.includes(normalizeRole(role));
}

export function canAccessPayroll(role: RuntimeRole) {
  return [...PAYROLL_OPERATOR_ROLES, 'hr_manager', 'manager', 'finance_approver'].includes(normalizeRole(role));
}

export function canSubmitPayrollForApproval(role: RuntimeRole) {
  return [...PAYROLL_OPERATOR_ROLES, 'hr_manager', 'manager'].includes(normalizeRole(role));
}

export function canReviewPayrollApprovals(role: RuntimeRole) {
  return [...PAYROLL_OPERATOR_ROLES].includes(normalizeRole(role));
}

export function canProcessPayroll(role: RuntimeRole) {
  return PAYROLL_OPERATOR_ROLES.includes(normalizeRole(role));
}

export function canManagePaymentBatches(role: RuntimeRole) {
  return [...PAYROLL_OPERATOR_ROLES, ...FINANCE_REVIEW_ROLES].includes(normalizeRole(role));
}

export function canMarkPayrollPaid(role: RuntimeRole) {
  return [...FULL_ADMIN_ROLES, 'finance_approver'].includes(normalizeRole(role));
}

export function canReadJournalAccounts(role: RuntimeRole) {
  return [...REPORTING_ROLES].includes(normalizeRole(role));
}

export function canUpdateJournalAccounts(role: RuntimeRole) {
  return [...FULL_ADMIN_ROLES, 'finance_approver'].includes(normalizeRole(role));
}
