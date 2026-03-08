# PayrollKE

PayrollKE is a Kenya-focused HR and payroll system built with Next.js 16, React 19, TypeScript, and Supabase. The current production app runs on the legacy `"HR"` schema, while the repo now also includes the first enterprise foundation for `core`, `hr`, `payroll`, and `workflow` domain schemas.

## Current scope

- Employee records and lifecycle management
- Payroll run creation with statutory deductions
- Leave request tracking and approval updates
- Compliance register management
- Company profile and team member administration
- Multi-tenant access control through Supabase Auth and Row Level Security

## Stack

- Next.js 16
- React 19
- Tailwind CSS v4
- Supabase Auth
- Supabase Postgres
- TypeScript

## Supabase setup

1. Create a Supabase project.
2. Add the environment values from [.env.example](/d:/Wiz%20dev/HR-Payroll/.env.example) into your local `.env.local` and your deployment platform.
3. Run the SQL migrations in order:
   `0001_hr_schema.sql`
   `0002_payroll_controls.sql`
   `0003_enterprise_foundation.sql`
4. Confirm the `"HR"`, `core`, `hr`, `payroll`, and `workflow` schemas were created.
5. Add the new domain schemas to Supabase API exposed schemas before using them from application code.
6. Ensure your Supabase Auth project is configured for email/password sign-in.

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Development

```bash
pnpm install
pnpm lint
pnpm build
pnpm dev
```

The app runs on `http://localhost:3000`.

## Data model

Current live app objects remain in the `"HR"` schema:

- `companies`
- `company_users`
- `employees`
- `payroll_runs`
- `payroll_details`
- `leave_requests`
- `compliance_records`
- `audit_logs`

Enterprise foundation schemas added in this pass:

- `core.companies`
- `core.company_memberships`
- `core.branches`
- `core.departments`
- `core.cost_centers`
- `core.payroll_groups`
- `hr.employee_profiles`
- `hr.employment_records`
- `hr.compensation_records`
- `hr.employee_documents`
- `workflow.approval_definitions`
- `workflow.approval_steps`
- `workflow.approval_instances`
- `workflow.approval_actions`
- `payroll.statutory_rule_sets`
- `payroll.pay_runs`
- `payroll.pay_run_items`
- `payroll.pay_run_validations`
- `payroll.payment_batches`
- `payroll.payment_batch_items`

Application-side access is organized through:

- [lib/supabase/client.ts](/d:/Wiz%20dev/HR-Payroll/lib/supabase/client.ts)
- [lib/supabase/server.ts](/d:/Wiz%20dev/HR-Payroll/lib/supabase/server.ts)
- [lib/supabase/admin.ts](/d:/Wiz%20dev/HR-Payroll/lib/supabase/admin.ts)
- [lib/hr/repository.ts](/d:/Wiz%20dev/HR-Payroll/lib/hr/repository.ts)
- [lib/auth.ts](/d:/Wiz%20dev/HR-Payroll/lib/auth.ts)

## Production notes

- No demo bootstrap or hardcoded seed data is used by the application.
- User registration creates both a Supabase Auth user and linked `"HR"` records.
- Payroll status changes and record writes happen server-side through route handlers under [app/api](/d:/Wiz%20dev/HR-Payroll/app/api).
- [proxy.ts](/d:/Wiz%20dev/HR-Payroll/proxy.ts) handles session refresh and route protection.
- The multi-schema enterprise foundation is documented in [docs/ENTERPRISE_ARCHITECTURE.md](/d:/Wiz%20dev/HR-Payroll/docs/ENTERPRISE_ARCHITECTURE.md) and [docs/ENTERPRISE_ROADMAP.md](/d:/Wiz%20dev/HR-Payroll/docs/ENTERPRISE_ROADMAP.md).

## Next priorities

- Add automated tests for payroll calculations and approval flows
- Add payslip PDF generation and export pipelines
- Add stronger audit coverage for approvals and edits
- Validate all Kenyan statutory logic with a payroll/compliance reviewer before live use
