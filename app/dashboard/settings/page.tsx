'use client';

import { useEffect, useState } from 'react';
import { Building2, GitBranch, KeyRound, Landmark, Plus, Users, Wallet } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { Company, db, User } from '@/lib/db-schema';
import { getRoleDisplayName } from '@/lib/utils-hr';
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

interface BranchItem {
  id: string;
  name: string;
  branch_code: string;
  location: string | null;
  is_active: boolean;
}

interface DepartmentItem {
  id: string;
  name: string;
  department_code: string;
  parent_department_id: string | null;
  branch_id: string | null;
  is_active: boolean;
}

interface CostCenterItem {
  id: string;
  name: string;
  cost_center_code: string;
  department_id: string | null;
  branch_id: string | null;
  is_active: boolean;
}

interface PayrollGroupItem {
  id: string;
  name: string;
  group_code: string;
  pay_frequency: string;
  is_default: boolean;
  is_active: boolean;
  branch_id: string | null;
  department_id: string | null;
}

interface CompanyStructure {
  branches: BranchItem[];
  departments: DepartmentItem[];
  costCenters: CostCenterItem[];
  payrollGroups: PayrollGroupItem[];
}

type StructureEntityType = 'branch' | 'department' | 'costCenter' | 'payrollGroup';

interface StructureEditorState {
  id?: string;
  entityType: StructureEntityType;
  name: string;
  code: string;
  location: string;
  branchId: string;
  departmentId: string;
  parentDepartmentId: string;
  payFrequency: 'monthly' | 'weekly' | 'biweekly' | 'daily' | 'off_cycle';
  isDefault: boolean;
  isActive: boolean;
}

const emptyStructure: CompanyStructure = {
  branches: [],
  departments: [],
  costCenters: [],
  payrollGroups: [],
};

const defaultEditor = (entityType: StructureEntityType): StructureEditorState => ({
  entityType,
  name: '',
  code: '',
  location: '',
  branchId: '',
  departmentId: '',
  parentDepartmentId: '',
  payFrequency: 'monthly',
  isDefault: false,
  isActive: true,
});

function labelForEntity(entityType: StructureEntityType) {
  if (entityType === 'branch') return 'Branch';
  if (entityType === 'department') return 'Department';
  if (entityType === 'costCenter') return 'Cost center';
  return 'Payroll group';
}

export default function SettingsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [structure, setStructure] = useState<CompanyStructure>(emptyStructure);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const [userForm, setUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'manager' as const,
  });
  const [structureEditor, setStructureEditor] = useState<StructureEditorState>(defaultEditor('branch'));
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isStructureDialogOpen, setIsStructureDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isAdmin = session?.userRole === 'admin';
  const canManageStructure = session?.userRole === 'admin' || session?.userRole === 'manager';

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      const [currentCompany, companyUsers] = await Promise.all([
        db.getCompany(currentSession.companyId),
        db.getUsersByCompany(currentSession.companyId),
      ]);

      const structureResponse = await fetch('/api/company-structure');
      const structurePayload = (await structureResponse.json().catch(() => emptyStructure)) as CompanyStructure & { error?: string };

      if (!mounted) return;
      setCompany(currentCompany);
      setCompanyForm(currentCompany ?? {});
      setUsers(companyUsers);
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

  const handleSaveCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!company) return;

    const response = await fetch('/api/company', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(companyForm),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Failed to update company.');
      return;
    }

    setCompany(payload.company);
    setCompanyForm(payload.company);
    setIsEditingCompany(false);
    setMessage('Company profile updated.');
  };

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!session) return;

    try {
      const result = await authService.createUser(
        session.companyId,
        userForm.email,
        userForm.firstName,
        userForm.lastName,
        userForm.role
      );
      setUsers((current) => [...current, result.user]);
      setIsAddingUser(false);
      setUserForm({ email: '', firstName: '', lastName: '', role: 'manager' });
      setMessage(`Team member added. Temporary password: ${result.temporaryPassword}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add team member.');
    }
  };

  const handleResetPassword = async (userId: string) => {
    const tempPassword = await authService.resetUserPassword(userId);
    setMessage(`Temporary password: ${tempPassword}`);
  };

  const openCreateDialog = (entityType: StructureEntityType) => {
    setStructureEditor(defaultEditor(entityType));
    setIsStructureDialogOpen(true);
  };

  const openEditDialog = (entityType: StructureEntityType, item: BranchItem | DepartmentItem | CostCenterItem | PayrollGroupItem) => {
    setStructureEditor({
      id: item.id,
      entityType,
      name: item.name,
      code:
        entityType === 'branch'
          ? (item as BranchItem).branch_code
          : entityType === 'department'
            ? (item as DepartmentItem).department_code
            : entityType === 'costCenter'
              ? (item as CostCenterItem).cost_center_code
              : (item as PayrollGroupItem).group_code,
      location: entityType === 'branch' ? ((item as BranchItem).location ?? '') : '',
      branchId: 'branch_id' in item ? (item.branch_id ?? '') : '',
      departmentId: 'department_id' in item ? (item.department_id ?? '') : '',
      parentDepartmentId: entityType === 'department' ? ((item as DepartmentItem).parent_department_id ?? '') : '',
      payFrequency: entityType === 'payrollGroup' ? ((item as PayrollGroupItem).pay_frequency as StructureEditorState['payFrequency']) : 'monthly',
      isDefault: entityType === 'payrollGroup' ? (item as PayrollGroupItem).is_default : false,
      isActive: 'is_active' in item ? item.is_active : true,
    });
    setIsStructureDialogOpen(true);
  };

  const handleStructureSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const response = await fetch('/api/company-structure', {
      method: structureEditor.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(structureEditor),
    });
    const payload = (await response.json().catch(() => ({}))) as CompanyStructure & { error?: string };

    if (!response.ok) {
      setError(payload.error ?? 'Failed to save organization structure.');
      return;
    }

    setStructure({
      branches: payload.branches ?? [],
      departments: payload.departments ?? [],
      costCenters: payload.costCenters ?? [],
      payrollGroups: payload.payrollGroups ?? [],
    });
    setIsStructureDialogOpen(false);
    setStructureEditor(defaultEditor('branch'));
    setMessage(`${labelForEntity(structureEditor.entityType)} saved.`);
  };

  if (!session || !company) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Company controls"
        description="Maintain the organization profile, access rules, and enterprise structure that underpin payroll operations."
        actions={
          <div className="flex flex-wrap gap-3">
            {canManageStructure ? (
              <Dialog open={isStructureDialogOpen} onOpenChange={setIsStructureDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-2xl px-5" onClick={() => openCreateDialog('branch')}>
                    <GitBranch className="mr-2 h-4 w-4" />
                    Add structure item
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[28px] border-border/70 bg-background sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{structureEditor.id ? `Edit ${labelForEntity(structureEditor.entityType)}` : `Add ${labelForEntity(structureEditor.entityType)}`}</DialogTitle>
                    <DialogDescription>Write directly into the enterprise organization model used by current employee syncs.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleStructureSave} className="space-y-4">
                    <div>
                      <Label htmlFor="entityType">Entity type</Label>
                      <select
                        id="entityType"
                        value={structureEditor.entityType}
                        onChange={(event) => setStructureEditor((current) => ({ ...defaultEditor(event.target.value as StructureEntityType), entityType: event.target.value as StructureEntityType, id: current.id }))}
                        className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                        disabled={Boolean(structureEditor.id)}
                      >
                        <option value="branch">Branch</option>
                        <option value="department">Department</option>
                        <option value="costCenter">Cost center</option>
                        <option value="payrollGroup">Payroll group</option>
                      </select>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={structureEditor.name}
                          onChange={(event) => setStructureEditor((current) => ({ ...current, name: event.target.value }))}
                          className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="code">Code</Label>
                        <Input
                          id="code"
                          value={structureEditor.code}
                          onChange={(event) => setStructureEditor((current) => ({ ...current, code: event.target.value }))}
                          className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                          placeholder="Leave blank to auto-generate"
                        />
                      </div>
                    </div>

                    {structureEditor.entityType === 'branch' ? (
                      <div>
                        <Label htmlFor="location">Location</Label>
                        <Input
                          id="location"
                          value={structureEditor.location}
                          onChange={(event) => setStructureEditor((current) => ({ ...current, location: event.target.value }))}
                          className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                        />
                      </div>
                    ) : null}

                    {structureEditor.entityType === 'department' || structureEditor.entityType === 'costCenter' || structureEditor.entityType === 'payrollGroup' ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="branchId">Branch</Label>
                          <select
                            id="branchId"
                            value={structureEditor.branchId}
                            onChange={(event) => setStructureEditor((current) => ({ ...current, branchId: event.target.value }))}
                            className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                          >
                            <option value="">No branch</option>
                            {structure.branches.map((branch) => (
                              <option key={branch.id} value={branch.id}>
                                {branch.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {structureEditor.entityType !== 'department' ? (
                          <div>
                            <Label htmlFor="departmentId">Department</Label>
                            <select
                              id="departmentId"
                              value={structureEditor.departmentId}
                              onChange={(event) => setStructureEditor((current) => ({ ...current, departmentId: event.target.value }))}
                              className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                            >
                              <option value="">No department</option>
                              {structure.departments.map((department) => (
                                <option key={department.id} value={department.id}>
                                  {department.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {structureEditor.entityType === 'department' ? (
                      <div>
                        <Label htmlFor="parentDepartmentId">Parent department</Label>
                        <select
                          id="parentDepartmentId"
                          value={structureEditor.parentDepartmentId}
                          onChange={(event) => setStructureEditor((current) => ({ ...current, parentDepartmentId: event.target.value }))}
                          className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                        >
                          <option value="">No parent</option>
                          {structure.departments
                            .filter((department) => department.id !== structureEditor.id)
                            .map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    ) : null}

                    {structureEditor.entityType === 'payrollGroup' ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="payFrequency">Pay frequency</Label>
                          <select
                            id="payFrequency"
                            value={structureEditor.payFrequency}
                            onChange={(event) => setStructureEditor((current) => ({ ...current, payFrequency: event.target.value as StructureEditorState['payFrequency'] }))}
                            className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                          >
                            <option value="monthly">Monthly</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Biweekly</option>
                            <option value="daily">Daily</option>
                            <option value="off_cycle">Off cycle</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="isDefault">Default group</Label>
                          <select
                            id="isDefault"
                            value={structureEditor.isDefault ? 'yes' : 'no'}
                            onChange={(event) => setStructureEditor((current) => ({ ...current, isDefault: event.target.value === 'yes' }))}
                            className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                          >
                            <option value="no">No</option>
                            <option value="yes">Yes</option>
                          </select>
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <Label htmlFor="isActive">Status</Label>
                      <select
                        id="isActive"
                        value={structureEditor.isActive ? 'active' : 'inactive'}
                        onChange={(event) => setStructureEditor((current) => ({ ...current, isActive: event.target.value === 'active' }))}
                        className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsStructureDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="rounded-2xl">
                        Save
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}

            {isAdmin ? (
              <Dialog open={isAddingUser} onOpenChange={setIsAddingUser}>
                <DialogTrigger asChild>
                  <Button className="rounded-2xl px-5">
                    <Plus className="mr-2 h-4 w-4" />
                    Add team member
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[28px] border-border/70 bg-background sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Invite team member</DialogTitle>
                    <DialogDescription>Create a user profile for payroll or HR operations.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="firstName">First name</Label>
                        <Input
                          id="firstName"
                          value={userForm.firstName}
                          onChange={(event) => setUserForm((current) => ({ ...current, firstName: event.target.value }))}
                          className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last name</Label>
                        <Input
                          id="lastName"
                          value={userForm.lastName}
                          onChange={(event) => setUserForm((current) => ({ ...current, lastName: event.target.value }))}
                          className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={userForm.email}
                        onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                        className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">Role</Label>
                      <select
                        id="role"
                        value={userForm.role}
                        onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as typeof userForm.role }))}
                        className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                      >
                        <option value="manager">Manager</option>
                        <option value="employee">Employee</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsAddingUser(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="rounded-2xl">
                        Create user
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        }
      />

      {error ? (
        <Alert variant="destructive" className="rounded-2xl border-destructive/30">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {message ? (
        <Alert className="rounded-2xl border-emerald-600/20 bg-emerald-500/10 text-emerald-800">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Users" value={users.length} detail="Assigned to this workspace" icon={<Users className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Administrators" value={users.filter((user) => user.role === 'admin').length} detail="Users with full control" icon={<KeyRound className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Branches" value={structure.branches.length} detail="Operational locations" icon={<GitBranch className="h-5 w-5" />} tone="neutral" />
        <MetricCard label="Departments" value={structure.departments.length} detail="Workforce structure" icon={<Building2 className="h-5 w-5" />} tone="neutral" />
        <MetricCard label="Cost centers" value={structure.costCenters.length} detail="Finance allocation points" icon={<Landmark className="h-5 w-5" />} tone="neutral" />
        <MetricCard label="Payroll groups" value={structure.payrollGroups.length} detail="Active payroll grouping" icon={<Wallet className="h-5 w-5" />} tone="primary" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="soft-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Company Profile</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Organization details</h2>
            </div>
            {isAdmin && !isEditingCompany ? (
              <Button variant="outline" className="rounded-2xl" onClick={() => setIsEditingCompany(true)}>
                Edit profile
              </Button>
            ) : null}
          </div>

          <form onSubmit={handleSaveCompany} className="grid gap-4 md:grid-cols-2">
            {[
              ['name', 'Company name'],
              ['registrationNumber', 'Registration number'],
              ['taxPin', 'Tax PIN'],
              ['nssf', 'NSSF number'],
              ['nhif', 'NHIF number'],
              ['phone', 'Phone'],
              ['email', 'Email'],
              ['address', 'Address'],
            ].map(([key, label]) => (
              <div key={key} className={key === 'address' ? 'md:col-span-2' : ''}>
                <Label htmlFor={key}>{label}</Label>
                {isAdmin && isEditingCompany ? (
                  <Input
                    id={key}
                    value={String(companyForm[key as keyof Company] ?? '')}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, [key]: event.target.value }))}
                    className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                  />
                ) : (
                  <div className="mt-2 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-foreground">
                    {String(company[key as keyof Company] ?? '')}
                  </div>
                )}
              </div>
            ))}

            {isAdmin && isEditingCompany ? (
              <div className="md:col-span-2 flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    setCompanyForm(company);
                    setIsEditingCompany(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="rounded-2xl">
                  Save changes
                </Button>
              </div>
            ) : null}
          </form>
        </div>

        <div className="soft-panel p-6">
          <div className="mb-5">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Access Control</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Team members</h2>
          </div>

          <DataTable
            data={users}
            searchKeys={['email', 'firstName', 'lastName', 'role']}
            searchPlaceholder="Search team members or roles"
            columns={[
              {
                key: 'firstName',
                label: 'User',
                render: (_, user) => (
                  <div>
                    <p className="font-semibold text-foreground">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                ),
              },
              {
                key: 'role',
                label: 'Role',
                sortable: true,
                render: (value) => <StatusPill label={getRoleDisplayName(String(value))} tone={String(value) === 'admin' ? 'info' : 'neutral'} />,
              },
              {
                key: 'id',
                label: 'Security',
                render: (_, user) => (
                  isAdmin ? (
                    <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void handleResetPassword(user.id)}>
                      Reset password
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Restricted</span>
                  )
                ),
              },
            ]}
          />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <div className="soft-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Organization Model</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Branches</h2>
            </div>
            {canManageStructure ? (
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => openCreateDialog('branch')}>
                Add branch
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            {structure.branches.length > 0 ? (
              structure.branches.map((branch) => (
                <div key={branch.id} className="rounded-[20px] border border-border/60 bg-card/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{branch.name}</p>
                      <p className="text-xs text-muted-foreground">{branch.branch_code}{branch.location ? ` · ${branch.location}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill label={branch.is_active ? 'Active' : 'Inactive'} tone={branch.is_active ? 'success' : 'neutral'} />
                      {canManageStructure ? (
                        <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => openEditDialog('branch', branch)}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No branches are defined yet.</p>
            )}
          </div>
        </div>

        <div className="soft-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Organization Model</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Departments</h2>
            </div>
            {canManageStructure ? (
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => openCreateDialog('department')}>
                Add department
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            {structure.departments.length > 0 ? (
              structure.departments.map((department) => (
                <div key={department.id} className="rounded-[20px] border border-border/60 bg-card/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{department.name}</p>
                      <p className="text-xs text-muted-foreground">{department.department_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill label={department.is_active ? 'Active' : 'Inactive'} tone={department.is_active ? 'success' : 'neutral'} />
                      {canManageStructure ? (
                        <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => openEditDialog('department', department)}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No departments are defined yet.</p>
            )}
          </div>
        </div>

        <div className="soft-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Finance Allocation</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Cost centers</h2>
            </div>
            {canManageStructure ? (
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => openCreateDialog('costCenter')}>
                Add cost center
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            {structure.costCenters.length > 0 ? (
              structure.costCenters.map((costCenter) => (
                <div key={costCenter.id} className="rounded-[20px] border border-border/60 bg-card/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{costCenter.name}</p>
                      <p className="text-xs text-muted-foreground">{costCenter.cost_center_code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill label={costCenter.is_active ? 'Active' : 'Inactive'} tone={costCenter.is_active ? 'success' : 'neutral'} />
                      {canManageStructure ? (
                        <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => openEditDialog('costCenter', costCenter)}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No cost centers are defined yet.</p>
            )}
          </div>
        </div>

        <div className="soft-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Payroll Foundation</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Payroll groups</h2>
            </div>
            {canManageStructure ? (
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => openCreateDialog('payrollGroup')}>
                Add payroll group
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            {structure.payrollGroups.length > 0 ? (
              structure.payrollGroups.map((group) => (
                <div key={group.id} className="rounded-[20px] border border-border/60 bg-card/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-foreground">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{group.group_code} · {group.pay_frequency}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill label={group.is_default ? 'Default' : group.is_active ? 'Active' : 'Inactive'} tone={group.is_default ? 'info' : group.is_active ? 'success' : 'neutral'} />
                      {canManageStructure ? (
                        <Button size="sm" variant="ghost" className="rounded-2xl" onClick={() => openEditDialog('payrollGroup', group)}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No payroll groups are defined yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
