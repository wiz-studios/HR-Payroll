// Multi-tenant Database Schema for Kenya HR + Payroll System
// All data is isolated by company_id to support multiple companies

export interface Company {
  id: string;
  name: string;
  registrationNumber: string; // KRA registration number
  taxPin: string; // Tax PIN
  nssf: string; // NSSF employer registration
  nhif: string; // NHIF employer registration
  address: string;
  phone: string;
  email: string;
  country: string; // 'Kenya'
  currency: string; // 'KES'
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
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
  idNumber: string; // National ID or Passport
  taxPin: string; // Individual tax PIN
  accountNumber: string; // Bank account
  bankCode: string; // Bank code for M-Pesa routing
  bankName: string;
  department: string;
  position: string;
  joiningDate: Date;
  status: 'active' | 'inactive' | 'on_leave' | 'terminated';
  employmentType: 'permanent' | 'contract' | 'casual';
  baseSalary: number; // In KES
  salaryFrequency: 'monthly' | 'weekly' | 'daily';
  allowances: {
    housing?: number;
    transport?: number;
    medical?: number;
    meal?: number;
    other?: Record<string, number>;
  };
  deductions: {
    nssf?: number;
    nhif?: number;
    unionFees?: number;
    loans?: number;
    other?: Record<string, number>;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Payroll {
  id: string;
  companyId: string;
  payrollMonth: string; // YYYY-MM format
  payrollCycle: 'monthly' | 'weekly' | 'biweekly';
  status: 'draft' | 'pending_approval' | 'approved' | 'processed' | 'paid';
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string; // User ID
  processedAt?: Date;
  processedBy?: string; // User ID
}

export interface PayrollDetail {
  id: string;
  payrollId: string;
  employeeId: string;
  companyId: string;
  
  // Earnings
  basicSalary: number;
  allowancesTotal: number;
  allowanceBreakdown: Record<string, number>;
  grossPay: number;
  
  // Deductions
  nssfAmount: number;
  nhifAmount: number;
  incomeTaxAmount: number;
  otherDeductionsTotal: number;
  otherDeductionsBreakdown: Record<string, number>;
  totalDeductions: number;
  
  // Net
  netPay: number;
  
  // Status
  paymentStatus: 'pending' | 'processed' | 'paid' | 'failed';
  paymentMethod: 'bank_transfer' | 'm_pesa' | 'cash';
  paymentDate?: Date;
  mpesaReference?: string;
  bankTransferReference?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface TaxBracket {
  id: string;
  companyId: string;
  year: number;
  taxYear: string; // e.g., "2024/2025"
  brackets: {
    min: number;
    max: number;
    rate: number;
    reliefAmount?: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceRecord {
  id: string;
  companyId: string;
  recordType: 'kra_filing' | 'nssf_filing' | 'nhif_filing' | 'audit_trail';
  period: string; // YYYY-MM or YYYY-Q#
  status: 'pending' | 'submitted' | 'accepted' | 'rejected';
  submissionDate?: Date;
  responseDate?: Date;
  details: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  companyId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  timestamp: Date;
}

// In-memory database for MVP
export class InMemoryDatabase {
  private companies: Map<string, Company> = new Map();
  private users: Map<string, User> = new Map();
  private employees: Map<string, Employee> = new Map();
  private payrolls: Map<string, Payroll> = new Map();
  private payrollDetails: Map<string, PayrollDetail> = new Map();
  private taxBrackets: Map<string, TaxBracket> = new Map();
  private complianceRecords: Map<string, ComplianceRecord> = new Map();
  private auditLogs: Map<string, AuditLog> = new Map();

  // Company operations
  createCompany(company: Company): Company {
    this.companies.set(company.id, company);
    return company;
  }

  getCompany(id: string): Company | undefined {
    return this.companies.get(id);
  }

  getAllCompanies(): Company[] {
    return Array.from(this.companies.values());
  }

  updateCompany(id: string, updates: Partial<Company>): Company | undefined {
    const company = this.companies.get(id);
    if (!company) return undefined;
    const updated = { ...company, ...updates, updatedAt: new Date() };
    this.companies.set(id, updated);
    return updated;
  }

  // User operations
  createUser(user: User): User {
    this.users.set(user.id, user);
    return user;
  }

  getUserByEmail(email: string): User | undefined {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  getUsersByCompany(companyId: string): User[] {
    return Array.from(this.users.values()).filter(u => u.companyId === companyId);
  }

  updateUser(id: string, updates: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) return undefined;
    const updated = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  // Employee operations
  createEmployee(employee: Employee): Employee {
    this.employees.set(employee.id, employee);
    return employee;
  }

  getEmployee(id: string): Employee | undefined {
    return this.employees.get(id);
  }

  getEmployeesByCompany(companyId: string): Employee[] {
    return Array.from(this.employees.values()).filter(e => e.companyId === companyId);
  }

  getActiveEmployeesByCompany(companyId: string): Employee[] {
    return this.getEmployeesByCompany(companyId).filter(e => e.status === 'active');
  }

  updateEmployee(id: string, updates: Partial<Employee>): Employee | undefined {
    const employee = this.employees.get(id);
    if (!employee) return undefined;
    const updated = { ...employee, ...updates, updatedAt: new Date() };
    this.employees.set(id, updated);
    return updated;
  }

  // Payroll operations
  createPayroll(payroll: Payroll): Payroll {
    this.payrolls.set(payroll.id, payroll);
    return payroll;
  }

  getPayroll(id: string): Payroll | undefined {
    return this.payrolls.get(id);
  }

  getPayrollsByCompany(companyId: string): Payroll[] {
    return Array.from(this.payrolls.values()).filter(p => p.companyId === companyId);
  }

  getPayrollByMonth(companyId: string, month: string): Payroll | undefined {
    return Array.from(this.payrolls.values()).find(
      p => p.companyId === companyId && p.payrollMonth === month
    );
  }

  updatePayroll(id: string, updates: Partial<Payroll>): Payroll | undefined {
    const payroll = this.payrolls.get(id);
    if (!payroll) return undefined;
    const updated = { ...payroll, ...updates, updatedAt: new Date() };
    this.payrolls.set(id, updated);
    return updated;
  }

  // Payroll Detail operations
  createPayrollDetail(detail: PayrollDetail): PayrollDetail {
    this.payrollDetails.set(detail.id, detail);
    return detail;
  }

  getPayrollDetail(id: string): PayrollDetail | undefined {
    return this.payrollDetails.get(id);
  }

  getPayrollDetailsByPayroll(payrollId: string): PayrollDetail[] {
    return Array.from(this.payrollDetails.values()).filter(d => d.payrollId === payrollId);
  }

  getPayrollDetailByEmployeeAndPayroll(employeeId: string, payrollId: string): PayrollDetail | undefined {
    return Array.from(this.payrollDetails.values()).find(
      d => d.employeeId === employeeId && d.payrollId === payrollId
    );
  }

  updatePayrollDetail(id: string, updates: Partial<PayrollDetail>): PayrollDetail | undefined {
    const detail = this.payrollDetails.get(id);
    if (!detail) return undefined;
    const updated = { ...detail, ...updates, updatedAt: new Date() };
    this.payrollDetails.set(id, updated);
    return updated;
  }

  // Tax Bracket operations
  createTaxBracket(bracket: TaxBracket): TaxBracket {
    this.taxBrackets.set(bracket.id, bracket);
    return bracket;
  }

  getTaxBracketByYear(companyId: string, year: number): TaxBracket | undefined {
    return Array.from(this.taxBrackets.values()).find(
      t => t.companyId === companyId && t.year === year
    );
  }

  // Compliance Record operations
  createComplianceRecord(record: ComplianceRecord): ComplianceRecord {
    this.complianceRecords.set(record.id, record);
    return record;
  }

  getComplianceRecordsByCompany(companyId: string): ComplianceRecord[] {
    return Array.from(this.complianceRecords.values()).filter(r => r.companyId === companyId);
  }

  // Audit Log operations
  logAudit(log: AuditLog): AuditLog {
    this.auditLogs.set(log.id, log);
    return log;
  }

  getAuditLogsByCompany(companyId: string): AuditLog[] {
    return Array.from(this.auditLogs.values()).filter(l => l.companyId === companyId);
  }

  // Data export for testing
  export() {
    return {
      companies: Array.from(this.companies.values()),
      users: Array.from(this.users.values()),
      employees: Array.from(this.employees.values()),
      payrolls: Array.from(this.payrolls.values()),
      payrollDetails: Array.from(this.payrollDetails.values()),
      taxBrackets: Array.from(this.taxBrackets.values()),
      complianceRecords: Array.from(this.complianceRecords.values()),
      auditLogs: Array.from(this.auditLogs.values()),
    };
  }
}

// Global database instance
export const db = new InMemoryDatabase();
