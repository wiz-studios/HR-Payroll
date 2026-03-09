import { describe, expect, it } from 'vitest';
import {
  calculateIncomeTax,
  calculateNSSF,
  calculatePayroll,
  DEFAULT_KENYA_PAYROLL_CONFIG,
} from '@/lib/payroll-calculator';
import type { Employee } from '@/lib/hr/types';

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    companyId: 'company-1',
    employeeNumber: 'EMP-001',
    firstName: 'Jane',
    lastName: 'Mwangi',
    email: 'jane@example.com',
    phoneNumber: '0711000000',
    idNumber: '12345678',
    taxPin: 'A123456789Z',
    accountNumber: '0011223344',
    bankCode: '01',
    bankName: 'KCB',
    department: 'Finance',
    position: 'Analyst',
    joiningDate: new Date('2026-01-01'),
    status: 'active',
    employmentType: 'permanent',
    baseSalary: 100000,
    salaryFrequency: 'monthly',
    allowances: { housing: 20000, transport: 5000 },
    deductions: { loan: 3000 },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('payroll-calculator', () => {
  it('calculates a full payroll run using statutory config defaults', () => {
    const result = calculatePayroll({
      employee: createEmployee(),
    });

    expect(result.basicSalary).toBe(100000);
    expect(result.allowances.total).toBe(25000);
    expect(result.grossSalary).toBe(125000);
    expect(result.deductions.nssf).toBe(7500);
    expect(result.deductions.nhif).toBe(1700);
    expect(result.taxableIncome).toBe(115800);
    expect(result.deductions.incomeTax).toBe(12950);
    expect(result.deductions.other.total).toBe(3000);
    expect(result.deductions.total).toBe(25150);
    expect(result.netPay).toBe(99850);
  });

  it('accepts statutory overrides without mutating the default config', () => {
    const result = calculatePayroll({
      employee: createEmployee(),
      statutoryConfig: {
        personalRelief: 0,
        insuranceReliefRate: 0,
        insuranceReliefMaxAnnual: 0,
      },
    });

    expect(result.deductions.incomeTax).toBe(20350);
    expect(DEFAULT_KENYA_PAYROLL_CONFIG.personalRelief).toBe(2400);
    expect(DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefRate).toBe(0.05);
  });

  it('handles edge bracket calculations and zero-pay NSSF correctly', () => {
    expect(calculateIncomeTax(24000)).toBe(2400);
    expect(calculateIncomeTax(48000)).toBe(6000);
    expect(calculateNSSF(0)).toBe(0);
  });
});
