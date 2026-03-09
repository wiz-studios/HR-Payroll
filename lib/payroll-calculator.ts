import type { Employee } from './db-schema';

export interface PayrollTaxBracket {
  min: number;
  max: number;
  rate: number;
}

export interface PayrollStatutoryConfig {
  version: string;
  personalRelief: number;
  payeBrackets: PayrollTaxBracket[];
  nssfLowerLimit: number;
  nssfUpperLimit: number;
  nssfEmployeeRate: number;
  nssfEmployerRate: number;
  healthFundRate: number;
  healthFundMinimum: number;
  housingLevyEmployeeRate: number;
  housingLevyEmployerRate: number;
  insuranceReliefRate: number;
  insuranceReliefMaxAnnual: number;
  deductNssfFromTaxableIncome: boolean;
  deductHealthFundFromTaxableIncome: boolean;
  deductHousingLevyFromTaxableIncome: boolean;
  standardWorkingDays: number;
}

export const DEFAULT_KENYA_PAYROLL_CONFIG: PayrollStatutoryConfig = {
  version: 'KE-2026.03',
  personalRelief: 2400,
  payeBrackets: [
    { min: 0, max: 24000, rate: 0.1 },
    { min: 24000, max: 32333, rate: 0.25 },
    { min: 32333, max: 500000, rate: 0.3 },
    { min: 500000, max: 800000, rate: 0.325 },
    { min: 800000, max: Number.POSITIVE_INFINITY, rate: 0.35 },
  ],
  nssfLowerLimit: 9000,
  nssfUpperLimit: 108000,
  nssfEmployeeRate: 0.06,
  nssfEmployerRate: 0.06,
  healthFundRate: 0.0275,
  healthFundMinimum: 300,
  housingLevyEmployeeRate: 0.015,
  housingLevyEmployerRate: 0.015,
  insuranceReliefRate: 0.15,
  insuranceReliefMaxAnnual: 60000,
  deductNssfFromTaxableIncome: true,
  deductHealthFundFromTaxableIncome: true,
  deductHousingLevyFromTaxableIncome: true,
  standardWorkingDays: 22,
};

const PRE_TAX_DEDUCTION_KEYS = new Set(['pension', 'mortgageInterest', 'postRetirementMedicalFund']);
const RESERVED_DEDUCTION_KEYS = new Set([
  'nssf',
  'nhif',
  'shif',
  'sha',
  'housingLevy',
  'ahl',
  'insurancePremiums',
]);

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function toPositiveNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function stableObject(input: Record<string, number> | undefined) {
  return Object.entries(input ?? {}).reduce<Record<string, number>>((accumulator, [key, value]) => {
    const amount = toPositiveNumber(value);
    if (amount > 0) {
      accumulator[key] = roundCurrency(amount);
    }
    return accumulator;
  }, {});
}

export function resolvePayrollStatutoryConfig(
  overrides: Partial<PayrollStatutoryConfig> = {}
): PayrollStatutoryConfig {
  return {
    version: overrides.version ?? DEFAULT_KENYA_PAYROLL_CONFIG.version,
    personalRelief: overrides.personalRelief ?? DEFAULT_KENYA_PAYROLL_CONFIG.personalRelief,
    payeBrackets: overrides.payeBrackets ?? DEFAULT_KENYA_PAYROLL_CONFIG.payeBrackets,
    nssfLowerLimit: overrides.nssfLowerLimit ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfLowerLimit,
    nssfUpperLimit: overrides.nssfUpperLimit ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfUpperLimit,
    nssfEmployeeRate: overrides.nssfEmployeeRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfEmployeeRate,
    nssfEmployerRate: overrides.nssfEmployerRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfEmployerRate,
    healthFundRate: overrides.healthFundRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.healthFundRate,
    healthFundMinimum: overrides.healthFundMinimum ?? DEFAULT_KENYA_PAYROLL_CONFIG.healthFundMinimum,
    housingLevyEmployeeRate:
      overrides.housingLevyEmployeeRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.housingLevyEmployeeRate,
    housingLevyEmployerRate:
      overrides.housingLevyEmployerRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.housingLevyEmployerRate,
    insuranceReliefRate: overrides.insuranceReliefRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefRate,
    insuranceReliefMaxAnnual:
      overrides.insuranceReliefMaxAnnual ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefMaxAnnual,
    deductNssfFromTaxableIncome:
      overrides.deductNssfFromTaxableIncome ?? DEFAULT_KENYA_PAYROLL_CONFIG.deductNssfFromTaxableIncome,
    deductHealthFundFromTaxableIncome:
      overrides.deductHealthFundFromTaxableIncome ?? DEFAULT_KENYA_PAYROLL_CONFIG.deductHealthFundFromTaxableIncome,
    deductHousingLevyFromTaxableIncome:
      overrides.deductHousingLevyFromTaxableIncome ??
      DEFAULT_KENYA_PAYROLL_CONFIG.deductHousingLevyFromTaxableIncome,
    standardWorkingDays: overrides.standardWorkingDays ?? DEFAULT_KENYA_PAYROLL_CONFIG.standardWorkingDays,
  };
}

export interface PayrollCalculationInput {
  employee: Employee;
  workingDays?: number;
  allowanceOverrides?: Record<string, number>;
  deductionOverrides?: Record<string, number>;
  insurancePremiumsPaid?: number;
  statutoryConfig?: Partial<PayrollStatutoryConfig>;
}

export interface PayrollValidationError {
  code: string;
  message: string;
}

export interface PayrollCalculationResult {
  basicSalary: number;
  allowances: {
    taxableTotal: number;
    nonTaxableTotal: number;
    total: number;
    breakdown: Record<string, number>;
  };
  grossSalary: number;
  deductions: {
    employeeStatutory: {
      nssf: number;
      healthFund: number;
      housingLevy: number;
      incomeTax: number;
      total: number;
    };
    employerStatutory: {
      nssf: number;
      housingLevy: number;
      total: number;
    };
    preTax: {
      total: number;
      breakdown: Record<string, number>;
    };
    postTax: {
      total: number;
      breakdown: Record<string, number>;
    };
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
  employerCost: number;
  taxableIncome: number;
  personalRelief: number;
  insuranceRelief: number;
  statutoryConfigVersion: string;
  validationErrors: PayrollValidationError[];
}

export interface NSSFContributions {
  pensionableEarnings: number;
  employee: number;
  employer: number;
  employeeTierI: number;
  employeeTierII: number;
  employerTierI: number;
  employerTierII: number;
}

export function calculateNSSFContributions(
  grossSalary: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
): NSSFContributions {
  if (grossSalary <= 0) {
    return {
      pensionableEarnings: 0,
      employee: 0,
      employer: 0,
      employeeTierI: 0,
      employeeTierII: 0,
      employerTierI: 0,
      employerTierII: 0,
    };
  }

  const lowerBandEarnings = Math.min(grossSalary, config.nssfLowerLimit);
  const upperBandEarnings = Math.max(0, Math.min(grossSalary, config.nssfUpperLimit) - config.nssfLowerLimit);

  const employeeTierI = roundCurrency(lowerBandEarnings * config.nssfEmployeeRate);
  const employeeTierII = roundCurrency(upperBandEarnings * config.nssfEmployeeRate);
  const employerTierI = roundCurrency(lowerBandEarnings * config.nssfEmployerRate);
  const employerTierII = roundCurrency(upperBandEarnings * config.nssfEmployerRate);

  return {
    pensionableEarnings: roundCurrency(Math.min(grossSalary, config.nssfUpperLimit)),
    employee: roundCurrency(employeeTierI + employeeTierII),
    employer: roundCurrency(employerTierI + employerTierII),
    employeeTierI,
    employeeTierII,
    employerTierI,
    employerTierII,
  };
}

export function calculateNSSF(
  grossSalary: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
): number {
  return calculateNSSFContributions(grossSalary, config).employee;
}

export function calculateHealthFund(
  grossSalary: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
): number {
  if (grossSalary <= 0) return 0;
  return roundCurrency(Math.max(grossSalary * config.healthFundRate, config.healthFundMinimum));
}

export function calculateNHIF(
  grossSalary: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
): number {
  return calculateHealthFund(grossSalary, config);
}

export function calculateHousingLevyEmployee(
  grossSalary: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
) {
  return roundCurrency(Math.max(0, grossSalary) * config.housingLevyEmployeeRate);
}

export function calculateHousingLevyEmployer(
  grossSalary: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
) {
  return roundCurrency(Math.max(0, grossSalary) * config.housingLevyEmployerRate);
}

export function calculateTaxableIncome(
  grossSalary: number,
  deductibleNssf: number,
  deductibleHealthFund: number,
  deductibleHousingLevy = 0,
  preTaxDeductions = 0
) {
  return roundCurrency(
    Math.max(0, grossSalary - deductibleNssf - deductibleHealthFund - deductibleHousingLevy - preTaxDeductions)
  );
}

export function calculateIncomeTax(
  taxableIncome: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
): number {
  let tax = 0;

  for (const bracket of config.payeBrackets) {
    if (taxableIncome <= bracket.min) {
      continue;
    }

    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    if (taxableInBracket <= 0) {
      continue;
    }

    tax += taxableInBracket * bracket.rate;

    if (taxableIncome <= bracket.max) {
      break;
    }
  }

  return roundCurrency(Math.max(0, tax));
}

export function getPersonalRelief(config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG) {
  return config.personalRelief;
}

export function calculateInsuranceRelief(
  premiumsPaid: number,
  config: PayrollStatutoryConfig = DEFAULT_KENYA_PAYROLL_CONFIG
) {
  const maxMonthly = config.insuranceReliefMaxAnnual / 12;
  return roundCurrency(Math.min(toPositiveNumber(premiumsPaid) * config.insuranceReliefRate, maxMonthly));
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const { employee, allowanceOverrides = {}, deductionOverrides = {}, insurancePremiumsPaid = 0 } = input;
  const config = resolvePayrollStatutoryConfig(input.statutoryConfig);
  const workingDays = input.workingDays ?? config.standardWorkingDays;

  const basicSalary = roundCurrency(employee.baseSalary * (workingDays / config.standardWorkingDays));

  const allowanceBreakdown = stableObject({
    ...employee.allowances,
    ...allowanceOverrides,
  });
  const allowanceTotal = roundCurrency(
    Object.values(allowanceBreakdown).reduce((sum, value) => sum + value, 0)
  );
  const grossSalary = roundCurrency(basicSalary + allowanceTotal);

  const mergedDeductions = {
    ...stableObject(employee.deductions),
    ...stableObject(deductionOverrides),
  };

  const preTaxBreakdown = Object.entries(mergedDeductions).reduce<Record<string, number>>((accumulator, [key, value]) => {
    if (PRE_TAX_DEDUCTION_KEYS.has(key)) {
      accumulator[key] = roundCurrency(value);
    }
    return accumulator;
  }, {});
  const preTaxTotal = roundCurrency(Object.values(preTaxBreakdown).reduce((sum, value) => sum + value, 0));

  const insurancePremiums = toPositiveNumber(mergedDeductions.insurancePremiums ?? insurancePremiumsPaid);
  const postTaxBreakdown = Object.entries(mergedDeductions).reduce<Record<string, number>>((accumulator, [key, value]) => {
    if (!PRE_TAX_DEDUCTION_KEYS.has(key) && !RESERVED_DEDUCTION_KEYS.has(key)) {
      accumulator[key] = roundCurrency(value);
    }
    return accumulator;
  }, {});
  const postTaxTotal = roundCurrency(Object.values(postTaxBreakdown).reduce((sum, value) => sum + value, 0));

  const nssf = calculateNSSFContributions(grossSalary, config);
  const healthFund = calculateHealthFund(grossSalary, config);
  const housingLevyEmployee = calculateHousingLevyEmployee(grossSalary, config);
  const housingLevyEmployer = calculateHousingLevyEmployer(grossSalary, config);

  const taxableIncome = calculateTaxableIncome(
    grossSalary,
    config.deductNssfFromTaxableIncome ? nssf.employee : 0,
    config.deductHealthFundFromTaxableIncome ? healthFund : 0,
    config.deductHousingLevyFromTaxableIncome ? housingLevyEmployee : 0,
    preTaxTotal
  );

  const incomeTaxBeforeRelief = calculateIncomeTax(taxableIncome, config);
  const personalRelief = getPersonalRelief(config);
  const insuranceRelief = calculateInsuranceRelief(insurancePremiums, config);
  const incomeTax = roundCurrency(Math.max(0, incomeTaxBeforeRelief - personalRelief - insuranceRelief));

  const employeeStatutoryTotal = roundCurrency(nssf.employee + healthFund + housingLevyEmployee + incomeTax);
  const employerStatutoryTotal = roundCurrency(nssf.employer + housingLevyEmployer);
  const otherBreakdown = {
    ...postTaxBreakdown,
    ...(housingLevyEmployee > 0 ? { housingLevy: housingLevyEmployee } : {}),
    ...preTaxBreakdown,
  };
  const totalDeductions = roundCurrency(preTaxTotal + employeeStatutoryTotal + postTaxTotal);
  const netPay = roundCurrency(grossSalary - totalDeductions);
  const employerCost = roundCurrency(grossSalary + employerStatutoryTotal);

  const validationErrors: PayrollValidationError[] = [];
  if (netPay < 0) {
    validationErrors.push({
      code: 'NEGATIVE_NET_PAY',
      message: `Net pay is negative for ${employee.employeeNumber}. Review post-tax deductions and statutory inputs.`,
    });
  }

  return {
    basicSalary,
    allowances: {
      taxableTotal: allowanceTotal,
      nonTaxableTotal: 0,
      total: allowanceTotal,
      breakdown: allowanceBreakdown,
    },
    grossSalary,
    deductions: {
      employeeStatutory: {
        nssf: nssf.employee,
        healthFund,
        housingLevy: housingLevyEmployee,
        incomeTax,
        total: employeeStatutoryTotal,
      },
      employerStatutory: {
        nssf: nssf.employer,
        housingLevy: housingLevyEmployer,
        total: employerStatutoryTotal,
      },
      preTax: {
        total: preTaxTotal,
        breakdown: preTaxBreakdown,
      },
      postTax: {
        total: postTaxTotal,
        breakdown: postTaxBreakdown,
      },
      nssf: nssf.employee,
      nhif: healthFund,
      incomeTax,
      other: {
        total: roundCurrency(preTaxTotal + postTaxTotal + housingLevyEmployee),
        breakdown: otherBreakdown,
      },
      total: totalDeductions,
    },
    netPay,
    employerCost,
    taxableIncome,
    personalRelief,
    insuranceRelief,
    statutoryConfigVersion: config.version,
    validationErrors,
  };
}

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

export interface PayrollSummary {
  totalEmployees: number;
  totalGrossSalaries: number;
  totalNSSF: number;
  totalNHIF: number;
  totalHealthFund: number;
  totalHousingLevyEmployee: number;
  totalHousingLevyEmployer: number;
  totalIncomeTax: number;
  totalDeductions: number;
  totalNetPay: number;
  totalEmployerCost: number;
  totalValidationErrors: number;
}

export function generatePayrollSummary(
  calculations: Map<string, PayrollCalculationResult>
): PayrollSummary {
  const values = Array.from(calculations.values());

  return {
    totalEmployees: values.length,
    totalGrossSalaries: roundCurrency(values.reduce((sum, calculation) => sum + calculation.grossSalary, 0)),
    totalNSSF: roundCurrency(values.reduce((sum, calculation) => sum + calculation.deductions.employeeStatutory.nssf, 0)),
    totalNHIF: roundCurrency(values.reduce((sum, calculation) => sum + calculation.deductions.employeeStatutory.healthFund, 0)),
    totalHealthFund: roundCurrency(
      values.reduce((sum, calculation) => sum + calculation.deductions.employeeStatutory.healthFund, 0)
    ),
    totalHousingLevyEmployee: roundCurrency(
      values.reduce((sum, calculation) => sum + calculation.deductions.employeeStatutory.housingLevy, 0)
    ),
    totalHousingLevyEmployer: roundCurrency(
      values.reduce((sum, calculation) => sum + calculation.deductions.employerStatutory.housingLevy, 0)
    ),
    totalIncomeTax: roundCurrency(
      values.reduce((sum, calculation) => sum + calculation.deductions.employeeStatutory.incomeTax, 0)
    ),
    totalDeductions: roundCurrency(values.reduce((sum, calculation) => sum + calculation.deductions.total, 0)),
    totalNetPay: roundCurrency(values.reduce((sum, calculation) => sum + calculation.netPay, 0)),
    totalEmployerCost: roundCurrency(values.reduce((sum, calculation) => sum + calculation.employerCost, 0)),
    totalValidationErrors: values.reduce((sum, calculation) => sum + calculation.validationErrors.length, 0),
  };
}
