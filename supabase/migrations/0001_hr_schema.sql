create schema if not exists "HR";

create extension if not exists pgcrypto;

grant usage on schema "HR" to anon, authenticated, service_role;
grant all on all tables in schema "HR" to anon, authenticated, service_role;
grant all on all sequences in schema "HR" to anon, authenticated, service_role;
grant execute on all functions in schema "HR" to anon, authenticated, service_role;

alter default privileges in schema "HR" grant all on tables to anon, authenticated, service_role;
alter default privileges in schema "HR" grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema "HR" grant execute on functions to anon, authenticated, service_role;

create table if not exists "HR".companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  registration_number text not null,
  tax_pin text not null,
  nssf_number text not null,
  nhif_number text not null,
  address text not null,
  phone text not null,
  email text not null,
  country text not null default 'Kenya',
  currency text not null default 'KES',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "HR".company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "HR".companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  first_name text not null,
  last_name text not null,
  role text not null check (role in ('admin', 'manager', 'employee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (company_id, email)
);

create table if not exists "HR".employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "HR".companies(id) on delete cascade,
  employee_number text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone_number text not null,
  id_number text not null,
  tax_pin text not null,
  account_number text not null,
  bank_code text not null,
  bank_name text not null,
  department text not null,
  position text not null,
  joining_date date not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'on_leave', 'terminated')),
  employment_type text not null check (employment_type in ('permanent', 'contract', 'casual')),
  base_salary numeric(12,2) not null,
  salary_frequency text not null default 'monthly' check (salary_frequency in ('monthly', 'weekly', 'daily')),
  allowances jsonb not null default '{}'::jsonb,
  deductions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_number)
);

create table if not exists "HR".payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "HR".companies(id) on delete cascade,
  payroll_month text not null,
  payroll_cycle text not null default 'monthly' check (payroll_cycle in ('monthly', 'weekly', 'biweekly')),
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved', 'processed', 'paid')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, payroll_month, payroll_cycle)
);

create table if not exists "HR".payroll_details (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references "HR".payroll_runs(id) on delete cascade,
  employee_id uuid not null references "HR".employees(id) on delete restrict,
  company_id uuid not null references "HR".companies(id) on delete cascade,
  basic_salary numeric(12,2) not null,
  allowances_total numeric(12,2) not null default 0,
  allowance_breakdown jsonb not null default '{}'::jsonb,
  gross_pay numeric(12,2) not null,
  nssf_amount numeric(12,2) not null default 0,
  nhif_amount numeric(12,2) not null default 0,
  income_tax_amount numeric(12,2) not null default 0,
  other_deductions_total numeric(12,2) not null default 0,
  other_deductions_breakdown jsonb not null default '{}'::jsonb,
  total_deductions numeric(12,2) not null,
  net_pay numeric(12,2) not null,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'processed', 'paid', 'failed')),
  payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer', 'm_pesa', 'cash')),
  payment_date timestamptz,
  mpesa_reference text,
  bank_transfer_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payroll_id, employee_id)
);

create table if not exists "HR".leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "HR".companies(id) on delete cascade,
  employee_id uuid not null references "HR".employees(id) on delete restrict,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days integer not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason text not null,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "HR".compliance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "HR".companies(id) on delete cascade,
  record_type text not null check (record_type in ('kra_filing', 'nssf_filing', 'nhif_filing', 'audit_trail')),
  authority text not null,
  period text not null,
  status text not null default 'pending' check (status in ('pending', 'submitted', 'accepted', 'rejected')),
  submission_date timestamptz,
  response_date timestamptz,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists "HR".audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references "HR".companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create or replace function "HR".set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_companies on "HR".companies;
create trigger set_updated_at_companies before update on "HR".companies for each row execute function "HR".set_updated_at();
drop trigger if exists set_updated_at_company_users on "HR".company_users;
create trigger set_updated_at_company_users before update on "HR".company_users for each row execute function "HR".set_updated_at();
drop trigger if exists set_updated_at_employees on "HR".employees;
create trigger set_updated_at_employees before update on "HR".employees for each row execute function "HR".set_updated_at();
drop trigger if exists set_updated_at_payroll_runs on "HR".payroll_runs;
create trigger set_updated_at_payroll_runs before update on "HR".payroll_runs for each row execute function "HR".set_updated_at();
drop trigger if exists set_updated_at_payroll_details on "HR".payroll_details;
create trigger set_updated_at_payroll_details before update on "HR".payroll_details for each row execute function "HR".set_updated_at();
drop trigger if exists set_updated_at_leave_requests on "HR".leave_requests;
create trigger set_updated_at_leave_requests before update on "HR".leave_requests for each row execute function "HR".set_updated_at();
drop trigger if exists set_updated_at_compliance_records on "HR".compliance_records;
create trigger set_updated_at_compliance_records before update on "HR".compliance_records for each row execute function "HR".set_updated_at();

alter table "HR".companies enable row level security;
alter table "HR".company_users enable row level security;
alter table "HR".employees enable row level security;
alter table "HR".payroll_runs enable row level security;
alter table "HR".payroll_details enable row level security;
alter table "HR".leave_requests enable row level security;
alter table "HR".compliance_records enable row level security;
alter table "HR".audit_logs enable row level security;

create or replace function "HR".current_company_id()
returns uuid
language sql
stable
security definer
set search_path = "HR", auth, public
as $$
  select company_id
  from "HR".company_users
  where user_id = auth.uid()
  limit 1
$$;

create or replace function "HR".current_company_role()
returns text
language sql
stable
security definer
set search_path = "HR", auth, public
as $$
  select role
  from "HR".company_users
  where user_id = auth.uid()
  limit 1
$$;

revoke all on function "HR".current_company_id() from public;
revoke all on function "HR".current_company_role() from public;
grant execute on function "HR".current_company_id() to anon, authenticated, service_role;
grant execute on function "HR".current_company_role() to anon, authenticated, service_role;

create policy "company read access" on "HR".companies
for select using (id = "HR".current_company_id());

create policy "company update access" on "HR".companies
for update using (id = "HR".current_company_id() and "HR".current_company_role() = 'admin');

create policy "company user read access" on "HR".company_users
for select using (company_id = "HR".current_company_id());

create policy "employee read access" on "HR".employees
for select using (company_id = "HR".current_company_id());

create policy "employee write access" on "HR".employees
for all using (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
) with check (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
);

create policy "payroll run read access" on "HR".payroll_runs
for select using (company_id = "HR".current_company_id());

create policy "payroll run write access" on "HR".payroll_runs
for all using (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
) with check (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
);

create policy "payroll detail read access" on "HR".payroll_details
for select using (company_id = "HR".current_company_id());

create policy "payroll detail write access" on "HR".payroll_details
for all using (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
) with check (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
);

create policy "leave read access" on "HR".leave_requests
for select using (company_id = "HR".current_company_id());

create policy "leave write access" on "HR".leave_requests
for all using (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
) with check (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
);

create policy "compliance read access" on "HR".compliance_records
for select using (company_id = "HR".current_company_id());

create policy "compliance write access" on "HR".compliance_records
for all using (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
) with check (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
);

create policy "audit read access" on "HR".audit_logs
for select using (
  company_id = "HR".current_company_id()
  and "HR".current_company_role() in ('admin', 'manager')
);
