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

interface CompanyStructure {
  branches: Array<{ id: string; name: string; branch_code: string }>;
  departments: Array<{ id: string; name: string; department_code: string }>;
  costCenters: Array<{ id: string; name: string; cost_center_code: string }>;
  payrollGroups: Array<{ id: string; name: string; group_code: string; pay_frequency: string; is_default: boolean }>;
}

export default function EmployeesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structure, setStructure] = useState<CompanyStructure>({ branches: [], departments: [], costCenters: [], payrollGroups: [] });
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
    branchId: '',
    departmentId: '',
    costCenterId: '',
    payrollGroupId: '',
    position: '',
    workLocation: '',
    jobGrade: '',
    baseSalary: '',
    employmentType: 'permanent' as Employee['employmentType'],
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);
      const [employeeRows, structureResponse] = await Promise.all([
        db.getEmployeesByCompany(currentSession.companyId),
        fetch('/api/company-structure'),
      ]);
      const structurePayload = (await structureResponse.json().catch(() => ({
        branches: [],
        departments: [],
        costCenters: [],
        payrollGroups: [],
      }))) as CompanyStructure;
      if (!mounted) return;
      setEmployees(employeeRows);
      if (structureResponse.ok) {
        setStructure({
          branches: structurePayload.branches ?? [],
          departments: structurePayload.departments ?? [],
          costCenters: structurePayload.costCenters ?? [],
          payrollGroups: structurePayload.payrollGroups ?? [],
        });
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const departmentCount = useMemo(() => new Set(employees.map((employee) => employee.department)).size, [employees]);
  const monthlyExposure = useMemo(() => employees.reduce((sum, employee) => sum + employee.baseSalary, 0), [employees]);
  const canManageEmployees = session?.userRole === 'admin' || session?.userRole === 'manager';

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleAddEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!session) return;

    const baseSalary = Number(formData.baseSalary);
    if (!baseSalary || baseSalary <= 0) {
      setError('Base salary must be greater than zero.');
      return;
    }
    if (structure.departments.length > 0 && !formData.departmentId) {
      setError('Select a department for the employee.');
      return;
    }

    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
        department: structure.departments.find((department) => department.id === formData.departmentId)?.name ?? formData.department,
        branchId: formData.branchId || undefined,
        departmentId: formData.departmentId || undefined,
        costCenterId: formData.costCenterId || undefined,
        payrollGroupId: formData.payrollGroupId || undefined,
        position: formData.position,
        workLocation: formData.workLocation || undefined,
        jobGrade: formData.jobGrade || undefined,
        joiningDate: new Date().toISOString().slice(0, 10),
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
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Failed to create employee.');
      return;
    }

    setEmployees((current) => [payload.employee as Employee, ...current]);
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
      branchId: '',
      departmentId: '',
      costCenterId: '',
      payrollGroupId: '',
      position: '',
      workLocation: '',
      jobGrade: '',
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
          canManageEmployees ? (
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
                    ['position', 'Position', 'Payroll Analyst'],
                    ['workLocation', 'Work location', 'Nairobi HQ'],
                    ['jobGrade', 'Job grade', 'M2'],
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
                    <Label htmlFor="branchId">Branch</Label>
                    <select
                      id="branchId"
                      name="branchId"
                      value={formData.branchId}
                      onChange={handleInputChange}
                      className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm text-foreground outline-none ring-ring/50 transition focus:ring-2"
                    >
                      <option value="">No branch</option>
                      {structure.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="departmentId">Department</Label>
                    <select
                      id="departmentId"
                      name="departmentId"
                      value={formData.departmentId}
                      onChange={handleInputChange}
                      className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm text-foreground outline-none ring-ring/50 transition focus:ring-2"
                    >
                      <option value="">No department</option>
                      {structure.departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {structure.departments.length === 0 ? (
                    <div>
                      <Label htmlFor="department">Department name</Label>
                      <Input
                        id="department"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        placeholder="Finance"
                        className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                        required
                      />
                    </div>
                  ) : null}

                  <div>
                    <Label htmlFor="costCenterId">Cost center</Label>
                    <select
                      id="costCenterId"
                      name="costCenterId"
                      value={formData.costCenterId}
                      onChange={handleInputChange}
                      className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm text-foreground outline-none ring-ring/50 transition focus:ring-2"
                    >
                      <option value="">No cost center</option>
                      {structure.costCenters.map((costCenter) => (
                        <option key={costCenter.id} value={costCenter.id}>
                          {costCenter.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="payrollGroupId">Payroll group</Label>
                    <select
                      id="payrollGroupId"
                      name="payrollGroupId"
                      value={formData.payrollGroupId}
                      onChange={handleInputChange}
                      className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm text-foreground outline-none ring-ring/50 transition focus:ring-2"
                    >
                      <option value="">Default monthly group</option>
                      {structure.payrollGroups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>

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
          ) : null
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
