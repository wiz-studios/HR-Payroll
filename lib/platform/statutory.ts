import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_KENYA_PAYROLL_CONFIG,
  PayrollHealthBracket,
  PayrollStatutoryConfig,
  PayrollTaxBracket,
  resolvePayrollStatutoryConfig,
} from '@/lib/payroll-calculator';

type UntypedClient = SupabaseClient<any, any, any>;
type RuleType = 'paye' | 'nssf' | 'shif' | 'housing_levy' | 'relief' | 'benefit_tax';

interface StatutoryRuleRow {
  company_id: string | null;
  rule_type: RuleType;
  effective_from: string;
  effective_to: string | null;
  config: Record<string, unknown> | null;
}

function isRuleEffective(row: StatutoryRuleRow, effectiveDate: string) {
  return row.effective_from <= effectiveDate && (!row.effective_to || row.effective_to >= effectiveDate);
}

export function pickApplicableRule(
  rules: StatutoryRuleRow[],
  ruleType: RuleType,
  companyId: string,
  effectiveDate: string
) {
  return rules
    .filter((rule) => rule.rule_type === ruleType)
    .filter((rule) => isRuleEffective(rule, effectiveDate))
    .sort((left, right) => {
      const companyPreference = Number(right.company_id === companyId) - Number(left.company_id === companyId);
      if (companyPreference !== 0) return companyPreference;
      return String(right.effective_from).localeCompare(String(left.effective_from));
    })[0] ?? null;
}

export function buildPayrollConfigFromRules(
  rules: StatutoryRuleRow[],
  companyId: string,
  effectiveDate: string
): PayrollStatutoryConfig {
  const payeRule = pickApplicableRule(rules, 'paye', companyId, effectiveDate);
  const nssfRule = pickApplicableRule(rules, 'nssf', companyId, effectiveDate);
  const healthRule = pickApplicableRule(rules, 'shif', companyId, effectiveDate);
  const reliefRule = pickApplicableRule(rules, 'relief', companyId, effectiveDate);

  return resolvePayrollStatutoryConfig({
    incomeTaxBrackets:
      (payeRule?.config?.incomeTaxBrackets as PayrollTaxBracket[] | undefined) ??
      DEFAULT_KENYA_PAYROLL_CONFIG.incomeTaxBrackets,
    nssfRate: Number(nssfRule?.config?.rate ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfRate),
    nssfMin: Number(nssfRule?.config?.min ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfMin),
    nssfMax: Number(nssfRule?.config?.max ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfMax),
    healthContributionBrackets:
      (healthRule?.config?.healthContributionBrackets as PayrollHealthBracket[] | undefined) ??
      DEFAULT_KENYA_PAYROLL_CONFIG.healthContributionBrackets,
    personalRelief: Number(reliefRule?.config?.personalRelief ?? DEFAULT_KENYA_PAYROLL_CONFIG.personalRelief),
    insuranceReliefRate: Number(
      reliefRule?.config?.insuranceReliefRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefRate
    ),
    insuranceReliefMaxAnnual: Number(
      reliefRule?.config?.insuranceReliefMaxAnnual ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefMaxAnnual
    ),
  });
}

export async function loadPayrollStatutoryConfig(
  client: UntypedClient,
  companyId: string,
  payrollMonth: string
) {
  const effectiveDate = `${payrollMonth}-01`;
  const [companyRulesResult, globalRulesResult] = await Promise.all([
    client
      .schema('payroll')
      .from('statutory_rule_sets')
      .select('company_id,rule_type,effective_from,effective_to,config')
      .eq('company_id', companyId)
      .eq('is_active', true),
    client
      .schema('payroll')
      .from('statutory_rule_sets')
      .select('company_id,rule_type,effective_from,effective_to,config')
      .is('company_id', null)
      .eq('is_active', true),
  ]);

  if (companyRulesResult.error) throw new Error(companyRulesResult.error.message);
  if (globalRulesResult.error) throw new Error(globalRulesResult.error.message);

  return buildPayrollConfigFromRules(
    [...(companyRulesResult.data ?? []), ...(globalRulesResult.data ?? [])] as StatutoryRuleRow[],
    companyId,
    effectiveDate
  );
}
