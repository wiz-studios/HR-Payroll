// Kenya Payroll Calculation Engine
// Compliant with KRA, NSSF, NHIF regulations as of 2024

import { Employee, PayrollDetail } from './db-schema';

// 2024 Kenya Tax Rates and Regulations
export const KENYA_TAX_CONFIG = {
  // Personal Relief (2024)
  PERSONAL_RELIEF: 2400,
  
  // NSSF Contribution Rates (Employee contribution)
  NSSF_RATE: 0.06, // 6% of gross salary
  NSSF_MIN: 100,
  NSSF_MAX: 18000, // Capped at Sh 18,000 per month
  
  // NHIF Contribution Rates (Employee contribution) - 2024 rates
  NHIF_BRACKETS: [
    { min: 0, max: 5999, rate: 0.025, fixed: 150 },
    { min: 6000, max: 9999, rate: 0.025, fixed: 300 },
    { min: 10000, max: 14999, rate: 0.025, fixed: 400 },
    { min: 15000, max: 19999, rate: 0.025, fixed: 500 },
    { min: 20000, max: 24999, rate: 0.025, fixed: 600 },
    { min: 25000, max: 29999, rate: 0.025, fixed: 750 },
    { min: 30000, max: 34999, rate: 0.025, fixed: 850 },
    { min: 35000, max: 39999, rate: 0.025, fixed: 900 },
    { min: 40000, max: 44999, rate: 0.025, fixed: 950 },
    { min: 45000, max: 49999, rate: 0.025, fixed: 1000 },
    { min: 50000, max: 100000, rate: 0.025, fixed: 1700 },
  ],
  
  // Income Tax Brackets 2024 (as per KRA)
  INCOME_TAX_BRACKETS: [
    { min: 0, max: 24000, rate: 0.10 },
    { min: 24001, max: 48000, rate: 0.15 },
    { min: 48001, max: 100000, rate: 0.20 },
    { min: 100001, max: 150000, rate: 0.25 },
    { min: 150001, max: Infinity, rate: 0.30 },
  ],
  
  // Insurance Relief (annual, divide by 12 for monthly)
  INSURANCE_RELIEF_RATE: 0.05, // 5% for insurance premium
  INSURANCE_RELIEF_MAX_ANNUAL: 60000, // Annual cap
};

export interface PayrollCalculationInput {
  employee: Employee;
  workingDays?: number; // Days worked in month, for partial salary
  allowanceOverrides?: Record<string, number>;
  deductionOverrides?: Record<string, number>;
}

export interface PayrollCalculationResult {
  basicSalary: number;
  allowances: {
    total: number;
    breakdown: Record<string, number>;
  };
  grossSalary: number;
  
  deductions: {
    nssf: number;
    nhif: number;
    incomeTax: number;
    other: {
      total: number;
      breakdown: Record<string, number>;
    };
    total: number;
  };
  
  netPay: number;
  
  // Breakdown for reporting
  taxableIncome: number;
  personalRelief: number;
  insuranceRelief: number;
}

/**
 * Calculate NSSF contribution
 * Kenya Social and Economic Council (NSSF) - 6% of gross salary, capped at Sh 18,000
 */
export function calculateNSSF(grossSalary: number): number {
  const nssfAmount = Math.min(
    grossSalary * KENYA_TAX_CONFIG.NSSF_RATE,
    KENYA_TAX_CONFIG.NSSF_MAX
  );
  return Math.max(nssfAmount, KENYA_TAX_CONFIG.NSSF_MIN);
}

/**
 * Calculate NHIF contribution
 * National Hospital Insurance Fund - varies by salary bracket
 */
export function calculateNHIF(grossSalary: number): number {
  const bracket = KENYA_TAX_CONFIG.NHIF_BRACKETS.find(
    b => grossSalary >= b.min && grossSalary <= b.max
  );
  
  if (!bracket) {
    // Default to highest bracket if salary exceeds max
    const maxBracket = KENYA_TAX_CONFIG.NHIF_BRACKETS[
      KENYA_TAX_CONFIG.NHIF_BRACKETS.length - 1
    ];
    return maxBracket.fixed;
  }
  
  return bracket.fixed;
}

/**
 * Calculate taxable income after NSSF and NHIF deductions
 */
export function calculateTaxableIncome(
  grossSalary: number,
  nssfDeduction: number,
  nhifDeduction: number
): number {
  return Math.max(0, grossSalary - nssfDeduction - nhifDeduction);
}

/**
 * Calculate income tax using progressive tax brackets
 */
export function calculateIncomeTax(taxableIncome: number): number {
  let tax = 0;
  
  for (const bracket of KENYA_TAX_CONFIG.INCOME_TAX_BRACKETS) {
    if (taxableIncome <= bracket.min) {
      break;
    }
    
    const incomeInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += incomeInBracket * bracket.rate;
  }
  
  return Math.max(0, tax);
}

/**
 * Calculate personal relief (monthly)
 * KRA provides personal relief to reduce tax burden
 */
export function getPersonalRelief(): number {
  return KENYA_TAX_CONFIG.PERSONAL_RELIEF;
}

/**
 * Calculate insurance relief (monthly)
 * Up to 5% of gross salary, capped at Sh 5,000/month
 */
export function calculateInsuranceRelief(grossSalary: number): number {
  const maxMonthly = KENYA_TAX_CONFIG.INSURANCE_RELIEF_MAX_ANNUAL / 12;
  return Math.min(
    grossSalary * KENYA_TAX_CONFIG.INSURANCE_RELIEF_RATE,
    maxMonthly
  );
}

/**
 * Main payroll calculation function
 * Calculates all earnings, deductions, and net pay for an employee
 */
export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const { employee, workingDays = 22, allowanceOverrides = {}, deductionOverrides = {} } = input;
  
  // Calculate basic salary (prorate if not full month)
  const basicSalary = employee.baseSalary * (workingDays / 22);
  
  // Calculate allowances
  const allowanceBreakdown: Record<string, number> = {};
  let allowanceTotal = 0;
  
  const employeeAllowances = employee.allowances || {};
  for (const [key, value] of Object.entries(employeeAllowances)) {
    const amount = allowanceOverrides[key] ?? (value || 0);
    if (amount > 0) {
      allowanceBreakdown[key] = amount;
      allowanceTotal += amount;
    }
  }
  
  const grossSalary = basicSalary + allowanceTotal;
  
  // Calculate mandatory deductions
  const nssfDeduction = calculateNSSF(grossSalary);
  const nhifDeduction = calculateNHIF(grossSalary);
  
  // Calculate taxable income
  const taxableIncome = calculateTaxableIncome(grossSalary, nssfDeduction, nhifDeduction);
  
  // Calculate income tax
  const incomeTaxBeforeRelief = calculateIncomeTax(taxableIncome);
  const personalRelief = getPersonalRelief();
  const insuranceRelief = calculateInsuranceRelief(grossSalary);
  const incomeTax = Math.max(0, incomeTaxBeforeRelief - personalRelief - insuranceRelief);
  
  // Calculate other deductions (loans, union fees, etc.)
  const employeeDeductions = employee.deductions || {};
  const otherDeductionBreakdown: Record<string, number> = {};
  let otherDeductionTotal = 0;
  
  for (const [key, value] of Object.entries(employeeDeductions)) {
    if (key === 'nssf' || key === 'nhif') continue; // Skip mandatory deductions
    const amount = deductionOverrides[key] ?? (value || 0);
    if (amount > 0) {
      otherDeductionBreakdown[key] = amount;
      otherDeductionTotal += amount;
    }
  }
  
  // Calculate total deductions and net pay
  const totalDeductions = nssfDeduction + nhifDeduction + incomeTax + otherDeductionTotal;
  const netPay = Math.max(0, grossSalary - totalDeductions);
  
  return {
    basicSalary,
    allowances: {
      total: allowanceTotal,
      breakdown: allowanceBreakdown,
    },
    grossSalary,
    
    deductions: {
      nssf: nssfDeduction,
      nhif: nhifDeduction,
      incomeTax,
      other: {
        total: otherDeductionTotal,
        breakdown: otherDeductionBreakdown,
      },
      total: totalDeductions,
    },
    
    netPay,
    
    taxableIncome,
    personalRelief,
    insuranceRelief,
  };
}

/**
 * Calculate payroll for multiple employees (bulk payroll run)
 */
export function calculateBulkPayroll(
  employees: Employee[],
  overrides?: Map<string, { allowances?: Record<string, number>; deductions?: Record<string, number> }>
): Map<string, PayrollCalculationResult> {
  const results = new Map<string, PayrollCalculationResult>();
  
  for (const employee of employees) {
    const override = overrides?.get(employee.id);
    const result = calculatePayroll({
      employee,
      allowanceOverrides: override?.allowances,
      deductionOverrides: override?.deductions,
    });
    results.set(employee.id, result);
  }
  
  return results;
}

/**
 * Generate payroll summary for reporting
 */
export interface PayrollSummary {
  totalEmployees: number;
  totalGrossSalaries: number;
  totalNSSF: number;
  totalNHIF: number;
  totalIncomeTax: number;
  totalDeductions: number;
  totalNetPay: number;
}

export function generatePayrollSummary(
  calculations: Map<string, PayrollCalculationResult>
): PayrollSummary {
  const values = Array.from(calculations.values());
  
  return {
    totalEmployees: values.length,
    totalGrossSalaries: values.reduce((sum, c) => sum + c.grossSalary, 0),
    totalNSSF: values.reduce((sum, c) => sum + c.deductions.nssf, 0),
    totalNHIF: values.reduce((sum, c) => sum + c.deductions.nhif, 0),
    totalIncomeTax: values.reduce((sum, c) => sum + c.deductions.incomeTax, 0),
    totalDeductions: values.reduce((sum, c) => sum + c.deductions.total, 0),
    totalNetPay: values.reduce((sum, c) => sum + c.netPay, 0),
  };
}
