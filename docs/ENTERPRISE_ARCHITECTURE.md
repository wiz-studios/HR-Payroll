# PayrollKE Enterprise Architecture

## Positioning

PayrollKE is moving from a single-schema HR/payroll application into a multi-tenant workforce operations platform. The target product is not limited to employee CRUD and payroll runs. It is intended to become an operational backbone for HR, payroll, approvals, compliance, payments, and controlled employee/manager self-service.

## Target domains

- `core`: tenant identity, organization structure, access, branches, departments, cost centers, payroll groups
- `hr`: employee master records, employment history, compensation history, documents, onboarding and lifecycle data
- `payroll`: statutory rule sets, payroll runs, payroll run items, validations, payment batches, reconciliations
- `workflow`: approval definitions, approval instances, approval actions, escalation-ready workflow state
- `reporting`: future reporting views, summary tables, finance-facing exports and analytics marts

## Architectural principles

- Effective-dated records for employment, compensation, and statutory configuration
- Immutable payroll snapshots once a run is locked
- Append-first audit and approval history
- Clear state machines for payroll, leave, and workflow approvals
- Company isolation as a first-class concern
- Service-layer payroll logic in TypeScript rather than buried database triggers
- Versioned compliance rules with effective dates rather than permanently hardcoded formulas

## Subsystems

### Identity and access

- Supabase Auth for authentication
- company memberships and role resolution in `core`
- workflow and payroll authorization resolved from company role plus domain permissions

### Organization model

- companies
- branches
- departments
- cost centers
- payroll groups

### Workforce record

- employee profile
- employment records
- compensation records
- employee documents

### Payroll engine

- statutory rule sets
- payroll input snapshots
- payroll runs
- payroll run item ledger
- run validations
- payment batches and reconciliation

### Workflow engine

- approval definitions
- approval steps
- approval instances
- approval actions

## Migration strategy

The current application still operates from the legacy `"HR"` schema. The enterprise foundation is introduced in parallel so the working system remains stable while the data model is expanded.

### Phase 1

- add `core`, `hr`, `payroll`, and `workflow` schemas
- seed foundational data from `"HR"`
- introduce domain-level TypeScript types and roadmap docs

### Phase 2

- move employee lifecycle operations to `core` and `hr`
- add organization structure screens and services
- introduce payroll groups and effective-dated employment/compensation records

### Phase 3

- migrate payroll runs from `"HR"` to `payroll`
- add rule-set versioning, validation engine, supplementary runs, and payment batches

### Phase 4

- add workflow-driven approvals for payroll, leave, onboarding, bank changes, and compensation changes
- add ESS and MSS portals with restricted edit scopes

## Current live constraints

- The live app still uses `"HR"` as its runtime schema.
- The new domain schemas are foundation tables for the next implementation phase.
- Supabase API exposed schemas will need to include `core`, `hr`, `payroll`, and `workflow` before the application starts querying them.
