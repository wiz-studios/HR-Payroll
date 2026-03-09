create extension if not exists pgcrypto;

create schema if not exists core;
create schema if not exists hr;
create schema if not exists payroll;
create schema if not exists workflow;

grant usage on schema core, hr, payroll, workflow to anon, authenticated, service_role;
grant all on all tables in schema core, hr, payroll, workflow to anon, authenticated, service_role;
grant all on all sequences in schema core, hr, payroll, workflow to anon, authenticated, service_role;
grant execute on all functions in schema core, hr, payroll, workflow to anon, authenticated, service_role;

alter default privileges in schema core grant all on tables to anon, authenticated, service_role;
alter default privileges in schema hr grant all on tables to anon, authenticated, service_role;
alter default privileges in schema payroll grant all on tables to anon, authenticated, service_role;
alter default privileges in schema workflow grant all on tables to anon, authenticated, service_role;

alter default privileges in schema core grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema hr grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema payroll grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema workflow grant all on sequences to anon, authenticated, service_role;

create table if not exists core.companies (
  id uuid primary key,
  tenant_code text unique,
  legal_name text not null,
  display_name text not null,
  registration_number text,
  tax_pin text,
  primary_phone text,
  primary_email text,
  default_currency text not null default 'KES',
  country_code text not null default 'KE',
  legacy_hr_company_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists core.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  role text not null check (role in ('platform_admin', 'company_admin', 'hr_manager', 'payroll_manager', 'manager', 'employee', 'finance_approver')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create table if not exists core.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  branch_code text not null,
  name text not null,
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, branch_code)
);

create table if not exists core.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  department_code text not null,
  name text not null,
  parent_department_id uuid references core.departments(id),
  branch_id uuid references core.branches(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, department_code),
  unique (company_id, name)
);

create table if not exists core.cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  cost_center_code text not null,
  name text not null,
  department_id uuid references core.departments(id),
  branch_id uuid references core.branches(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, cost_center_code)
);

create table if not exists core.payroll_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  group_code text not null,
  name text not null,
  pay_frequency text not null check (pay_frequency in ('monthly', 'weekly', 'biweekly', 'daily', 'off_cycle')),
  branch_id uuid references core.branches(id),
  department_id uuid references core.departments(id),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, group_code)
);

create table if not exists hr.employee_profiles (
  id uuid primary key,
  company_id uuid not null references core.companies(id) on delete cascade,
  employee_number text not null,
  first_name text not null,
  last_name text not null,
  work_email text not null,
  personal_email text,
  phone_number text,
  id_number text,
  tax_pin text,
  nssf_number text,
  shif_number text,
  nhif_number text,
  citizenship text,
  emergency_contact jsonb not null default '{}'::jsonb,
  next_of_kin jsonb not null default '{}'::jsonb,
  bank_details jsonb not null default '{}'::jsonb,
  mobile_money_details jsonb not null default '{}'::jsonb,
  status text not null check (status in ('active', 'inactive', 'on_leave', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (company_id, employee_number)
);

create table if not exists hr.employment_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  employee_id uuid not null references hr.employee_profiles(id) on delete cascade,
  branch_id uuid references core.branches(id),
  department_id uuid references core.departments(id),
  cost_center_id uuid references core.cost_centers(id),
  payroll_group_id uuid references core.payroll_groups(id),
  manager_employee_id uuid references hr.employee_profiles(id),
  job_title text not null,
  job_grade text,
  employment_type text not null check (employment_type in ('permanent', 'contract', 'casual', 'intern', 'consultant')),
  work_location text,
  join_date date not null,
  probation_end_date date,
  contract_end_date date,
  effective_from date not null,
  effective_to date,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists hr.compensation_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  employee_id uuid not null references hr.employee_profiles(id) on delete cascade,
  currency text not null default 'KES',
  salary_frequency text not null check (salary_frequency in ('monthly', 'weekly', 'daily')),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'mobile_money', 'cash')),
  base_salary numeric(12,2) not null,
  allowances jsonb not null default '{}'::jsonb,
  recurring_deductions jsonb not null default '{}'::jsonb,
  taxable_benefits jsonb not null default '{}'::jsonb,
  employer_contributions jsonb not null default '{}'::jsonb,
  effective_from date not null,
  effective_to date,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists hr.employee_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  employee_id uuid not null references hr.employee_profiles(id) on delete cascade,
  document_type text not null,
  file_path text not null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists workflow.approval_definitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  workflow_key text not null,
  name text not null,
  entity_type text not null,
  trigger_event text not null,
  conditions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, workflow_key, version)
);

create table if not exists workflow.approval_steps (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references workflow.approval_definitions(id) on delete cascade,
  step_order integer not null,
  approver_role text not null,
  approver_scope text not null default 'company',
  min_approvals integer not null default 1,
  created_at timestamptz not null default now(),
  unique (definition_id, step_order)
);

create table if not exists workflow.approval_instances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  definition_id uuid references workflow.approval_definitions(id),
  entity_type text not null,
  entity_id text not null,
  status text not null check (status in ('draft', 'pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid references auth.users(id),
  current_step_order integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workflow.approval_actions (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references workflow.approval_instances(id) on delete cascade,
  step_id uuid references workflow.approval_steps(id),
  action text not null check (action in ('submitted', 'approved', 'rejected', 'commented', 'delegated')),
  actor_user_id uuid references auth.users(id),
  comments text,
  created_at timestamptz not null default now()
);

create table if not exists payroll.statutory_rule_sets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references core.companies(id) on delete cascade,
  country_code text not null default 'KE',
  rule_type text not null check (rule_type in ('paye', 'nssf', 'shif', 'housing_levy', 'relief', 'benefit_tax')),
  name text not null,
  version text not null,
  effective_from date not null,
  effective_to date,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, rule_type, version, effective_from)
);

create table if not exists payroll.pay_runs (
  id uuid primary key,
  company_id uuid not null references core.companies(id) on delete cascade,
  payroll_group_id uuid references core.payroll_groups(id),
  pay_period_start date,
  pay_period_end date,
  pay_period_label text not null,
  pay_frequency text not null check (pay_frequency in ('monthly', 'weekly', 'biweekly', 'daily', 'off_cycle')),
  status text not null check (status in ('draft', 'validation', 'review', 'pending_approval', 'approved', 'locked', 'processed', 'paid', 'reversed')),
  source_run_id uuid references payroll.pay_runs(id),
  snapshot_version integer not null default 1,
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  locked_at timestamptz,
  locked_by uuid references auth.users(id),
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll.pay_run_items (
  id uuid primary key,
  pay_run_id uuid not null references payroll.pay_runs(id) on delete cascade,
  company_id uuid not null references core.companies(id) on delete cascade,
  employee_id uuid not null references hr.employee_profiles(id),
  compensation_snapshot jsonb not null default '{}'::jsonb,
  earnings jsonb not null default '{}'::jsonb,
  deductions jsonb not null default '{}'::jsonb,
  employer_contributions jsonb not null default '{}'::jsonb,
  gross_pay numeric(12,2) not null,
  taxable_pay numeric(12,2) not null default 0,
  total_deductions numeric(12,2) not null,
  net_pay numeric(12,2) not null,
  payment_status text not null check (payment_status in ('pending', 'processed', 'paid', 'failed', 'reversed')),
  payment_date timestamptz,
  payment_reference text,
  validation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll.pay_run_validations (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references payroll.pay_runs(id) on delete cascade,
  company_id uuid not null references core.companies(id) on delete cascade,
  employee_id uuid references hr.employee_profiles(id),
  severity text not null check (severity in ('info', 'warning', 'error')),
  code text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists payroll.payment_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  pay_run_id uuid not null references payroll.pay_runs(id) on delete cascade,
  batch_type text not null check (batch_type in ('bank_transfer', 'mobile_money', 'mixed', 'manual')),
  status text not null check (status in ('draft', 'exported', 'submitted', 'reconciled', 'failed')),
  file_path text,
  reference text,
  total_amount numeric(12,2) not null default 0,
  total_employees integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payroll.payment_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references payroll.payment_batches(id) on delete cascade,
  pay_run_item_id uuid not null references payroll.pay_run_items(id) on delete cascade,
  employee_id uuid not null references hr.employee_profiles(id),
  amount numeric(12,2) not null,
  destination jsonb not null default '{}'::jsonb,
  status text not null check (status in ('pending', 'submitted', 'paid', 'failed', 'reconciled')),
  provider_reference text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into core.companies (
  id,
  tenant_code,
  legal_name,
  display_name,
  registration_number,
  tax_pin,
  primary_phone,
  primary_email,
  default_currency,
  country_code,
  legacy_hr_company_id,
  created_at,
  updated_at
)
select
  id,
  trim(both '-' from coalesce(nullif(lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')), ''), 'company'))
    || '-' || left(id::text, 8),
  name,
  name,
  registration_number,
  tax_pin,
  phone,
  email,
  currency,
  'KE',
  id,
  created_at,
  updated_at
from "HR".companies
on conflict (id) do update
set
  legal_name = excluded.legal_name,
  display_name = excluded.display_name,
  registration_number = excluded.registration_number,
  tax_pin = excluded.tax_pin,
  primary_phone = excluded.primary_phone,
  primary_email = excluded.primary_email,
  default_currency = excluded.default_currency,
  updated_at = excluded.updated_at;

insert into core.company_memberships (
  company_id,
  user_id,
  email,
  first_name,
  last_name,
  role,
  created_at,
  updated_at
)
select
  company_id,
  user_id,
  email,
  first_name,
  last_name,
  case
    when role = 'admin' then 'company_admin'
    when role = 'manager' then 'hr_manager'
    else 'employee'
  end,
  created_at,
  updated_at
from "HR".company_users
on conflict (company_id, user_id) do update
set
  email = excluded.email,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  role = excluded.role,
  updated_at = excluded.updated_at;

insert into core.payroll_groups (
  company_id,
  group_code,
  name,
  pay_frequency,
  is_default
)
select
  c.id,
  'DEFAULT-MONTHLY',
  c.display_name || ' Monthly Payroll',
  'monthly',
  true
from core.companies c
on conflict (company_id, group_code) do nothing;

insert into core.departments (
  company_id,
  department_code,
  name
)
select
  e.company_id,
  'DEPT-' || lpad((row_number() over (partition by e.company_id order by e.department))::text, 3, '0'),
  e.department
from (
  select distinct company_id, department
  from "HR".employees
) e
on conflict (company_id, name) do nothing;

insert into hr.employee_profiles (
  id,
  company_id,
  employee_number,
  first_name,
  last_name,
  work_email,
  phone_number,
  id_number,
  tax_pin,
  bank_details,
  status,
  created_at,
  updated_at
)
select
  id,
  company_id,
  employee_number,
  first_name,
  last_name,
  email,
  phone_number,
  id_number,
  tax_pin,
  jsonb_build_object(
    'accountNumber', account_number,
    'bankCode', bank_code,
    'bankName', bank_name
  ),
  status,
  created_at,
  updated_at
from "HR".employees
on conflict (id) do update
set
  employee_number = excluded.employee_number,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  work_email = excluded.work_email,
  phone_number = excluded.phone_number,
  id_number = excluded.id_number,
  tax_pin = excluded.tax_pin,
  bank_details = excluded.bank_details,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into hr.employment_records (
  company_id,
  employee_id,
  department_id,
  payroll_group_id,
  job_title,
  employment_type,
  join_date,
  effective_from,
  is_current
)
select
  e.company_id,
  e.id,
  d.id,
  pg.id,
  e.position,
  e.employment_type,
  e.joining_date,
  e.joining_date,
  true
from "HR".employees e
left join core.departments d
  on d.company_id = e.company_id
 and d.name = e.department
left join core.payroll_groups pg
  on pg.company_id = e.company_id
 and pg.group_code = 'DEFAULT-MONTHLY'
where not exists (
  select 1
  from hr.employment_records er
  where er.employee_id = e.id
    and er.is_current = true
);

insert into hr.compensation_records (
  company_id,
  employee_id,
  currency,
  salary_frequency,
  payment_method,
  base_salary,
  allowances,
  recurring_deductions,
  effective_from,
  is_current
)
select
  e.company_id,
  e.id,
  c.default_currency,
  e.salary_frequency,
  'bank_transfer',
  e.base_salary,
  e.allowances,
  e.deductions,
  e.joining_date,
  true
from "HR".employees e
join core.companies c on c.id = e.company_id
where not exists (
  select 1
  from hr.compensation_records cr
  where cr.employee_id = e.id
    and cr.is_current = true
);

insert into payroll.pay_runs (
  id,
  company_id,
  payroll_group_id,
  pay_period_label,
  pay_frequency,
  status,
  approved_at,
  approved_by,
  locked_at,
  locked_by,
  processed_at,
  processed_by,
  created_at,
  updated_at
)
select
  pr.id,
  pr.company_id,
  pg.id,
  pr.payroll_month,
  pr.payroll_cycle,
  case
    when pr.status = 'draft' then 'draft'
    when pr.status = 'pending_approval' then 'pending_approval'
    when pr.status = 'approved' then 'approved'
    when pr.status = 'processed' then 'processed'
    else 'paid'
  end,
  pr.approved_at,
  pr.approved_by,
  pr.locked_at,
  pr.locked_by,
  pr.processed_at,
  pr.processed_by,
  pr.created_at,
  pr.updated_at
from "HR".payroll_runs pr
left join core.payroll_groups pg
  on pg.company_id = pr.company_id
 and pg.group_code = 'DEFAULT-MONTHLY'
on conflict (id) do update
set
  status = excluded.status,
  approved_at = excluded.approved_at,
  approved_by = excluded.approved_by,
  locked_at = excluded.locked_at,
  locked_by = excluded.locked_by,
  processed_at = excluded.processed_at,
  processed_by = excluded.processed_by,
  updated_at = excluded.updated_at;

insert into payroll.pay_run_items (
  id,
  pay_run_id,
  company_id,
  employee_id,
  compensation_snapshot,
  earnings,
  deductions,
  gross_pay,
  taxable_pay,
  total_deductions,
  net_pay,
  payment_status,
  payment_date,
  payment_reference,
  created_at,
  updated_at
)
select
  pd.id,
  pd.payroll_id,
  pd.company_id,
  pd.employee_id,
  jsonb_build_object(
    'basicSalary', pd.basic_salary,
    'allowancesTotal', pd.allowances_total
  ),
  jsonb_build_object(
    'basicSalary', pd.basic_salary,
    'allowances', pd.allowance_breakdown,
    'allowancesTotal', pd.allowances_total
  ),
  jsonb_build_object(
    'nssf', pd.nssf_amount,
    'nhif', pd.nhif_amount,
    'incomeTax', pd.income_tax_amount,
    'other', pd.other_deductions_breakdown,
    'otherTotal', pd.other_deductions_total
  ),
  pd.gross_pay,
  greatest(pd.gross_pay - pd.nssf_amount - pd.nhif_amount, 0),
  pd.total_deductions,
  pd.net_pay,
  pd.payment_status,
  pd.payment_date,
  coalesce(pd.bank_transfer_reference, pd.mpesa_reference),
  pd.created_at,
  pd.updated_at
from "HR".payroll_details pd
on conflict (id) do update
set
  payment_status = excluded.payment_status,
  payment_date = excluded.payment_date,
  payment_reference = excluded.payment_reference,
  updated_at = excluded.updated_at;
