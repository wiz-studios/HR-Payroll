'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Landmark, ShieldCheck, UserRound } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import type { Employee } from '@/lib/hr/types';
import { formatCurrency } from '@/lib/utils-hr';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ChangeRequest {
  id: string;
  status: string;
  payload: {
    requestType: string;
    effectiveFrom: string;
    reason: string;
    changes: Record<string, unknown>;
  };
  actions: Array<{
    action: string;
    comments: string | null;
    createdAt: string;
  }>;
}

export default function ProfilePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    bankCode: '',
    accountNumber: '',
    reason: '',
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      const profileResponse = await fetch('/api/self-service/profile');
      const profilePayload = (await profileResponse.json().catch(() => ({ employee: null }))) as {
        employee?: Employee;
        error?: string;
      };
      if (!mounted) return;

      if (!profileResponse.ok) {
        setError(profilePayload.error ?? 'No employee profile is linked to this account yet.');
        return;
      }

      const nextEmployee = profilePayload.employee ?? null;
      setEmployee(nextEmployee);
      setBankForm({
        bankName: nextEmployee?.bankName ?? '',
        bankCode: nextEmployee?.bankCode ?? '',
        accountNumber: nextEmployee?.accountNumber ?? '',
        reason: '',
      });

      if (nextEmployee) {
        const requestsResponse = await fetch(`/api/employees/${nextEmployee.id}/change-requests`);
        const requestsPayload = (await requestsResponse.json().catch(() => ({ requests: [] }))) as {
          requests?: ChangeRequest[];
        };
        if (!mounted) return;
        if (requestsResponse.ok) {
          setRequests(requestsPayload.requests ?? []);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const latestBankRequest = useMemo(
    () => requests.find((request) => request.payload.requestType === 'bank_details') ?? null,
    [requests]
  );

  const submitBankRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!employee) return;

    const response = await fetch(`/api/employees/${employee.id}/change-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'bank_details',
        effectiveFrom: new Date().toISOString().slice(0, 10),
        reason: bankForm.reason || 'Bank detail update',
        changes: {
          bankName: bankForm.bankName,
          bankCode: bankForm.bankCode,
          accountNumber: bankForm.accountNumber,
        },
      }),
    });
    const payload = (await response.json().catch(() => ({ requests: [] }))) as {
      error?: string;
      requests?: ChangeRequest[];
    };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to submit bank-detail request.');
      return;
    }

    setRequests(payload.requests ?? []);
    setIsRequestOpen(false);
    setSuccess('Bank-detail change request submitted for approval.');
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Self Service"
        title="My profile"
        description="Review your payroll identity, banking details, and current change-request posture without editing protected payroll records directly."
        actions={
          employee ? (
            <Dialog open={isRequestOpen} onOpenChange={setIsRequestOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl px-5">Request bank change</Button>
              </DialogTrigger>
              <DialogContent className="rounded-[28px] border-border/70 bg-background sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Request bank-detail change</DialogTitle>
                  <DialogDescription>This request will route for approval before payroll uses the new payout details.</DialogDescription>
                </DialogHeader>
                <form onSubmit={submitBankRequest} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="bankName">Bank name</Label>
                      <Input id="bankName" value={bankForm.bankName} onChange={(event) => setBankForm((current) => ({ ...current, bankName: event.target.value }))} className="mt-2 h-12 rounded-2xl border-border/70 bg-card" />
                    </div>
                    <div>
                      <Label htmlFor="bankCode">Bank code</Label>
                      <Input id="bankCode" value={bankForm.bankCode} onChange={(event) => setBankForm((current) => ({ ...current, bankCode: event.target.value }))} className="mt-2 h-12 rounded-2xl border-border/70 bg-card" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="accountNumber">Account number</Label>
                    <Input id="accountNumber" value={bankForm.accountNumber} onChange={(event) => setBankForm((current) => ({ ...current, accountNumber: event.target.value }))} className="mt-2 h-12 rounded-2xl border-border/70 bg-card" />
                  </div>
                  <div>
                    <Label htmlFor="reason">Reason</Label>
                    <Input id="reason" value={bankForm.reason} onChange={(event) => setBankForm((current) => ({ ...current, reason: event.target.value }))} className="mt-2 h-12 rounded-2xl border-border/70 bg-card" />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsRequestOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-2xl">
                      Submit request
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
      {success ? (
        <Alert className="rounded-2xl border-emerald-600/20 bg-emerald-500/10 text-emerald-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      {employee ? (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Employee ID" value={employee.employeeNumber} detail="Primary payroll identifier" icon={<UserRound className="h-5 w-5" />} tone="primary" />
            <MetricCard label="Base salary" value={formatCurrency(employee.baseSalary)} detail="Current compensation baseline" icon={<Landmark className="h-5 w-5" />} tone="accent" />
            <MetricCard label="Bank workflow" value={latestBankRequest?.status ?? 'stable'} detail="Latest change-request posture" icon={<ShieldCheck className="h-5 w-5" />} tone="neutral" />
          </section>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="banking">Banking</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="requests">Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <div className="soft-panel p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['Name', `${employee.firstName} ${employee.lastName}`],
                    ['Email', employee.email],
                    ['Phone', employee.phoneNumber],
                    ['Department', employee.department],
                    ['Position', employee.position],
                    ['Employment type', employee.employmentType],
                    ['Tax PIN', employee.taxPin],
                    ['Status', employee.status],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="banking">
              <div className="soft-panel p-6">
                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    ['Bank name', employee.bankName],
                    ['Bank code', employee.bankCode],
                    ['Account number', employee.accountNumber],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
                      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents">
              <div className="soft-panel flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Employee file access</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open the document desk to review contracts, change letters, and other controlled HR records linked to your profile.
                  </p>
                </div>
                <Button asChild className="rounded-2xl px-5">
                  <Link href="/dashboard/documents">Open documents</Link>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="requests">
              <div className="soft-panel p-6">
                <div className="space-y-3">
                  {requests.length > 0 ? (
                    requests.map((request) => (
                      <div key={request.id} className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{request.payload.requestType.replaceAll('_', ' ')}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{request.payload.reason}</p>
                          </div>
                          <StatusPill
                            label={request.status}
                            tone={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No self-service change requests have been raised yet.</p>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
