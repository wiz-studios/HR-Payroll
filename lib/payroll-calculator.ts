// Kenya Payroll Calculation Engine
// Compliant with KRA, NSSF, NHIF regulations as of 2024

import { Employee, PayrollDetail } from './db-schema';

export interface PayrollTaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface PayrollHealthBracket {
  min: number;
  max: number;
  rate: number;
  fixed: number;
}

export interface PayrollStatutoryConfig {
  personalRelief: number;
  nssfRate: number;
  nssfMin: number;
  nssfMax: number;
  healthContributionBrackets: PayrollHealthBracket[];
  incomeTaxBrackets: PayrollTaxBracket[];
  insuranceReliefRate: number;
  insuranceReliefMaxAnnual: number;
}

// Kenya baseline rates, used as default fallback until a statutory rule set overrides them.
export const DEFAULT_KENYA_PAYROLL_CONFIG: PayrollStatutoryConfig = {
  personalRelief: 2400,
  nssfRate: 0.06,
  nssfMin: 100,
  nssfMax: 18000,
  healthContributionBrackets: [
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
  incomeTaxBrackets: [
    { min: 0, max: 24000, rate: 0.10 },
    { min: 24001, max: 48000, rate: 0.15 },
    { min: 48001, max: 100000, rate: 0.20 },
    { min: 100001, max: 150000, rate: 0.25 },
    { min: 150001, max: Infinity, rate: 0.30 },
  ],
  insuranceReliefRate: 0.05,
  insuranceReliefMaxAnnual: 60000,
};

export function resolvePayrollStatutoryConfig(
  overrides: Partial<PayrollStatutoryConfig> = {}
): PayrollStatutoryConfig {
  return {
    personalRelief: overrides.personalRelief ?? DEFAULT_KENYA_PAYROLL_CONFIG.personalRelief,
    nssfRate: overrides.nssfRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfRate,
    nssfMin: overrides.nssfMin ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfMin,
    nssfMax: overrides.nssfMax ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfMax,
    healthContributionBrackets:
      overrides.healthContributionBrackets ?? DEFAULT_KENYA_PAYROLL_CONFIG.healthContributionBrackets,
    incomeTaxBrackets: overrides.incomeTaxBrackets ?? DEFAULT_KENYA_PAYROLL_CONFIG.incomeTaxBrackets,
    insuranceReliefRate: overrides.insuranceReliefRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefRate,
    insuranceReliefMaxAnnual:
      overrides.insuranceReliefMaxAnnual ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefMaxAnnual,
  };
}

export interface PayrollCalculationInput {
  employee: Employee;
  workingDays?: number; // Days worked in month, for partial salary
  allowanceOverrides?: Record<string, number>;
  deductionOverrides?: Record<string, number>;
  statutoryConfig?: Partial<PayrollStatutoryConfig>;
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
export function calculateNSSF(grossSalary: number, config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG): number {
  if (grossSalary <= 0) return 0;
  const nssfAmount = Math.min(
    grossSalary * config.nssfRate,
    config.nssfMax
  );
  return Math.max(nssfAmount, config.nssfMin);
}

/**
 * Calculate NHIF contribution
 * National Hospital Insurance Fund - varies by salary bracket
 */
export function calculateNHIF(grossSalary: number, config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG): number {
  const bracket = config.healthContributionBrackets.find(
    b => grossSalary >= b.min && grossSalary <= b.max
  );
  
  if (!bracket) {
    // Default to highest bracket if salary exceeds max
    const maxBracket = config.healthContributionBrackets[
      config.healthContributionBrackets.length - 1
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
export function calculateIncomeTax(
  taxableIncome: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
): number {
  let tax = 0;
  
  for (const bracket of config.incomeTaxBrackets) {
    if (taxableIncome <= bracket.min) {
      break;
    }
    
    const bracketFloor = bracket.min === 0 ? 0 : bracket.min - 1;
    const incomeInBracket = Math.min(taxableIncome, bracket.max) - bracketFloor;
    tax += incomeInBracket * bracket.rate;
  }
  
  return Math.max(0, tax);
}

/**
 * Calculate personal relief (monthly)
 * KRA provides personal relief to reduce tax burden
 */
export function getPersonalRelief(config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG): number {
  return config.personalRelief;
}

/**
 * Calculate insurance relief (monthly)
 * Up to 5% of gross salary, capped at Sh 5,000/month
 */
export function calculateInsuranceRelief(
  grossSalary: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
): number {
  const maxMonthly = config.insuranceReliefMaxAnnual / 12;
  return Math.min(
    grossSalary * config.insuranceReliefRate,
    maxMonthly
  );
}

/**
 * Main payroll calculation function
 * Calculates all earnings, deductions, and net pay for an employee
 */
export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const { employee, workingDays = 22, allowanceOverrides = {}, deductionOverrides = {} } = input;
  const config = resolvePayrollStatutoryConfig(input.statutoryConfig);
  
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
  const nssfDeduction = calculateNSSF(grossSalary, config);
  const nhifDeduction = calculateNHIF(grossSalary, config);
  
  // Calculate taxable income
  const taxableIncome = calculateTaxableIncome(grossSalary, nssfDeduction, nhifDeduction);
  
  // Calculate income tax
  const incomeTaxBeforeRelief = calculateIncomeTax(taxableIncome, config);
  const personalRelief = getPersonalRelief(config);
  const insuranceRelief = calculateInsuranceRelief(grossSalary, config);
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
  overrides?: Map<string, { allowances?: Record<string, number>; deductions?: Record<string, number> }>,
  statutoryConfig?: Partial<PayrollStatutoryConfig>
): Map<string, PayrollCalculationResult> {
  const results = new Map<string, PayrollCalculationResult>();
  
  for (const employee of employees) {
    const override = overrides?.get(employee.id);
    const result = calculatePayroll({
      employee,
      allowanceOverrides: override?.allowances,
      deductionOverrides: override?.deductions,
      statutoryConfig,
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
