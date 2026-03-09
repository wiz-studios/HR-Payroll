import { describe, expect, it } from 'vitest';
import { buildPayrollConfigFromRules, pickApplicableRule } from '@/lib/platform/statutory';

const rules = [
  {
    company_id: null,
    rule_type: 'nssf' as const,
    effective_from: '2026-01-01',
    effective_to: null,
    config: { rate: 0.06, min: 100, max: 18000 },
  },
  {
    company_id: null,
    rule_type: 'relief' as const,
    effective_from: '2026-01-01',
    effective_to: null,
    config: { personalRelief: 2400, insuranceReliefRate: 0.05, insuranceReliefMaxAnnual: 60000 },
  },
  {
    company_id: 'company-1',
    rule_type: 'nssf' as const,
    effective_from: '2026-02-01',
    effective_to: null,
    config: { rate: 0.05, min: 50, max: 12000 },
  },
];

describe('statutory config resolution', () => {
  it('prefers company-specific rules over global defaults', () => {
    const selected = pickApplicableRule(rules, 'nssf', 'company-1', '2026-03-01');
    expect(selected?.company_id).toBe('company-1');
    expect(selected?.config?.max).toBe(12000);
  });

  it('builds a merged config with fallback defaults', () => {
    const config = buildPayrollConfigFromRules(rules, 'company-1', '2026-03-01');

    expect(config.nssfRate).toBe(0.05);
    expect(config.nssfMax).toBe(12000);
    expect(config.personalRelief).toBe(2400);
    expect(config.healthContributionBrackets.length).toBeGreaterThan(0);
  });
});
