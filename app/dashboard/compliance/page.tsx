'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileCheck2, Plus } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { ComplianceRecord, db } from '@/lib/db-schema';
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

const deadlines = [
  { authority: 'KRA (PAYE)', deadline: '9th of following month', frequency: 'Monthly' },
  { authority: 'NSSF', deadline: 'End of following month', frequency: 'Monthly' },
  { authority: 'NHIF', deadline: 'End of following month', frequency: 'Monthly' },
  { authority: 'KRA P9 Return', deadline: '14th after quarter close', frequency: 'Quarterly' },
];

function getTone(status: ComplianceRecord['status']) {
  if (status === 'submitted') return 'info' as const;
  if (status === 'accepted') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'warning' as const;
}

export default function CompliancePage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    authority: 'KRA (PAYE)',
    period: '',
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);
      const records = await db.getComplianceRecordsByCompany(currentSession.companyId);
      if (!mounted) return;
      setRecords(records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const pendingCount = useMemo(() => records.filter((record) => record.status === 'pending').length, [records]);
  const canSubmitCompliance = session?.userRole === 'admin' || session?.userRole === 'manager';
  const canFinalizeCompliance = session?.userRole === 'admin';

  const handleCreateRecord = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!session || !form.period) {
      setError('Enter the reporting period before creating a record.');
      return;
    }

    const response = await fetch('/api/compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordType:
          form.authority === 'NSSF'
            ? 'nssf_filing'
            : form.authority === 'NHIF'
              ? 'nhif_filing'
              : 'kra_filing',
        authority: form.authority,
        period: form.period,
        details: {
          authority: form.authority,
        },
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Failed to create compliance record.');
      return;
    }

    setRecords((current) => [payload.record as ComplianceRecord, ...current]);
    setIsCreating(false);
    setForm({ authority: 'KRA (PAYE)', period: '' });
    setSuccess('Compliance record created.');
  };

  const updateRecordStatus = async (recordId: string, status: ComplianceRecord['status']) => {
    const response = await fetch(`/api/compliance/${recordId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Failed to update compliance record.');
      return;
    }

    setRecords((current) => current.map((record) => (record.id === recordId ? (payload.record as ComplianceRecord) : record)));
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Compliance Desk"
        title="Statutory filing tracker"
        description="Track PAYE, NSSF, NHIF, and supporting submissions with a visible queue for pending and accepted records."
        actions={
          canSubmitCompliance ? (
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl px-5">
                <Plus className="mr-2 h-4 w-4" />
                New filing record
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[28px] border-border/70 bg-background sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Create filing record</DialogTitle>
                <DialogDescription>Start a compliance record for a monthly or quarterly submission.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateRecord} className="space-y-4">
                <div>
                  <Label htmlFor="authority">Authority</Label>
                  <select
                    id="authority"
                    value={form.authority}
                    onChange={(event) => setForm((current) => ({ ...current, authority: event.target.value }))}
                    className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                  >
                    {deadlines.map((item) => (
                      <option key={item.authority} value={item.authority}>
                        {item.authority}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="period">Period</Label>
                  <Input
                    id="period"
                    value={form.period}
                    onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
                    placeholder="2026-03 or 2026-Q1"
                    className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsCreating(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="rounded-2xl">
                    Create record
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

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Pending records" value={pendingCount} detail="Awaiting submission or response" icon={<CalendarClock className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Accepted filings" value={records.filter((record) => record.status === 'accepted').length} detail="Confirmed by authority" icon={<FileCheck2 className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Tracked schedules" value={deadlines.length} detail="Key statutory obligations" icon={<CalendarClock className="h-5 w-5" />} tone="neutral" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="soft-panel p-6">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Deadlines</p>
          <div className="mt-5 space-y-3">
            {deadlines.map((deadline) => (
              <div key={deadline.authority} className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">{deadline.authority}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{deadline.frequency}</p>
                  </div>
                  <StatusPill label={deadline.deadline} tone="info" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="soft-panel p-6">
          <div className="mb-5">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Record Queue</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Submission register</h2>
          </div>

          <DataTable
            data={records}
            searchKeys={['period', 'status']}
            searchPlaceholder="Search periods or statuses"
            columns={[
              {
                key: 'period',
                label: 'Period',
                sortable: true,
              },
              {
                key: 'recordType',
                label: 'Authority',
                render: (_, row) => <span>{String(row.details.authority ?? row.recordType)}</span>,
              },
              {
                key: 'status',
                label: 'Status',
                sortable: true,
                render: (value) => <StatusPill label={String(value)} tone={getTone(value as ComplianceRecord['status'])} />,
              },
              {
                key: 'updatedAt',
                label: 'Actions',
                render: (_, row) => (
                  <div className="flex flex-wrap gap-2">
                    {row.status === 'pending' && canSubmitCompliance ? (
                      <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void updateRecordStatus(row.id, 'submitted')}>
                        Submit
                      </Button>
                    ) : null}
                    {row.status === 'submitted' && canFinalizeCompliance ? (
                      <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void updateRecordStatus(row.id, 'accepted')}>
                        Accept
                      </Button>
                    ) : null}
                    {row.status === 'submitted' && canFinalizeCompliance ? (
                      <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void updateRecordStatus(row.id, 'rejected')}>
                        Reject
                      </Button>
                    ) : null}
                    {!(row.status === 'pending' && canSubmitCompliance) && !(row.status === 'submitted' && canFinalizeCompliance) ? (
                      <span className="text-xs text-muted-foreground">No action</span>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </section>
    </div>
  );
}
