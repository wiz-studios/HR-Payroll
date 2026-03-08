# PayrollKE Enterprise Roadmap

## Phase 0: Stabilization

- Supabase-backed app
- server-side payroll actions
- audit trail for core payroll actions
- print-safe payslips
- role-aware UI for existing modules

## Phase 1: Domain foundation

- introduce `core`, `hr`, `payroll`, and `workflow` schemas
- seed current company, membership, employee, payroll, and compensation data into domain tables
- define target TypeScript domain model

## Phase 2: Organization and workforce

- branches, departments, cost centers, job grades
- reporting lines
- payroll groups
- effective-dated employment records
- effective-dated compensation records
- employee documents in Supabase Storage

## Phase 3: Workflow engine

- approval definitions
- approval steps and role routing
- approval instances and actions
- support for payroll, leave, onboarding, and bank-detail workflows

## Phase 4: Payroll engine v2

- statutory rule configuration with effective dates
- validation engine
- payroll review and variance checks
- supplementary and off-cycle runs
- final dues and reversals
- payment batches and reconciliation

## Phase 5: ESS and MSS

- employee self-service
- manager approvals and team views
- controlled profile updates
- overtime, claims, and attendance workflows

## Phase 6: Finance and analytics

- GL mapping
- cost center payroll allocation
- accounting exports
- executive and operational reporting marts

## Near-term implementation order

1. Build the multi-schema database foundation
2. Move organization and employee lifecycle data into effective-dated records
3. Introduce workflow definitions and approval instances
4. Rebuild payroll around snapshots, validations, and payment batches
5. Add ESS and MSS on top of the stabilized workflow core
