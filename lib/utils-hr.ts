import crypto from 'crypto';

/**
 * Generate unique IDs for entities
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hash password using basic hashing
 * Note: In production, use bcrypt
 */
export function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + 'salt_key')
    .digest('hex');
}

/**
 * Verify password
 */
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

/**
 * Format currency (KES)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get previous month
 */
export function getPreviousMonth(month?: string): string {
  const target = month ? new Date(month + '-01') : new Date();
  target.setMonth(target.getMonth() - 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get next month
 */
export function getNextMonth(month?: string): string {
  const target = month ? new Date(month + '-01') : new Date();
  target.setMonth(target.getMonth() + 1);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get month name from YYYY-MM format
 */
export function getMonthName(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate Kenyan phone number
 */
export function isValidPhoneNumber(phone: string): boolean {
  // Accept formats: +254xxx, 0xxx, or 254xxx
  const regex = /^(\+?254|0)7[0-9]{8}$/;
  return regex.test(phone.replace(/\s/g, ''));
}

/**
 * Validate KRA Tax PIN (11 digits, format: A123456789N)
 */
export function isValidTaxPin(pin: string): boolean {
  return /^[A-Z]\d{9}[A-Z]$/.test(pin);
}

/**
 * Validate National ID (numeric, 6-8 digits or up to 16 for passport)
 */
export function isValidIdNumber(id: string): boolean {
  const numeric = id.replace(/\D/g, '');
  return numeric.length >= 6 && numeric.length <= 16;
}

/**
 * Validate bank account number (varies by bank, basic check)
 */
export function isValidAccountNumber(account: string): boolean {
  return /^\d{5,20}$/.test(account.replace(/\s/g, ''));
}

/**
 * Generate employee number
 */
export function generateEmployeeNumber(companyId: string, sequence: number): string {
  const prefix = companyId.substring(0, 3).toUpperCase();
  return `${prefix}${String(sequence).padStart(5, '0')}`;
}

/**
 * Parse month from YYYY-MM to readable format
 */
export function parseMonth(monthStr: string): { year: number; month: number } {
  const [year, month] = monthStr.split('-').map(Number);
  return { year, month };
}

/**
 * Get number of days in a month (for proration)
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Calculate working days in a month (excluding weekends)
 * Simple approximation: 22 working days per month
 */
export function getWorkingDaysInMonth(): number {
  return 22; // Standard in Kenya
}

/**
 * Prorate salary for partial month
 */
export function prorateSalary(salary: number, daysWorked: number, totalDaysInMonth: number = 22): number {
  return (salary / totalDaysInMonth) * daysWorked;
}

/**
 * Check if payroll is locked (cannot edit past processed payrolls)
 */
export function isPayrollLocked(status: string): boolean {
  return ['processed', 'paid'].includes(status);
}

/**
 * Check if payroll can be submitted for approval
 */
export function canSubmitPayroll(status: string): boolean {
  return status === 'draft';
}

/**
 * Check if payroll can be approved
 */
export function canApprovePayroll(status: string): boolean {
  return status === 'pending_approval';
}

/**
 * Check if payroll can be processed
 */
export function canProcessPayroll(status: string): boolean {
  return status === 'approved';
}

/**
 * Generate KRA compliance report filename
 */
export function generateKRAReportFilename(year: number, quarter: number): string {
  return `KRA_P9_Q${quarter}_${year}.csv`;
}

/**
 * Generate NSSF compliance report filename
 */
export function generateNSSFReportFilename(month: string): string {
  return `NSSF_${month}.csv`;
}

/**
 * Generate NHIF compliance report filename
 */
export function generateNHIFReportFilename(month: string): string {
  return `NHIF_${month}.csv`;
}

/**
 * Check if user has permission
 */
export function hasPermission(userRole: string, action: string): boolean {
  const permissions: Record<string, string[]> = {
    admin: ['manage_users', 'manage_employees', 'run_payroll', 'approve_payroll', 'view_reports', 'manage_compliance'],
    manager: ['manage_employees', 'run_payroll', 'view_reports'],
    employee: ['view_own_payslip', 'download_payslip'],
  };
  
  return permissions[userRole]?.includes(action) ?? false;
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: string): string {
  const names: Record<string, string> = {
    admin: 'Administrator',
    manager: 'HR Manager',
    employee: 'Employee',
  };
  return names[role] ?? role;
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
  const names: Record<string, string> = {
    active: 'Active',
    inactive: 'Inactive',
    on_leave: 'On Leave',
    terminated: 'Terminated',
    draft: 'Draft',
    pending_approval: 'Pending Approval',
    approved: 'Approved',
    processed: 'Processed',
    paid: 'Paid',
    pending: 'Pending',
    failed: 'Failed',
  };
  return names[status] ?? status;
}

/**
 * Get status color for UI
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    on_leave: 'bg-yellow-100 text-yellow-800',
    terminated: 'bg-red-100 text-red-800',
    draft: 'bg-blue-100 text-blue-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    processed: 'bg-green-100 text-green-800',
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-800';
}

/**
 * Get payment method display name
 */
export function getPaymentMethodName(method: string): string {
  const names: Record<string, string> = {
    bank_transfer: 'Bank Transfer',
    m_pesa: 'M-Pesa',
    cash: 'Cash',
  };
  return names[method] ?? method;
}

/**
 * Validate salary (must be positive)
 */
export function isValidSalary(amount: number): boolean {
  return amount > 0 && isFinite(amount);
}

/**
 * Calculate employer contributions (for company perspective)
 */
export interface EmployerContributions {
  nssf: number; // Employer NSSF contribution (5.5%)
  nhif: number; // Employer NHIF contribution (varies)
  workersCompensation: number; // Workers compensation insurance (varies)
}

export function calculateEmployerContributions(grossSalary: number): EmployerContributions {
  // Kenya employer contribution rates (approximate)
  return {
    nssf: grossSalary * 0.055, // 5.5% employer contribution to NSSF
    nhif: 0, // Employer doesn't contribute to NHIF in Kenya
    workersCompensation: grossSalary * 0.01, // Approx 1% for workers compensation
  };
}
