'use client';

import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarDays, Plus } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { db, Employee, LeaveRequest } from '@/lib/db-schema';
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
import { Textarea } from '@/components/ui/textarea';

interface Leave {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
}

interface LeaveApprovalRequest {
  id: string;
  status: string;
  payload: {
    leaveRequestId: string;
    employeeId: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string;
  };
  actions: Array<{
    action: string;
    actorUserId: string | null;
    comments: string | null;
    createdAt: string;
  }>;
}

function leaveTone(status: Leave['status']) {
  if (status === 'approved') return 'success' as const;
  if (status === 'rejected') return 'danger' as const;
  return 'warning' as const;
}

export default function LeavesPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<LeaveApprovalRequest[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    employeeId: '',
    leaveType: 'annual',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      const [companyEmployees, leaveRequests, approvalsResponse] = await Promise.all([
        db.getEmployeesByCompany(currentSession.companyId),
        db.getLeaveRequestsByCompany(currentSession.companyId),
        fetch('/api/approvals'),
      ]);
      const approvalsPayload = (await approvalsResponse.json().catch(() => ({ items: [] }))) as {
        items?: Array<{
          id: string;
          entityType: string;
          entityId: string;
          status: string;
          payload: LeaveApprovalRequest['payload'];
          actions?: LeaveApprovalRequest['actions'];
        }>;
      };
      if (!mounted) return;

      const leaveApprovals = (approvalsPayload.items ?? [])
        .filter((item) => item.entityType === 'leave_approval')
        .map((item) => ({
          id: item.id,
          status: item.status,
          payload: item.payload,
          actions: item.actions ?? [],
        }));

      setEmployees(companyEmployees);
      setApprovalRequests(leaveApprovals);
      setLeaves(
        leaveRequests.map((leave) => {
          const employee = companyEmployees.find((item) => item.id === leave.employeeId);
          return {
            id: leave.id,
            employeeId: leave.employeeId,
            employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown Employee',
            leaveType: leave.leaveType,
            startDate: leave.startDate,
            endDate: leave.endDate,
            days: leave.days,
            status: leave.status,
            reason: leave.reason,
          };
        })
      );
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const pendingLeaves = useMemo(() => leaves.filter((leave) => leave.status === 'pending').length, [leaves]);
  const canManageLeaves = session?.userRole === 'admin' || session?.userRole === 'manager';
  const latestApprovalByLeave = useMemo(
    () =>
      approvalRequests.reduce<Record<string, LeaveApprovalRequest>>((accumulator, request) => {
        if (!accumulator[request.payload.leaveRequestId]) {
          accumulator[request.payload.leaveRequestId] = request;
        }
        return accumulator;
      }, {}),
    [approvalRequests]
  );

  const handleSubmitLeave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const employee = employees.find((item) => item.id === formData.employeeId);
    if (!employee) {
      setError('Select an employee before creating a leave request.');
      return;
    }

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    const response = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: employee.id,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        days,
        reason: formData.reason,
      }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Failed to create leave request.');
      return;
    }

    const leaveRequest = payload.leaveRequest as LeaveRequest;
    setApprovalRequests((current) => [
      ...((payload.requests ?? []) as LeaveApprovalRequest[]),
      ...current,
    ]);
    setLeaves((current) => {
      const next = current.filter((leave) => leave.id !== leaveRequest.id);
      return [
        {
          id: leaveRequest.id,
          employeeId: leaveRequest.employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          leaveType: leaveRequest.leaveType,
          startDate: leaveRequest.startDate,
          endDate: leaveRequest.endDate,
          days: leaveRequest.days,
          status: leaveRequest.status,
          reason: leaveRequest.reason,
        },
        ...next,
      ];
    });
    setFormData({ employeeId: '', leaveType: 'annual', startDate: '', endDate: '', reason: '' });
    setIsCreating(false);
    setSuccess('Leave request submitted.');
  };

  const ensureApprovalRequest = async (leaveId: string) => {
    const response = await fetch(`/api/leave-requests/${leaveId}/approvals`, {
      method: 'POST',
    });
    const payload = (await response.json().catch(() => ({ requests: [] }))) as {
      error?: string;
      requests?: LeaveApprovalRequest[];
    };
    if (!response.ok) {
      throw new Error(payload.error ?? 'Failed to start leave approval workflow.');
    }

    setApprovalRequests((current) => {
      const otherRequests = current.filter((request) => request.payload.leaveRequestId !== leaveId);
      return [...(payload.requests ?? []), ...otherRequests];
    });
    return (payload.requests ?? []).find((request) => request.status === 'pending') ?? null;
  };

  const reviewLeaveRequest = async (leaveId: string, decision: 'approved' | 'rejected') => {
    setError('');
    setSuccess('');

    let request = latestApprovalByLeave[leaveId];
    if (!request || request.status !== 'pending') {
      request = await ensureApprovalRequest(leaveId);
    }
    if (!request) {
      setError('No pending leave approval workflow is available for this request.');
      return;
    }

    const comments = decision === 'rejected' ? window.prompt('Reason for rejection (optional)') ?? '' : '';
    const response = await fetch(`/api/leave-requests/${leaveId}/approvals/${request.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comments }),
    });
    const payload = (await response.json().catch(() => ({ requests: [] }))) as {
      error?: string;
      requests?: LeaveApprovalRequest[];
    };
    if (!response.ok) {
      setError(payload.error ?? 'Failed to review leave request.');
      return;
    }

    setApprovalRequests((current) => {
      const otherRequests = current.filter((item) => item.payload.leaveRequestId !== leaveId);
      return [...(payload.requests ?? []), ...otherRequests];
    });
    setLeaves((current) =>
      current.map((leave) => (leave.id === leaveId ? { ...leave, status: decision } : leave))
    );
    setSuccess(decision === 'approved' ? 'Leave request approved.' : 'Leave request rejected.');
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Leave Desk"
        title="Leave management"
        description="Track approved and pending absences before they affect payroll planning, staffing, or month-end approvals."
        actions={
          canManageLeaves ? (
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl px-5">
                <Plus className="mr-2 h-4 w-4" />
                New leave request
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[28px] border-border/70 bg-background sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create leave request</DialogTitle>
                <DialogDescription>Log planned time off and keep payroll operations informed.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitLeave} className="space-y-4">
                <div>
                  <Label htmlFor="employee">Employee</Label>
                  <select
                    id="employee"
                    value={formData.employeeId}
                    onChange={(event) => setFormData((current) => ({ ...current, employeeId: event.target.value }))}
                    className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                  >
                    <option value="">Select employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.firstName} {employee.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <Label htmlFor="type">Leave type</Label>
                    <select
                      id="type"
                      value={formData.leaveType}
                      onChange={(event) => setFormData((current) => ({ ...current, leaveType: event.target.value }))}
                      className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm outline-none ring-ring/50 transition focus:ring-2"
                    >
                      <option value="annual">Annual</option>
                      <option value="sick">Sick</option>
                      <option value="maternity">Maternity</option>
                      <option value="compassionate">Compassionate</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="startDate">Start date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(event) => setFormData((current) => ({ ...current, startDate: event.target.value }))}
                      className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endDate">End date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(event) => setFormData((current) => ({ ...current, endDate: event.target.value }))}
                      className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(event) => setFormData((current) => ({ ...current, reason: event.target.value }))}
                    className="mt-2 min-h-28 rounded-2xl border-border/70 bg-card"
                    placeholder="Short operational context for the leave request"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsCreating(false)}>
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

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Open requests" value={pendingLeaves} detail="Pending manager action" icon={<CalendarDays className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Approved" value={leaves.filter((leave) => leave.status === 'approved').length} detail="Approved absences on record" icon={<BriefcaseBusiness className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Employees affected" value={new Set(leaves.map((leave) => leave.employeeId)).size} detail="Headcount with leave activity" icon={<CalendarDays className="h-5 w-5" />} tone="neutral" />
      </section>

      <section className="soft-panel p-6">
        <div className="mb-5">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Requests</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Leave register</h2>
        </div>

        <DataTable
          data={leaves}
          searchKeys={['employeeName', 'leaveType', 'status', 'reason']}
          searchPlaceholder="Search employees, leave type, or status"
          columns={[
            {
              key: 'employeeName',
              label: 'Employee',
              sortable: true,
            },
            {
              key: 'leaveType',
              label: 'Type',
              sortable: true,
              render: (value) => <span className="capitalize">{String(value)}</span>,
            },
            {
              key: 'startDate',
              label: 'Dates',
              render: (_, row) => (
                <div>
                  <p className="font-medium text-foreground">{row.startDate} to {row.endDate}</p>
                  <p className="text-xs text-muted-foreground">{row.days} days</p>
                </div>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              render: (value, row) => {
                const request = latestApprovalByLeave[row.id];
                const latestAction = request?.actions.at(-1);
                return (
                  <div className="space-y-2">
                    <StatusPill label={String(value)} tone={leaveTone(value as Leave['status'])} />
                    {request ? (
                      <p className="text-xs text-muted-foreground">
                        Workflow {request.status}
                        {latestAction?.comments ? ` (${latestAction.comments})` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Workflow pending initialization</p>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'id',
              label: 'Action',
              render: (_, row) => (
                canManageLeaves && row.status === 'pending' ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void reviewLeaveRequest(row.id, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void reviewLeaveRequest(row.id, 'rejected')}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">No action</span>
                )
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
