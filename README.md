# PayrollKE - Kenya HR & Payroll Management System

A comprehensive, multi-tenant HR and payroll management system built for Kenya, with full compliance support for KRA, NSSF, and NHIF regulations.

## Features

### Human Resources Module
- **Employee Management**: Complete CRUD operations for employee records
  - Personal information (name, contact, ID number)
  - Employment details (position, department, joining date)
  - Salary structure and employment type
  - Bank account details for salary disbursement

- **Leave Management**: Track and approve employee leave requests
  - Annual leave accrual (21 days/year)
  - Sick leave (7 days/year)
  - Maternity and special leave types
  - Approval workflow with manager sign-off

### Payroll Module
- **Payroll Processing**: Automated monthly salary calculations
  - Employee roster management
  - Salary structure configuration
  - Allowances and deductions setup
  - Bulk payroll generation

- **Tax Compliance**: Kenya Revenue Authority (KRA) compliant calculations
  - Progressive PAYE tax calculation using 2024/2025 KRA bands
  - Personal relief calculation (KES 2,400/month)
  - Insurance relief for contributions
  - Cumulative tax tracking (year-to-date)

- **Statutory Deductions**: Automatic deduction calculations
  - NSSF contributions (Tier 1: 6%, Tier 2: 10%)
  - NHIF premiums with salary-based brackets
  - Voluntary deductions (HELB, insurance, savings)
  - Custom deductions per company policy

- **Payslip Generation**: Comprehensive payslip creation
  - Itemized breakdown of gross, deductions, and net
  - PDF export capability
  - Email delivery to employees
  - Payslip history and archive

### Reporting & Compliance
- **Payroll Reports**: Monthly summary reports
  - Total payroll, deductions, and disbursement amounts
  - Employee-wise breakdown
  - CSV export for accounting systems

- **Tax Reports**: KRA compliance reporting
  - P9 form generation for annual compliance
  - Tax collected vs. personal relief analysis
  - Year-to-date tax tracking per employee

- **Compliance Tracking**: Statutory deadline management
  - KRA PAYE remittance deadlines (9th of following month)
  - NSSF submission tracking (end of following month)
  - NHIF deadline management (end of following month)
  - Quarterly and annual compliance reporting

## Technical Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **UI Framework**: Tailwind CSS v4 with shadcn/ui components
- **Database**: In-memory TypeScript (ready for PostgreSQL/Supabase integration)
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: date-fns for payroll date calculations
- **Styling**: Custom design system with semantic design tokens

## Project Structure

```
/app
  /dashboard              # Main dashboard
  /employees             # Employee management
  /leaves                # Leave management
  /payroll               # Payroll processing
  /reports               # Reports and analytics
  /compliance            # Compliance tracking
  /settings              # Company & user settings

/lib
  /auth.ts               # Authentication service
  /db-schema.ts          # Database models and queries
  /payroll-calculator.ts # Payroll calculation engine
  /utils-hr.ts          # Utility functions
  /demo-data.ts         # Demo data initialization

/components
  /ui                   # shadcn/ui components
  /data-table.tsx       # Reusable data table
  /form-field.tsx       # Form component wrapper
  /stat-card.tsx        # Statistics card component
```

## Getting Started

### Installation

1. Clone the repository:
```bash
git clone <repository>
cd payroll-ke
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Demo Credentials

The system comes pre-loaded with demo data:

- **Email**: admin@techcorp.com
- **Password**: AdminPass123
- **Company**: TechCorp Kenya Ltd
- **Sample Employees**: 5 employees with full salary structures

## Key Features Explained

### Payroll Calculation Engine

The system uses a sophisticated TypeScript-based payroll calculation engine that:

1. **Loads employee data** with active contracts and salary structures
2. **Calculates gross salary** (basic + allowances)
3. **Applies deductions** in order: NSSF → NHIF → PAYE → Custom deductions
4. **Computes PAYE tax** using KRA cumulative tax bands
5. **Generates payslips** with full itemized breakdown

### Kenya Tax Compliance

The system fully implements Kenya's tax regulations:

- **Progressive PAYE Bands** (2024/2025):
  - 0 - 24,000: 10%
  - 24,001 - 40,000: 15%
  - 40,001+: 30%

- **Personal Relief**: KES 2,400/month flat relief
- **Insurance Relief**: 15% of insurance contributions
- **NSSF Contributions**: 
  - Tier 1: 6% employee + 6% employer (capped at KES 18,000/month)
  - Tier 2: 10% optional voluntary contribution

### Multi-Tenant Architecture

The system is built from the ground up to support multiple companies:

- Company-level data isolation
- User roles per company (Admin, Manager, Officer, Employee)
- Separate payroll periods per company
- Compliance tracking per organization

## Data Persistence

Currently, the system uses in-memory storage for demo purposes. To persist data:

1. **For Production**: Integrate with Supabase or PostgreSQL
2. **Migration Path**: Database schema is ready in `/lib/db-schema.ts`
3. **RLS Policies**: Row-level security pre-configured for multi-tenancy

## User Roles

- **Admin**: Full system access, company management
- **HR Manager**: Employee management, leave approval
- **Payroll Officer**: Payroll processing, report generation
- **Employee**: View-only access to own payslips and leave balance

## Compliance Checklist

The system tracks compliance with:
- [ ] KRA PAYE remittance (monthly by 9th)
- [ ] NSSF contributions (monthly by end of month)
- [ ] NHIF premiums (monthly by end of month)
- [ ] P9 forms (annual filing)
- [ ] Leave registers (KRA requirement)
- [ ] Audit trail for all changes

## API Endpoints (Future)

When API integration is added:
- `POST /api/payroll/calculate` - Calculate payroll
- `GET /api/payroll/[id]/payslips` - Get payslips
- `POST /api/employees` - Create employee
- `GET /api/reports/tax` - Tax compliance report
- `POST /api/compliance/[type]/submit` - Submit compliance records

## Roadmap

### Phase 1 (Complete ✅)
- Multi-tenant HR system
- Employee management
- Payroll calculations
- Tax compliance

### Phase 2 (Upcoming)
- Bank payment integration
- M-Pesa integration for salary disbursement
- Employee self-service portal
- Mobile app (React Native)

### Phase 3 (Future)
- Attendance & time tracking
- Advanced analytics dashboard
- Custom leave policies
- Bulk operations (CSV imports)
- Third-party API integrations

## Support

For issues or questions:
1. Check the dashboard for built-in help
2. Review compliance deadlines and checklists
3. Contact support for integration assistance

## License

This project is proprietary and built for Kenya's regulatory environment. Usage is restricted to authorized organizations.

---

**Built with care for Kenya's HR professionals.** 🇰🇪
