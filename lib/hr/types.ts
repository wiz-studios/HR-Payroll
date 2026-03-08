export interface Company {
  id: string;
  name: string;
  registrationNumber: string;
  taxPin: string;
  nssf: string;
  nhif: string;
  address: string;
  phone: string;
  email: string;
  country: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'employee';
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  companyId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  idNumber: string;
  taxPin: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  department: string;
  position: string;
  joiningDate: Date;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  employmentType: 'permanent' | 'contract' | 'casual';
  baseSalary: number;
  salaryFrequency: 'monthly' | 'weekly' | 'daily';
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payroll {
  id: string;
  companyId: string;
  payrollMonth: string;
  payrollCycle: 'monthly' | 'weekly' | 'biweekly';
  status: 'draft' | 'pending_approval' | 'approved' | 'processed' | 'paid';
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  processedAt?: Date;
  processedBy?: string;
  lockedAt?: Date;
  lockedBy?: string;
}

export interface PayrollDetail {
  id: string;
  payrollId: string;
  employeeId: string;
  companyId: string;
  basicSalary: number;
  allowancesTotal: number;
  allowanceBreakdown: Record<string, number>;
  grossPay: number;
  nssfAmount: number;
  nhifAmount: number;
  incomeTaxAmount: number;
  otherDeductionsTotal: number;
  otherDeductionsBreakdown: Record<string, number>;
  totalDeductions: number;
  netPay: number;
  paymentStatus: 'pending' | 'processed' | 'paid' | 'failed';
  paymentMethod: 'bank_transfer' | 'm_pesa' | 'cash';
  paymentDate?: Date;
  mpesaReference?: string;
  bankTransferReference?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceRecord {
  id: string;
  companyId: string;
  recordType: 'kra_filing' | 'nssf_filing' | 'nhif_filing' | 'audit_trail';
  authority: string;
  period: string;
  status: 'pending' | 'submitted' | 'accepted' | 'rejected';
  submissionDate?: Date;
  responseDate?: Date;
  details: Record<string, unknown>;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  companyId: string;
  actorUserId?: string;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: Date;
}
