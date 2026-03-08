'use client';

import { useEffect, useState } from 'react';
import { Building2, KeyRound, Plus, Users } from 'lucide-react';
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

export default function SettingsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const [userForm, setUserForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'manager' as const,
  });
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isAdmin = session?.userRole === 'admin';

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
      if (!mounted) return;
      setCompany(currentCompany);
      setCompanyForm(currentCompany ?? {});
      setUsers(companyUsers);
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

  if (!session || !company) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Company controls"
        description="Maintain the organization profile, statutory identifiers, and user access structure that underpin payroll operations."
        actions={
          isAdmin ? (
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
          ) : null
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

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Users" value={users.length} detail="Assigned to this workspace" icon={<Users className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Administrators" value={users.filter((user) => user.role === 'admin').length} detail="Users with full control" icon={<KeyRound className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Registration" value={company.registrationNumber} detail="Legal company reference" icon={<Building2 className="h-5 w-5" />} tone="neutral" />
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
    </div>
  );
}
