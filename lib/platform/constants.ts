export const DOMAIN_SCHEMAS = ['core', 'hr', 'payroll', 'workflow'] as const;

export const PAYROLL_WORKFLOW_KEYS = {
  payrollRunApproval: 'payroll_run_approval',
  leaveApproval: 'leave_approval',
  salaryChangeApproval: 'salary_change_approval',
  bankDetailChangeApproval: 'bank_detail_change_approval',
} as const;

export const DEFAULT_PAYROLL_GROUP_CODE = 'DEFAULT-MONTHLY';
