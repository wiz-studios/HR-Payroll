create table if not exists payroll.journal_account_configs (
  company_id uuid primary key references core.companies(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
