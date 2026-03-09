import { describe, expect, it } from 'vitest';
import {
  calculateHealthFund,
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
    deductions: { loan: 3000, insurancePremiums: 4000 },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('payroll-calculator', () => {
  it('calculates current statutory deductions and employer cost', () => {
    const result = calculatePayroll({
      employee: createEmployee(),
    });

    expect(result.basicSalary).toBe(100000);
    expect(result.allowances.total).toBe(25000);
    expect(result.grossSalary).toBe(125000);
    expect(result.deductions.employeeStatutory.nssf).toBe(6480);
    expect(result.deductions.employeeStatutory.healthFund).toBe(3437.5);
    expect(result.deductions.employeeStatutory.housingLevy).toBe(1875);
    expect(result.taxableIncome).toBe(113207.5);
    expect(result.deductions.employeeStatutory.incomeTax).toBe(25745.6);
    expect(result.deductions.other.total).toBe(4875);
    expect(result.deductions.total).toBe(40538.1);
    expect(result.netPay).toBe(84461.9);
    expect(result.deductions.employerStatutory.nssf).toBe(6480);
    expect(result.deductions.employerStatutory.housingLevy).toBe(1875);
    expect(result.employerCost).toBe(133355);
    expect(result.validationErrors).toHaveLength(0);
    expect(result.statutoryConfigVersion).toBe(DEFAULT_KENYA_PAYROLL_CONFIG.version);
  });

  it('bases insurance relief on premiums paid and surfaces negative net pay errors', () => {
    const result = calculatePayroll({
      employee: createEmployee({
        deductions: { loan: 120000, insurancePremiums: 20000 },
      }),
    });

    expect(result.insuranceRelief).toBe(3000);
    expect(result.netPay).toBeLessThan(0);
    expect(result.validationErrors[0]?.code).toBe('NEGATIVE_NET_PAY');
  });

  it('uses 2026 PAYE and SHIF defaults on current thresholds', () => {
    expect(calculateIncomeTax(24000)).toBe(2400);
    expect(calculateIncomeTax(32333)).toBe(4483.25);
    expect(calculateHealthFund(8000)).toBe(300);
    expect(calculateNSSF(108000)).toBe(6480);
    expect(DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefRate).toBe(0.15);
  });
});
