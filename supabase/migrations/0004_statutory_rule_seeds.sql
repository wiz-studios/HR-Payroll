insert into payroll.statutory_rule_sets (
  company_id,
  country_code,
  rule_type,
  name,
  version,
  effective_from,
  config,
  is_active
)
values
(
  null,
  'KE',
  'paye',
  'Kenya resident PAYE bands',
  '2026.03',
  '2026-03-01',
  '{
    "payeBrackets": [
      { "min": 0, "max": 24000, "rate": 0.10 },
      { "min": 24000, "max": 32333, "rate": 0.25 },
      { "min": 32333, "max": 500000, "rate": 0.30 },
      { "min": 500000, "max": 800000, "rate": 0.325 },
      { "min": 800000, "max": 999999999, "rate": 0.35 }
    ]
  }'::jsonb,
  true
),
(
  null,
  'KE',
  'nssf',
  'Kenya NSSF Year 4 contributions',
  '2026.02',
  '2026-02-01',
  '{
    "lowerLimit": 9000,
    "upperLimit": 108000,
    "employeeRate": 0.06,
    "employerRate": 0.06
  }'::jsonb,
  true
),
(
  null,
  'KE',
  'shif',
  'Kenya SHIF employee contribution',
  '2026.03',
  '2026-03-01',
  '{
    "rate": 0.0275,
    "minimumContribution": 300
  }'::jsonb,
  true
),
(
  null,
  'KE',
  'housing_levy',
  'Kenya affordable housing levy',
  '2026.03',
  '2026-03-01',
  '{
    "employeeRate": 0.015,
    "employerRate": 0.015
  }'::jsonb,
  true
),
(
  null,
  'KE',
  'relief',
  'Kenya payroll reliefs',
  '2026.03',
  '2026-03-01',
  '{
    "personalRelief": 2400,
    "insuranceReliefRate": 0.15,
    "insuranceReliefMaxAnnual": 60000,
    "deductNssfFromTaxableIncome": true,
    "deductHealthFundFromTaxableIncome": true,
    "deductHousingLevyFromTaxableIncome": true
  }'::jsonb,
  true
)
on conflict (company_id, rule_type, version, effective_from) do update
set
  name = excluded.name,
  config = excluded.config,
  is_active = excluded.is_active;
