# PayrollKE System Implementation Guide

## Overview

PayrollKE is a production-ready Kenya HR and Payroll Management System built with Next.js 16, React, TypeScript, and Tailwind CSS. This document provides a complete technical overview and implementation guide.

## Architecture

### Multi-Tenant Design
The system is designed from the ground up for multi-tenancy:
- Each company has isolated data via `companyId` field in all tables
- Users are scoped to a single company
- All queries automatically filter by company context
- Ready for row-level security (RLS) policies if migrating to PostgreSQL/Supabase

### Data Model

#### Core Entities
```typescript
Company {
  id: string
  name: string
  registrationNumber: string
  taxPin: string
  nssf: string
  nhif: string
  // ... address and contact info
}

Employee {
  id: string
  companyId: string
  employeeNumber: string
  firstName: string
  lastName: string
  email: string
  idNumber: string
  taxPin: string
  baseSalary: number
  salaryFrequency: 'monthly'
  allowances: { housing, transport, medical, other }
  deductions: { nssf, helb, insurance, loan, other }
  // ... banking and employment info
}

Payroll {
  id: string
  companyId: string
  payrollMonth: string (YYYY-MM format)
  status: 'draft' | 'pending_approval' | 'approved' | 'processed' | 'paid'
  approvedBy: string
  approvedAt: Date
  processedBy: string
  processedAt: Date
}

PayrollDetail {
  id: string
  payrollId: string
  employeeId: string
  basicSalary: number
  allowanceBreakdown: Record<string, number>
  allowancesTotal: number
  grossPay: number
  nssfAmount: number
  nhifAmount: number
  incomeTaxAmount: number
  otherDeductionsBreakdown: Record<string, number>
  otherDeductionsTotal: number
  totalDeductions: number
  netPay: number
  paymentStatus: 'pending' | 'paid' | 'failed'
}
```

## Module Breakdown

### 1. Authentication Module (`/lib/auth.ts`)

**Key Functions:**
- `login(email, password)` - Validates credentials and returns session
- `createUser(companyId, email, firstName, lastName, role)` - Adds new user
- `getSession(token)` - Retrieves current session
- `logout(token)` - Invalidates session

**Session Model:**
```typescript
AuthSession {
  token: string
  userId: string
  companyId: string
  companyName: string
  userName: string
  userEmail: string
  userRole: 'admin' | 'manager' | 'officer' | 'employee'
}
```

### 2. Payroll Calculation Engine (`/lib/payroll-calculator.ts`)

**Core Calculation Flow:**
```
1. Load employee data + salary structure
2. Calculate Gross = Basic + Allowances
3. Calculate NSSF = Gross × 6% (Tier 1, capped at 18,000/month)
4. Calculate Taxable Income = Gross - NSSF
5. Calculate PAYE using KRA bands
6. Apply Personal Relief (2,400/month)
7. Calculate Net = Gross - PAYE - NSSF - NHIF - Other Deductions
```

**KRA Tax Bands (2024/2025):**
```
0 - 24,000: 10%
24,001 - 40,000: 15%
40,001+: 30%
```

**Key Functions:**
- `calculatePayroll(employee, period)` - Single employee payroll
- `calculateBulkPayroll(employees, period)` - All employees for month
- `calculateTax(grossIncome, ytdIncome, year)` - PAYE tax calculation
- `generatePayrollSummary(calculations)` - Aggregate statistics

### 3. Database Schema (`/lib/db-schema.ts`)

**In-Memory Implementation:**
- Data stored in TypeScript maps and arrays
- Thread-safe for single-server deployment
- Ready for PostgreSQL/Supabase migration

**Key Tables:**
- companies
- users
- employees
- contracts
- bank_accounts
- payrolls
- payroll_details
- leave_records
- deductions
- compliance_records
- audit_logs

### 4. Utilities (`/lib/utils-hr.ts`)

**Validation Functions:**
- `validateKenyanPhone(phone)` - Phone number format validation
- `validateTaxPin(pin)` - KRA tax PIN validation
- `validateBankAccount(account)` - Bank account validation
- `validateEmail(email)` - Email format

**Formatting Functions:**
- `formatCurrency(amount)` - Format KES amounts
- `formatDate(date)` - Format dates per Kenya locale
- `formatPercentage(value)` - Format percentages
- `getMonthName(month)` - Get month name

**Business Logic:**
- `calculateLeaveBalance(employee, year)` - Annual leave tracking
- `getStatusDisplayName(status)` - User-friendly status names
- `generateEmployeeNumber(companyId, sequence)` - Unique employee IDs

## Page Structure

### Public Pages
- `/` - Login page (with demo credentials)
- `/register` - Company registration and setup

### Dashboard Pages (Authenticated)

#### Dashboard (`/dashboard`)
- Company overview
- Key metrics (employees, active payrolls, pending approvals)
- Quick action cards
- System status widget

#### Employees (`/dashboard/employees`)
- Employee list with search
- Add/edit employee dialog
- Employee detail view with all fields
- Status management (active/inactive/terminated)

#### Leave Management (`/dashboard/leaves`)
- Leave request form
- Pending requests table
- Approved leaves history
- Leave type selection
- Approval workflow

#### Payroll (`/dashboard/payroll`)
- Month selection (previous/current/next)
- Create payroll button
- Payroll summary cards (gross, deductions, net)
- Employee payroll details table
- Status workflow (draft → pending → approved → processed)
- Approval and processing buttons

#### Payslips (`/dashboard/payroll/[id]/payslip`)
- Detailed payslip view
- PDF export functionality
- Full deduction breakdown
- Tax calculation details

#### Reports (`/dashboard/reports`)
- Payroll summary reports by month
- Tax compliance reports
- KRA P9 form generation
- CSV export for all reports
- Data visualization charts

#### Compliance (`/dashboard/compliance`)
- Statutory deadline tracker
- Compliance checklist
- Submission history
- Authority-wise status (KRA, NSSF, NHIF)

#### Settings (`/dashboard/settings`)
- Company profile management
- Team member management (add/remove users)
- User role assignment
- Company details (tax PIN, NSSF number, etc.)

## API Structure (Ready for Implementation)

### Payroll Endpoints
```
POST   /api/payroll              Create new payroll period
GET    /api/payroll/[id]         Get payroll details
POST   /api/payroll/[id]/approve Approve payroll
POST   /api/payroll/[id]/process Process payroll
GET    /api/payroll/[id]/payslips Get all payslips
```

### Employee Endpoints
```
GET    /api/employees            List all employees
POST   /api/employees            Create employee
GET    /api/employees/[id]       Get employee details
PUT    /api/employees/[id]       Update employee
DELETE /api/employees/[id]       Deactivate employee
```

### Reports Endpoints
```
GET    /api/reports/payroll      Payroll summary report
GET    /api/reports/tax          Tax compliance report
GET    /api/reports/p9           P9 form data
GET    /api/reports/kra          KRA submission report
```

### Compliance Endpoints
```
GET    /api/compliance/deadlines Statutory deadlines
POST   /api/compliance/submit    Record submission
GET    /api/compliance/records   Submission history
```

## Styling System

### Design Tokens (globals.css)
```css
/* Colors */
--primary: oklch(0.42 0.21 260)    /* Professional blue */
--accent: oklch(0.48 0.18 150)     /* Kenya green */
--destructive: oklch(0.55 0.21 30) /* Error red */

/* Neutral */
--foreground: oklch(0.15 0.02 220) /* Dark text */
--background: oklch(0.98 0.001 230) /* Light background */
--muted: oklch(0.90 0.002 200)     /* Subtle backgrounds */
--border: oklch(0.92 0.002 200)    /* Subtle borders */
```

### Component Patterns
- Cards: `border-border hover:shadow-md transition-shadow`
- Buttons: `bg-primary hover:bg-primary/90 text-primary-foreground`
- Inputs: `border-border bg-input focus:ring-primary`
- Status indicators: Color-coded (green, yellow, red)

## Feature Implementation Checklist

### MVP (Complete ✅)
- [x] Multi-tenant database schema
- [x] Authentication (email/password)
- [x] Employee CRUD operations
- [x] Salary structure management
- [x] Payroll calculation engine
- [x] KRA tax compliance
- [x] NSSF calculations
- [x] NHIF calculations
- [x] Payslip generation
- [x] Leave management (basic)
- [x] Compliance tracking
- [x] Report generation
- [x] Modern UI design system

### Phase 2 Features
- [ ] Bank payment integration
- [ ] M-Pesa integration
- [ ] Email payslip delivery
- [ ] PDF export
- [ ] Advanced reporting
- [ ] API for integrations

### Phase 3 Features
- [ ] Employee portal login
- [ ] Attendance tracking
- [ ] Mobile app
- [ ] Analytics dashboard
- [ ] Bulk operations

## Testing Strategy

### Unit Tests
- Payroll calculations (tax, deductions, net pay)
- Validation functions (phone, email, tax PIN)
- Date calculations (leave accrual, age)

### Integration Tests
- Payroll processing workflow
- Employee creation to payslip generation
- Compliance deadline calculations

### E2E Tests
- Complete payroll cycle
- Multi-user workflows
- Report generation

## Deployment

### Development
```bash
npm run dev
# Open http://localhost:3000
```

### Production
```bash
npm run build
npm run start
```

### Environment Variables (Future)
```
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=https://api.payrollke.com
STRIPE_API_KEY=sk_...
SENDGRID_API_KEY=SG...
```

## Database Migration Path

### Current (In-Memory)
- Files: `/lib/db-schema.ts`
- Storage: TypeScript maps/arrays
- Scope: Single server deployment

### Target (PostgreSQL)
```sql
-- Enable Row Level Security
CREATE POLICY company_isolation ON employees
  USING (company_id = current_company_id());

-- Add auth triggers
CREATE TRIGGER update_employee_timestamp
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();
```

### Migration Steps
1. Export data from in-memory DB
2. Create PostgreSQL tables
3. Import data with company isolation
4. Enable RLS policies
5. Update queries to use parameterized statements

## Performance Optimization

### Current Optimizations
- In-memory caching of frequently accessed data
- Lazy loading of employee lists
- Pagination in tables (10 items per page default)

### Future Optimizations
- Database indexing on company_id, month
- Query caching with Redis
- CDN for static assets
- Payroll calculation parallelization

## Security Considerations

### Current Implementation
- Session-based authentication
- Automatic logout after token expiration
- Validation of all inputs
- Error messages don't expose sensitive data

### Future Enhancements
- Two-factor authentication (2FA)
- Audit logging for all changes
- Data encryption at rest
- SSL/TLS for all communications
- PCI compliance for payment info

## Troubleshooting

### Login Issues
- Check demo credentials: `admin@techcorp.com` / `AdminPass123`
- Ensure session token is stored in localStorage
- Check browser console for authentication errors

### Payroll Calculation Issues
- Verify employee salary structure is complete
- Check NSSF tier selection (Tier 1 vs 2)
- Validate tax PIN format (A000000000X)
- Review KRA tax bands for current year

### Report Generation Issues
- Ensure payroll has been processed
- Check date range selection
- Verify employee records are complete

## Support & Maintenance

### Regular Tasks
- Monthly backup of database
- Quarterly security audit
- Annual KRA tax band updates
- Compliance deadline review

### Documentation
- Keep README.md updated with features
- Document API endpoints as they're added
- Maintain changelog for releases

---

**Technical Documentation for PayrollKE - v1.0**
Last Updated: February 2026
