# PayrollKE System Guide

## Overview

PayrollKE is a multi-tenant HR and payroll application for Kenyan organizations. It is built on Next.js 16 and Supabase. The live app currently uses the `"HR"` schema, while the repo now includes an enterprise foundation across `core`, `hr`, `payroll`, and `workflow`.

## Architecture

### Application layers

- UI routes under [app](/d:/Wiz%20dev/HR-Payroll/app)
- Shared components under [components](/d:/Wiz%20dev/HR-Payroll/components)
- Payroll rules in [lib/payroll-calculator.ts](/d:/Wiz%20dev/HR-Payroll/lib/payroll-calculator.ts)
- Auth and Supabase clients in [lib/auth.ts](/d:/Wiz%20dev/HR-Payroll/lib/auth.ts) and [lib/supabase](/d:/Wiz%20dev/HR-Payroll/lib/supabase)
- Data access helpers in [lib/hr/repository.ts](/d:/Wiz%20dev/HR-Payroll/lib/hr/repository.ts)
- Route handlers in [app/api](/d:/Wiz%20dev/HR-Payroll/app/api)

### Auth model

- Supabase Auth is the identity provider.
- Application roles are stored in `"HR".company_users`.
- Browser session checks are handled through [lib/auth.ts](/d:/Wiz%20dev/HR-Payroll/lib/auth.ts).
- Server-side route protection is enforced through [lib/server/auth.ts](/d:/Wiz%20dev/HR-Payroll/lib/server/auth.ts) and [proxy.ts](/d:/Wiz%20dev/HR-Payroll/proxy.ts).

### Data isolation

- Every business record is scoped to a company.
- The `"HR"` schema includes helper functions for current company and role resolution.
- Row Level Security policies restrict reads and writes to authorized company members.
- Elevated provisioning actions use the Supabase service role from secure server code only.
- The enterprise schemas are introduced in parallel and seeded from `"HR"` so the current app remains stable during the re-architecture.

## Database schema

The migration in [supabase/migrations/0001_hr_schema.sql](/d:/Wiz%20dev/HR-Payroll/supabase/migrations/0001_hr_schema.sql) creates:

- `companies`
- `company_users`
- `employees`
- `payroll_runs`
- `payroll_details`
- `leave_requests`
- `compliance_records`
- `audit_logs`

It also sets up:

- updated-at triggers
- helper SQL functions
- RLS policies
- foreign keys for company and payroll relationships

The new migration in [supabase/migrations/0003_enterprise_foundation.sql](/d:/Wiz%20dev/HR-Payroll/supabase/migrations/0003_enterprise_foundation.sql) adds the first enterprise domain model:

- `core`: companies, memberships, branches, departments, cost centers, payroll groups
- `hr`: employee profiles, employment records, compensation records, documents
- `workflow`: approval definitions, steps, instances, actions
- `payroll`: rule sets, pay runs, pay run items, validations, payment batches

Current `"HR"` data is seeded into the new structures so the future migration path is incremental instead of destructive.

## Core workflows

### Company onboarding

1. A company admin registers through `/register`.
2. [app/api/register-company/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/register-company/route.ts) creates the auth user.
3. The route inserts the company and company-user mapping into the `"HR"` schema.
4. The user signs in and lands in the dashboard with company-scoped access.

### Team management

1. Admins add team members from settings.
2. [app/api/team-members/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/team-members/route.ts) provisions the auth account and role mapping.
3. Password resets flow through [app/api/team-members/[id]/reset-password/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/team-members/[id]/reset-password/route.ts).

### Employee management

1. Employee records are created and updated through `/dashboard/employees`.
2. Writes are handled by [app/api/employees/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/employees/route.ts) and [app/api/employees/[id]/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/employees/[id]/route.ts).

### Payroll processing

1. Payroll runs are created from `/dashboard/payroll`.
2. [app/api/payroll/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/payroll/route.ts) loads active employees and calculates payroll server-side.
3. The route stores both the run and payroll detail rows.
4. Status changes are handled by [app/api/payroll/[id]/status/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/payroll/[id]/status/route.ts).

### Leave and compliance

- Leave requests are managed through [app/api/leave-requests/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/leave-requests/route.ts) and [app/api/leave-requests/[id]/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/leave-requests/[id]/route.ts).
- Compliance records are managed through [app/api/compliance/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/compliance/route.ts) and [app/api/compliance/[id]/route.ts](/d:/Wiz%20dev/HR-Payroll/app/api/compliance/[id]/route.ts).

## Local setup

1. Create `.env.local` from [.env.example](/d:/Wiz%20dev/HR-Payroll/.env.example).
2. Supply your Supabase project URL, anon key, and service role key.
3. Apply [supabase/migrations/0001_hr_schema.sql](/d:/Wiz%20dev/HR-Payroll/supabase/migrations/0001_hr_schema.sql), [supabase/migrations/0002_payroll_controls.sql](/d:/Wiz%20dev/HR-Payroll/supabase/migrations/0002_payroll_controls.sql), and [supabase/migrations/0003_enterprise_foundation.sql](/d:/Wiz%20dev/HR-Payroll/supabase/migrations/0003_enterprise_foundation.sql) in order.
4. Install dependencies with `pnpm install`.
5. Start the app with `pnpm dev`.

## Operational gaps before live payroll

- Move runtime services from `"HR"` to the new multi-schema foundation incrementally.
- Add effective-dated compensation and employment workflows in application code.
- Add workflow-driven approvals and payment reconciliation services.
- Add test coverage for payroll calculations, transitions, and access rules.
- Validate statutory calculations with a qualified Kenya payroll/compliance specialist.
- Add backup, monitoring, and incident logging around the Supabase project.

## Removed from the system

- No in-memory database is used by application flows.
- No demo bootstrap is injected at runtime.
- No hardcoded sample users, sample companies, or localStorage-backed sessions remain in the codepath.
