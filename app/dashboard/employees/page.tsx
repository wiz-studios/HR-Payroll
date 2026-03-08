'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, UserPlus, Users } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { db, Employee } from '@/lib/db-schema';
import { formatCurrency, generateEmployeeNumber, getStatusDisplayName } from '@/lib/utils-hr';
import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';
import { StatusPill } from '@/components/app/status-pill';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EmployeesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
    idNumber: '',
    taxPin: '',
    accountNumber: '',
    bankCode: '',
    bankName: '',
    department: '',
    position: '',
    baseSalary: '',
    employmentType: 'permanent' as Employee['employmentType'],
  });

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    const currentSession = authService.getSession(token);
    setSession(currentSession);
    if (currentSession) {
      setEmployees(db.getEmployeesByCompany(currentSession.companyId));
    }
  }, []);

  const departmentCount = useMemo(() => new Set(employees.map((employee) => employee.department)).size, [employees]);
  const monthlyExposure = useMemo(() => employees.reduce((sum, employee) => sum + employee.baseSalary, 0), [employees]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleAddEmployee = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!session) return;

    const baseSalary = Number(formData.baseSalary);
    if (!baseSalary || baseSalary <= 0) {
      setError('Base salary must be greater than zero.');
      return;
    }

    const newEmployee: Employee = {
      id: `emp_${Date.now()}`,
      companyId: session.companyId,
      employeeNumber: generateEmployeeNumber(session.companyId, employees.length + 1),
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      idNumber: formData.idNumber,
      taxPin: formData.taxPin,
      accountNumber: formData.accountNumber,
      bankCode: formData.bankCode,
      bankName: formData.bankName,
      department: formData.department,
      position: formData.position,
      joiningDate: new Date(),
      status: 'active',
      employmentType: formData.employmentType,
      baseSalary,
      salaryFrequency: 'monthly',
      allowances: {
        housing: 0,
        transport: 0,
        medical: 0,
      },
      deductions: {
        nssf: 0,
        nhif: 0,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.createEmployee(newEmployee);
    setEmployees((current) => [...current, newEmployee]);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      idNumber: '',
      taxPin: '',
      accountNumber: '',
      bankCode: '',
      bankName: '',
      department: '',
      position: '',
      baseSalary: '',
      employmentType: 'permanent',
    });
    setIsCreating(false);
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="People Directory"
        title="Employees"
        description="Manage employee records, compensation baselines, and payroll-ready profile data from one structured ledger."
        actions={
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl px-5">
                <Plus className="mr-2 h-4 w-4" />
                Add employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[28px] border-border/70 bg-background sm:max-w-4xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-semibold tracking-[-0.04em]">Add employee</DialogTitle>
                <DialogDescription>
                  Capture the core payroll profile: identity, work details, and disbursement information.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddEmployee} className="space-y-5">
                {error ? (
                  <Alert variant="destructive" className="rounded-2xl border-destructive/30">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['firstName', 'First name', 'Amina'],
                    ['lastName', 'Last name', 'Otieno'],
                    ['email', 'Email', 'amina@company.com'],
                    ['phoneNumber', 'Phone number', '+254712345678'],
                    ['idNumber', 'ID number', '12345678'],
                    ['taxPin', 'Tax PIN', 'A000000001Z'],
                    ['bankName', 'Bank', 'Equity Bank'],
                    ['accountNumber', 'Account number', '1234567890'],
                    ['bankCode', 'Bank code', '001'],
                    ['department', 'Department', 'Finance'],
                    ['position', 'Position', 'Payroll Analyst'],
                    ['baseSalary', 'Base salary', '120000'],
                  ].map(([name, label, placeholder]) => (
                    <div key={name}>
                      <Label htmlFor={name}>{label}</Label>
                      <Input
                        id={name}
                        name={name}
                        type={name === 'email' ? 'email' : name === 'baseSalary' ? 'number' : 'text'}
                        value={formData[name as keyof typeof formData]}
                        onChange={handleInputChange}
                        placeholder={placeholder}
                        className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                        required
                      />
                    </div>
                  ))}

                  <div>
                    <Label htmlFor="employmentType">Employment type</Label>
                    <select
                      id="employmentType"
                      name="employmentType"
                      value={formData.employmentType}
                      onChange={handleInputChange}
                      className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm text-foreground outline-none ring-ring/50 transition focus:ring-2"
                    >
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="casual">Casual</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-2xl px-5">
                    Save employee
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Headcount" value={employees.length} detail="Employees on payroll" icon={<Users className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Departments" value={departmentCount} detail="Active teams represented" icon={<Search className="h-5 w-5" />} tone="neutral" />
        <MetricCard label="Monthly Base" value={formatCurrency(monthlyExposure)} detail="Before allowances and deductions" icon={<UserPlus className="h-5 w-5" />} tone="accent" />
      </section>

      <section className="soft-panel p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Employee Ledger</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Payroll-ready directory</h2>
          </div>
          <StatusPill label={`${employees.filter((employee) => employee.status === 'active').length} active`} tone="success" />
        </div>

        <DataTable
          data={employees}
          searchKeys={['firstName', 'lastName', 'email', 'employeeNumber', 'department', 'position']}
          searchPlaceholder="Search employees, departments, or payroll IDs"
          columns={[
            {
              key: 'firstName',
              label: 'Employee',
              sortable: true,
              render: (_, employee) => (
                <div>
                  <p className="font-semibold text-foreground">{employee.firstName} {employee.lastName}</p>
                  <p className="text-xs text-muted-foreground">{employee.employeeNumber}</p>
                </div>
              ),
            },
            {
              key: 'department',
              label: 'Role',
              render: (_, employee) => (
                <div>
                  <p className="font-medium text-foreground">{employee.position}</p>
                  <p className="text-xs text-muted-foreground">{employee.department}</p>
                </div>
              ),
            },
            {
              key: 'employmentType',
              label: 'Employment',
              sortable: true,
              render: (value) => <span className="capitalize text-muted-foreground">{String(value)}</span>,
            },
            {
              key: 'baseSalary',
              label: 'Base salary',
              sortable: true,
              render: (value) => <span className="font-semibold text-foreground">{formatCurrency(Number(value))}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              render: (value) => (
                <StatusPill
                  label={getStatusDisplayName(String(value))}
                  tone={String(value) === 'active' ? 'success' : String(value) === 'on_leave' ? 'warning' : 'neutral'}
                />
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
