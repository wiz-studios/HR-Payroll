alter table "HR".payroll_runs
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by uuid references auth.users(id);

grant all on all tables in schema "HR" to anon, authenticated, service_role;
