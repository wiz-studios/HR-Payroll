'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, BriefcaseBusiness, ClipboardCheck, CircleDollarSign } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';
import { StatusPill } from '@/components/app/status-pill';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ApprovalInboxItem {
  id: string;
  entityType: 'employee_change_request' | 'leave_approval' | 'payroll_approval';
  entityId: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  href: string;
  title: string;
  subtitle: string;
  canReview: boolean;
  latestAction: {
    action: string;
    actorUserId: string | null;
    comments: string | null;
    createdAt: string;
  } | null;
}

function statusTone(status: ApprovalInboxItem['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'rejected' || status === 'cancelled') return 'danger' as const;
  if (status === 'pending') return 'warning' as const;
  return 'neutral' as const;
}

function moduleLabel(entityType: ApprovalInboxItem['entityType']) {
  if (entityType === 'leave_approval') return 'Leave';
  if (entityType === 'payroll_approval') return 'Payroll';
  return 'Employee';
}

export default function ApprovalsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [items, setItems] = useState<ApprovalInboxItem[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadInbox = useCallback(async () => {
    const response = await fetch('/api/approvals');
    const payload = (await response.json().catch(() => ({ items: [] }))) as {
      error?: string;
      items?: ApprovalInboxItem[];
    };
    if (!response.ok) {
      throw new Error(payload.error ?? 'Unable to load approvals inbox.');
    }
    setItems(payload.items ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      try {
        await loadInbox();
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load approvals inbox.');
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [loadInbox]);

  const counts = useMemo(
    () => ({
      pending: items.filter((item) => item.status === 'pending').length,
      approved: items.filter((item) => item.status === 'approved').length,
      leave: items.filter((item) => item.entityType === 'leave_approval').length,
      payroll: items.filter((item) => item.entityType === 'payroll_approval').length,
    }),
    [items]
  );

  const reviewRequest = async (item: ApprovalInboxItem, decision: 'approved' | 'rejected') => {
    setError('');
    setSuccess('');

    const comments = decision === 'rejected' ? window.prompt('Reason for rejection (optional)') ?? '' : '';
    const endpoint =
      item.entityType === 'employee_change_request'
        ? `/api/employees/${item.entityId}/change-requests/${item.id}`
        : item.entityType === 'leave_approval'
          ? `/api/leave-requests/${item.entityId}/approvals/${item.id}`
          : `/api/payroll/${item.entityId}/approvals/${item.id}`;

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comments }),
    });
    const payload = await response.json().catch(() => ({} as { error?: string }));
    if (!response.ok) {
      setError(payload.error ?? 'Unable to review approval request.');
      return;
    }

    await loadInbox();
    setSuccess(decision === 'approved' ? 'Approval request completed.' : 'Approval request rejected.');
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Approvals"
        title="Central approvals inbox"
        description="Work pending employee, leave, and payroll approvals from one queue instead of chasing state across separate modules."
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Pending items" value={counts.pending} detail="Awaiting review" icon={<ClipboardCheck className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Approved items" value={counts.approved} detail="Resolved successfully" icon={<ArrowRightLeft className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Leave approvals" value={counts.leave} detail="Absence control workload" icon={<BriefcaseBusiness className="h-5 w-5" />} tone="neutral" />
        <MetricCard label="Payroll approvals" value={counts.payroll} detail="Cycles in workflow history" icon={<CircleDollarSign className="h-5 w-5" />} tone="primary" />
      </section>

      <section className="soft-panel p-6">
        <div className="mb-5">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Queue</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Active approval work</h2>
        </div>

        <DataTable
          data={items}
          searchKeys={['title', 'subtitle', 'entityType', 'status']}
          searchPlaceholder="Search by employee, leave, payroll month, or state"
          columns={[
            {
              key: 'title',
              label: 'Request',
              sortable: true,
              render: (value, row) => (
                <div>
                  <p className="font-semibold text-foreground">{String(value)}</p>
                  <p className="text-xs text-muted-foreground">{row.subtitle}</p>
                </div>
              ),
            },
            {
              key: 'entityType',
              label: 'Module',
              sortable: true,
              render: (value) => <span>{moduleLabel(value as ApprovalInboxItem['entityType'])}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              render: (value, row) => (
                <div className="space-y-2">
                  <StatusPill label={String(value)} tone={statusTone(value as ApprovalInboxItem['status'])} />
                  {row.latestAction ? (
                    <p className="text-xs text-muted-foreground">
                      {row.latestAction.action}
                      {row.latestAction.comments ? ` (${row.latestAction.comments})` : ''}
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'createdAt',
              label: 'Raised',
              sortable: true,
              render: (value) => <span>{new Date(String(value)).toLocaleString('en-KE')}</span>,
            },
            {
              key: 'id',
              label: 'Action',
              render: (_, row) => (
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="rounded-2xl">
                    <Link href={row.href}>Open</Link>
                  </Button>
                  {row.status === 'pending' && row.canReview ? (
                    <>
                      <Button size="sm" className="rounded-2xl" onClick={() => void reviewRequest(row, 'approved')}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void reviewRequest(row, 'rejected')}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
