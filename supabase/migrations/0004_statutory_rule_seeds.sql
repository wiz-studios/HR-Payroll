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
  'Kenya PAYE bands',
  '2026.01',
  '2026-01-01',
  '{
    "incomeTaxBrackets": [
      { "min": 0, "max": 24000, "rate": 0.10 },
      { "min": 24001, "max": 48000, "rate": 0.15 },
      { "min": 48001, "max": 100000, "rate": 0.20 },
      { "min": 100001, "max": 150000, "rate": 0.25 },
      { "min": 150001, "max": 999999999, "rate": 0.30 }
    ]
  }'::jsonb,
  true
),
(
  null,
  'KE',
  'nssf',
  'Kenya NSSF employee contribution',
  '2026.01',
  '2026-01-01',
  '{
    "rate": 0.06,
    "min": 100,
    "max": 18000
  }'::jsonb,
  true
),
(
  null,
  'KE',
  'shif',
  'Kenya health contribution brackets',
  '2026.01',
  '2026-01-01',
  '{
    "healthContributionBrackets": [
      { "min": 0, "max": 5999, "rate": 0.025, "fixed": 150 },
      { "min": 6000, "max": 9999, "rate": 0.025, "fixed": 300 },
      { "min": 10000, "max": 14999, "rate": 0.025, "fixed": 400 },
      { "min": 15000, "max": 19999, "rate": 0.025, "fixed": 500 },
      { "min": 20000, "max": 24999, "rate": 0.025, "fixed": 600 },
      { "min": 25000, "max": 29999, "rate": 0.025, "fixed": 750 },
      { "min": 30000, "max": 34999, "rate": 0.025, "fixed": 850 },
      { "min": 35000, "max": 39999, "rate": 0.025, "fixed": 900 },
      { "min": 40000, "max": 44999, "rate": 0.025, "fixed": 950 },
      { "min": 45000, "max": 49999, "rate": 0.025, "fixed": 1000 },
      { "min": 50000, "max": 100000, "rate": 0.025, "fixed": 1700 }
    ]
  }'::jsonb,
  true
),
(
  null,
  'KE',
  'relief',
  'Kenya payroll reliefs',
  '2026.01',
  '2026-01-01',
  '{
    "personalRelief": 2400,
    "insuranceReliefRate": 0.05,
    "insuranceReliefMaxAnnual": 60000
  }'::jsonb,
  true
)
on conflict (company_id, rule_type, version, effective_from) do update
set
  name = excluded.name,
  config = excluded.config,
  is_active = excluded.is_active;
