import { describe, expect, it } from 'vitest';
import { buildPayrollConfigFromRules, pickApplicableRule } from '@/lib/platform/statutory';

const rules = [
  {
    company_id: null,
    rule_type: 'nssf' as const,
    version: '2026.02',
    effective_from: '2026-02-01',
    effective_to: null,
    config: { lowerLimit: 9000, upperLimit: 108000, employeeRate: 0.06, employerRate: 0.06 },
  },
  {
    company_id: null,
    rule_type: 'relief' as const,
    version: '2026.03',
    effective_from: '2026-03-01',
    effective_to: null,
    config: {
      personalRelief: 2400,
      insuranceReliefRate: 0.15,
      insuranceReliefMaxAnnual: 60000,
      deductHealthFundFromTaxableIncome: true,
      deductHousingLevyFromTaxableIncome: true,
    },
  },
  {
    company_id: null,
    rule_type: 'housing_levy' as const,
    version: '2026.03',
    effective_from: '2026-03-01',
    effective_to: null,
    config: { employeeRate: 0.015, employerRate: 0.015 },
  },
  {
    company_id: 'company-1',
    rule_type: 'shif' as const,
    version: '2026.03-custom',
    effective_from: '2026-03-01',
    effective_to: null,
    config: { rate: 0.0275, minimumContribution: 500 },
  },
];

describe('statutory config resolution', () => {
  it('prefers company-specific rules over global defaults', () => {
    const selected = pickApplicableRule(rules, 'shif', 'company-1', '2026-03-01');
    expect(selected?.company_id).toBe('company-1');
    expect(selected?.config?.minimumContribution).toBe(500);
  });

  it('builds a merged config with current statutory fields', () => {
    const config = buildPayrollConfigFromRules(rules, 'company-1', '2026-03-01');

    expect(config.nssfLowerLimit).toBe(9000);
    expect(config.nssfUpperLimit).toBe(108000);
    expect(config.healthFundMinimum).toBe(500);
    expect(config.housingLevyEmployeeRate).toBe(0.015);
    expect(config.personalRelief).toBe(2400);
    expect(config.insuranceReliefRate).toBe(0.15);
    expect(config.version).toContain('2026.03');
  });
});
