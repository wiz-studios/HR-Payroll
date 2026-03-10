# Users And Roles

## Summary

The system currently has **3 active runtime user roles** in the live application:

- `admin`
- `manager`
- `employee`

The enterprise foundation also defines **7 target company roles** in the new `core.company_memberships` model:

- `platform_admin`
- `company_admin`
- `hr_manager`
- `payroll_manager`
- `manager`
- `employee`
- `finance_approver`

## Current Runtime Roles

These are the roles the current app session and most live route checks enforce today.

### `admin`

Primary system owner inside a company tenant.

Typical capabilities:

- manage company settings
- create and update employees
- access approvals inbox
- approve payroll
- process payroll
- mark payroll as paid
- manage compliance outcomes
- manage documents
- manage company structure
- manage journal account settings

### `manager`

Operational HR or team-management role.

Typical capabilities:

- create and update employees
- access approvals inbox
- submit or review some workflow items
- manage leave approvals
- manage documents
- manage company structure
- create compliance records
- view reports

Current limitations versus `admin`:

- cannot finalize payroll as paid
- cannot perform some final compliance actions
- cannot update company-level admin-only settings

### `employee`

Self-service user with controlled personal access.

Typical capabilities:

- view own profile
- view own payslips
- view own documents
- submit own leave requests
- submit own bank-detail change requests

Current restrictions:

- cannot create or update employee records for others
- cannot access company approvals inbox
- cannot run payroll
- cannot approve or pay payroll
- cannot manage compliance or settings

## Enterprise Target Roles

These roles are already defined in the new enterprise schema and are the target access model as the app moves fully off the legacy role structure.

### `platform_admin`

Cross-tenant platform operator.

Intended use:

- platform-wide administration
- tenant oversight
- platform configuration and support tooling

### `company_admin`

Top-level company administrator.

Intended use:

- full tenant control
- final payroll approvals
- final payment authorization
- governance over settings and structure

### `hr_manager`

HR operations lead.

Intended use:

- workforce administration
- employee lifecycle changes
- leave and HR workflow approvals
- document oversight

### `payroll_manager`

Payroll operations lead.

Intended use:

- payroll preparation
- payroll validation
- payroll review coordination
- disbursement preparation

### `manager`

Line manager or departmental reviewer.

Intended use:

- team approvals
- team leave reviews
- limited workforce visibility

### `employee`

Employee self-service role.

Intended use:

- own records only
- own payslips
- own documents
- own leave and profile requests

### `finance_approver`

Finance-side authorizer.

Intended use:

- disbursement approval
- reconciliation review
- journal and finance control review

## Current Reality Versus Target Model

The app is currently in a transition state:

- the **live session model** still uses `admin`, `manager`, and `employee`
- the **enterprise schema** already supports the richer 7-role model
- some workflows already map legacy roles into enterprise roles during sync

Current legacy-to-enterprise mapping:

- `admin` -> `company_admin`
- `manager` -> `hr_manager`
- `employee` -> `employee`

## Recommended Access Interpretation Today

If you are assigning people right now, use this practical rule:

- use `admin` for payroll owners and company administrators
- use `manager` for HR/operations managers
- use `employee` for self-service users

Do not rely yet on `platform_admin`, `payroll_manager`, or `finance_approver` as fully enforced live session roles until the auth/session model is migrated to the enterprise role system.

## Source Of Truth In Code

Current runtime role model:

- [lib/hr/types.ts](/d:/Wiz%20dev/HR-Payroll/lib/hr/types.ts)
- [lib/auth.ts](/d:/Wiz%20dev/HR-Payroll/lib/auth.ts)

Enterprise target role model:

- [lib/platform/types.ts](/d:/Wiz%20dev/HR-Payroll/lib/platform/types.ts)
- [supabase/migrations/0003_enterprise_foundation.sql](/d:/Wiz%20dev/HR-Payroll/supabase/migrations/0003_enterprise_foundation.sql)

Legacy-to-enterprise sync mapping:

- [lib/platform/sync.ts](/d:/Wiz%20dev/HR-Payroll/lib/platform/sync.ts)
