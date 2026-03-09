import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_KENYA_PAYROLL_CONFIG,
  PayrollStatutoryConfig,
  PayrollTaxBracket,
  resolvePayrollStatutoryConfig,
} from '@/lib/payroll-calculator';

type UntypedClient = SupabaseClient<any, any, any>;
type RuleType = 'paye' | 'nssf' | 'shif' | 'housing_levy' | 'relief' | 'benefit_tax';

interface StatutoryRuleRow {
  company_id: string | null;
  rule_type: RuleType;
  version?: string | null;
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
  return (
    rules
      .filter((rule) => rule.rule_type === ruleType)
      .filter((rule) => isRuleEffective(rule, effectiveDate))
      .sort((left, right) => {
        const companyPreference = Number(right.company_id === companyId) - Number(left.company_id === companyId);
        if (companyPreference !== 0) return companyPreference;
        return String(right.effective_from).localeCompare(String(left.effective_from));
      })[0] ?? null
  );
}

export function buildPayrollConfigFromRules(
  rules: StatutoryRuleRow[],
  companyId: string,
  effectiveDate: string
): PayrollStatutoryConfig {
  const payeRule = pickApplicableRule(rules, 'paye', companyId, effectiveDate);
  const nssfRule = pickApplicableRule(rules, 'nssf', companyId, effectiveDate);
  const healthRule = pickApplicableRule(rules, 'shif', companyId, effectiveDate);
  const housingLevyRule = pickApplicableRule(rules, 'housing_levy', companyId, effectiveDate);
  const reliefRule = pickApplicableRule(rules, 'relief', companyId, effectiveDate);

  return resolvePayrollStatutoryConfig({
    version:
      [payeRule?.version, nssfRule?.version, healthRule?.version, housingLevyRule?.version, reliefRule?.version]
        .filter(Boolean)
        .join('|') || DEFAULT_KENYA_PAYROLL_CONFIG.version,
    payeBrackets:
      (payeRule?.config?.payeBrackets as PayrollTaxBracket[] | undefined) ??
      DEFAULT_KENYA_PAYROLL_CONFIG.payeBrackets,
    nssfLowerLimit: Number(nssfRule?.config?.lowerLimit ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfLowerLimit),
    nssfUpperLimit: Number(nssfRule?.config?.upperLimit ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfUpperLimit),
    nssfEmployeeRate: Number(
      nssfRule?.config?.employeeRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfEmployeeRate
    ),
    nssfEmployerRate: Number(
      nssfRule?.config?.employerRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.nssfEmployerRate
    ),
    healthFundRate: Number(healthRule?.config?.rate ?? DEFAULT_KENYA_PAYROLL_CONFIG.healthFundRate),
    healthFundMinimum: Number(
      healthRule?.config?.minimumContribution ?? DEFAULT_KENYA_PAYROLL_CONFIG.healthFundMinimum
    ),
    housingLevyEmployeeRate: Number(
      housingLevyRule?.config?.employeeRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.housingLevyEmployeeRate
    ),
    housingLevyEmployerRate: Number(
      housingLevyRule?.config?.employerRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.housingLevyEmployerRate
    ),
    personalRelief: Number(reliefRule?.config?.personalRelief ?? DEFAULT_KENYA_PAYROLL_CONFIG.personalRelief),
    insuranceReliefRate: Number(
      reliefRule?.config?.insuranceReliefRate ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefRate
    ),
    insuranceReliefMaxAnnual: Number(
      reliefRule?.config?.insuranceReliefMaxAnnual ?? DEFAULT_KENYA_PAYROLL_CONFIG.insuranceReliefMaxAnnual
    ),
    deductNssfFromTaxableIncome:
      typeof reliefRule?.config?.deductNssfFromTaxableIncome === 'boolean'
        ? Boolean(reliefRule?.config?.deductNssfFromTaxableIncome)
        : DEFAULT_KENYA_PAYROLL_CONFIG.deductNssfFromTaxableIncome,
    deductHealthFundFromTaxableIncome:
      typeof reliefRule?.config?.deductHealthFundFromTaxableIncome === 'boolean'
        ? Boolean(reliefRule?.config?.deductHealthFundFromTaxableIncome)
        : DEFAULT_KENYA_PAYROLL_CONFIG.deductHealthFundFromTaxableIncome,
    deductHousingLevyFromTaxableIncome:
      typeof reliefRule?.config?.deductHousingLevyFromTaxableIncome === 'boolean'
        ? Boolean(reliefRule?.config?.deductHousingLevyFromTaxableIncome)
        : DEFAULT_KENYA_PAYROLL_CONFIG.deductHousingLevyFromTaxableIncome,
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
      .select('company_id,rule_type,version,effective_from,effective_to,config')
      .eq('company_id', companyId)
      .eq('is_active', true),
    client
      .schema('payroll')
      .from('statutory_rule_sets')
      .select('company_id,rule_type,version,effective_from,effective_to,config')
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
