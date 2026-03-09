create table if not exists hr.employee_user_links (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  employee_id uuid not null references hr.employee_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_via text not null default 'manual' check (linked_via in ('email_match', 'sync', 'manual')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_id, user_id)
);

create unique index if not exists employee_user_links_active_user_idx
  on hr.employee_user_links (company_id, user_id)
  where is_active = true;

create unique index if not exists employee_user_links_active_employee_idx
  on hr.employee_user_links (company_id, employee_id)
  where is_active = true;

insert into hr.employee_user_links (
  company_id,
  employee_id,
  user_id,
  linked_via,
  is_active,
  created_at,
  updated_at
)
select
  ep.company_id,
  ep.id,
  cm.user_id,
  'email_match',
  true,
  now(),
  now()
from hr.employee_profiles ep
join core.company_memberships cm
  on cm.company_id = ep.company_id
 and lower(trim(cm.email)) = lower(trim(ep.work_email))
on conflict (company_id, employee_id, user_id) do update
set
  linked_via = excluded.linked_via,
  is_active = true,
  updated_at = excluded.updated_at;
