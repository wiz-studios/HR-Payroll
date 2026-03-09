'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCheck, CircleDollarSign, FileText, LockKeyhole, Play, Send } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { AuditLog, db, Payroll, PayrollDetail } from '@/lib/db-schema';
import { generatePayrollSummary, PayrollCalculationResult, PayrollSummary } from '@/lib/payroll-calculator';
import { formatCurrency, getCurrentMonth, getMonthName, getNextMonth, getPreviousMonth } from '@/lib/utils-hr';
import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';
import { StatusPill } from '@/components/app/status-pill';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface PayrollApprovalRequest {
  id: string;
  status: string;
  payload: {
    payrollId: string;
    payrollMonth: string;
    currentStatus: string;
    reason: string;
  };
  createdAt: string;
  updatedAt: string;
  actions: Array<{
    action: string;
    actorUserId: string | null;
    comments: string | null;
    createdAt: string;
  }>;
}

interface PaymentBatch {
  id: string;
  batchType: string;
  status: 'draft' | 'exported' | 'submitted' | 'reconciled' | 'failed';
  reference: string | null;
  totalAmount: number;
  totalEmployees: number;
  createdAt: string;
  updatedAt: string;
  itemBreakdown: {
    pending: number;
    submitted: number;
    paid: number;
    failed: number;
    reconciled: number;
  };
}

function mapStatusTone(status: Payroll['status']) {
  if (status === 'pending_approval') return 'warning' as const;
  if (status === 'approved' || status === 'processed' || status === 'paid') return 'success' as const;
  return 'info' as const;
}

export default function PayrollPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [payrollDetails, setPayrollDetails] = useState<PayrollDetail[]>([]);
  const [employeeDirectory, setEmployeeDirectory] = useState<Record<string, string>>({});
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<PayrollApprovalRequest[]>([]);
  const [paymentBatches, setPaymentBatches] = useState<PaymentBatch[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');

  const loadPayroll = async (companyId: string, month: string) => {
    const existingPayroll = (await db.getPayrollByMonth(companyId, month)) ?? null;
    setPayroll(existingPayroll);

    if (!existingPayroll) {
      setPayrollDetails([]);
      setAuditLogs([]);
      setSummary(null);
      return;
    }

    const [details, logs, approvalsResponse, paymentsResponse] = await Promise.all([
      db.getPayrollDetailsByPayroll(existingPayroll.id),
      db.getAuditLogsByEntity(companyId, 'payroll_runs', existingPayroll.id),
      fetch(`/api/payroll/${existingPayroll.id}/approvals`),
      fetch(`/api/payroll/${existingPayroll.id}/payments`),
    ]);
    const approvalsPayload = (await approvalsResponse.json().catch(() => ({ requests: [] }))) as { requests?: PayrollApprovalRequest[] };
    const paymentsPayload = (await paymentsResponse.json().catch(() => ({ batches: [] }))) as { batches?: PaymentBatch[] };
    const calculations = new Map<string, PayrollCalculationResult>();

    details.forEach((detail) => {
      calculations.set(detail.employeeId, {
        basicSalary: detail.basicSalary,
        allowances: { taxableTotal: detail.allowancesTotal, nonTaxableTotal: 0, total: detail.allowancesTotal, breakdown: detail.allowanceBreakdown },
        grossSalary: detail.grossPay,
        deductions: {
          employeeStatutory: {
            nssf: detail.nssfAmount,
            healthFund: detail.nhifAmount,
            housingLevy: Number(detail.otherDeductionsBreakdown?.housingLevy ?? 0),
            incomeTax: detail.incomeTaxAmount,
            total: detail.nssfAmount + detail.nhifAmount + detail.incomeTaxAmount + Number(detail.otherDeductionsBreakdown?.housingLevy ?? 0),
          },
          employerStatutory: {
            nssf: 0,
            housingLevy: 0,
            total: 0,
          },
          preTax: {
            total: 0,
            breakdown: {},
          },
          postTax: {
            total: detail.otherDeductionsTotal,
            breakdown: detail.otherDeductionsBreakdown,
          },
          nssf: detail.nssfAmount,
          nhif: detail.nhifAmount,
          incomeTax: detail.incomeTaxAmount,
          other: { total: detail.otherDeductionsTotal, breakdown: detail.otherDeductionsBreakdown },
          total: detail.totalDeductions,
        },
        netPay: detail.netPay,
        employerCost: detail.grossPay,
        taxableIncome: 0,
        personalRelief: 0,
        insuranceRelief: 0,
        statutoryConfigVersion: 'legacy-run',
        validationErrors: [],
      });
    });

    setPayrollDetails(details);
    setAuditLogs(logs);
    setApprovalRequests(approvalsResponse.ok ? approvalsPayload.requests ?? [] : []);
    setPaymentBatches(paymentsResponse.ok ? paymentsPayload.batches ?? [] : []);
    setSummary(generatePayrollSummary(calculations));
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);
      const employees = await db.getEmployeesByCompany(currentSession.companyId);
      if (mounted) {
        setEmployeeDirectory(
          Object.fromEntries(
            employees.map((employee) => [employee.id, `${employee.firstName} ${employee.lastName}|||${employee.position}`])
          )
        );
      }
      await loadPayroll(currentSession.companyId, selectedMonth);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [selectedMonth]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleCreatePayroll = async () => {
    if (!session) return;
    clearMessages();

    const response = await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payrollMonth: selectedMonth }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Unable to create payroll.');
      return;
    }

    await loadPayroll(session.companyId, selectedMonth);
    setSuccess('Payroll run created successfully.');
  };

  const updatePayrollStatus = async (status: Payroll['status'], successMessage: string) => {
    if (!payroll) return;
    clearMessages();
    const response = await fetch(`/api/payroll/${payroll.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? 'Unable to update payroll status.');
      return;
    }

    await loadPayroll(session!.companyId, selectedMonth);
    setSuccess(successMessage);
  };

  const submitPayrollApproval = async () => {
    if (!payroll) return;
    clearMessages();
    const response = await fetch(`/api/payroll/${payroll.id}/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: approvalReason || 'Submitted for approval' }),
    });
    const payload = (await response.json().catch(() => ({ requests: [] }))) as { error?: string; requests?: PayrollApprovalRequest[] };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to submit payroll approval.');
      return;
    }
    setApprovalRequests(payload.requests ?? []);
    setIsApprovalDialogOpen(false);
    setApprovalReason('');
    await loadPayroll(session!.companyId, selectedMonth);
    setSuccess('Payroll submitted for approval.');
  };

  const reviewPayrollApproval = async (requestId: string, decision: 'approved' | 'rejected') => {
    if (!payroll) return;
    clearMessages();
    const comments = decision === 'rejected' ? window.prompt('Reason for rejection (optional)') ?? '' : '';
    const response = await fetch(`/api/payroll/${payroll.id}/approvals/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comments }),
    });
    const payload = (await response.json().catch(() => ({ requests: [] }))) as { error?: string; requests?: PayrollApprovalRequest[] };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to review payroll approval.');
      return;
    }
    setApprovalRequests(payload.requests ?? []);
    await loadPayroll(session!.companyId, selectedMonth);
    setSuccess(decision === 'approved' ? 'Payroll approved.' : 'Payroll sent back to draft.');
  };

  const createPaymentBatch = async () => {
    if (!payroll) return;
    clearMessages();
    const response = await fetch(`/api/payroll/${payroll.id}/payments`, {
      method: 'POST',
    });
    const payload = (await response.json().catch(() => ({ batches: [] }))) as {
      error?: string;
      batches?: PaymentBatch[];
    };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to create payment batch.');
      return;
    }
    setPaymentBatches(payload.batches ?? []);
    setSuccess('Payment batch created.');
  };

  const updatePaymentBatch = async (batchId: string, status: PaymentBatch['status'], reference?: string) => {
    if (!payroll) return;
    clearMessages();
    const response = await fetch(`/api/payroll/${payroll.id}/payments/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reference }),
    });
    const payload = (await response.json().catch(() => ({ batches: [] }))) as {
      error?: string;
      batches?: PaymentBatch[];
    };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to update payment batch.');
      return;
    }
    setPaymentBatches(payload.batches ?? []);
    setSuccess(`Payment batch moved to ${status.replace('_', ' ')}.`);
  };

  const exportPaymentBatch = async (batchId: string) => {
    if (!payroll) return;
    clearMessages();
    const response = await fetch(`/api/payroll/${payroll.id}/payments/${batchId}/export`);
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({ error: 'Unable to export payment batch.' }))) as {
        error?: string;
      };
      setError(payload.error ?? 'Unable to export payment batch.');
      return;
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const filenameMatch = disposition.match(/filename=\"?([^"]+)\"?/i);
    anchor.href = downloadUrl;
    anchor.download = filenameMatch?.[1] ?? `${payroll.id}-payment-batch.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(downloadUrl);
    await loadPayroll(session!.companyId, selectedMonth);
    setSuccess('Payment batch CSV exported.');
  };

  const hasReconciledBatch = paymentBatches.some((batch) => batch.status === 'reconciled');

  const payrollStatusAction = (() => {
    if (!payroll) return null;
    if (payroll.status === 'draft') {
      return (
        <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-2xl">
              <Send className="mr-2 h-4 w-4" />
              Submit for approval
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit payroll for approval</DialogTitle>
              <DialogDescription>This creates a workflow approval request and moves the run into pending approval.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="approvalReason">Reason</Label>
                <Input id="approvalReason" value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => void submitPayrollApproval()}>Submit</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      );
    }
    if (payroll.status === 'pending_approval' && session?.userRole === 'admin') {
      const pendingRequest = approvalRequests.find((request) => request.status === 'pending');
      return pendingRequest ? (
        <div className="flex gap-3">
          <Button className="rounded-2xl" onClick={() => void reviewPayrollApproval(pendingRequest.id, 'approved')}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Approve payroll
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={() => void reviewPayrollApproval(pendingRequest.id, 'rejected')}>
            Return to draft
          </Button>
        </div>
      ) : null;
    }
    if (payroll.status === 'approved' && session?.userRole === 'admin') {
      return (
        <Button
          className="rounded-2xl"
          onClick={() => void updatePayrollStatus('processed', 'Payroll processed and ready for disbursement.')}
        >
          <Play className="mr-2 h-4 w-4" />
          Process payroll
        </Button>
      );
    }
    if (payroll.status === 'processed' && session?.userRole === 'admin') {
      return (
        <Button
          className="rounded-2xl"
          disabled={!hasReconciledBatch}
          onClick={() => void updatePayrollStatus('paid', 'Payroll marked as paid.')}
        >
          <LockKeyhole className="mr-2 h-4 w-4" />
          Mark as paid
        </Button>
      );
    }
    return null;
  })();

  const controlNote = useMemo(() => {
    if (!payroll) return 'Generate a payroll run to calculate salaries for all active employees.';
    if (payroll.status === 'draft') return 'Draft cycles are editable and can be submitted for review.';
    if (payroll.status === 'pending_approval') return 'This cycle is awaiting administrator approval or can be sent back to draft.';
    if (payroll.status === 'approved') return 'Approved cycles can now be processed and locked for execution.';
    if (payroll.status === 'processed') {
      return hasReconciledBatch
        ? 'This cycle has a reconciled payment batch and can now be marked as paid.'
        : 'Create, export, submit, and reconcile a payment batch before marking this cycle as paid.';
    }
    return 'This cycle is finalized and should be treated as immutable payroll history.';
  }, [hasReconciledBatch, payroll]);

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Payroll Run"
        title="Monthly payroll orchestration"
        description="Create a run, validate salary exposure, and move each cycle through approval and processing with a clean audit trail."
        actions={
          <>
            <Button variant="outline" className="rounded-2xl" onClick={() => setSelectedMonth(getPreviousMonth(selectedMonth))}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <StatusPill label={getMonthName(selectedMonth)} tone="info" />
            <Button variant="outline" className="rounded-2xl" onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            {!payroll ? (
              <Button className="rounded-2xl" onClick={handleCreatePayroll}>
                <CircleDollarSign className="mr-2 h-4 w-4" />
                Create payroll
              </Button>
            ) : null}
          </>
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

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Cycle" value={payroll ? getMonthName(payroll.payrollMonth) : 'Not created'} detail="Selected payroll period" icon={<FileText className="h-5 w-5" />} tone="neutral" />
        <MetricCard label="Employees" value={summary?.totalEmployees ?? 0} detail="Employees in the run" icon={<CircleDollarSign className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Gross pay" value={formatCurrency(summary?.totalGrossSalaries ?? 0)} detail="Before statutory deductions" icon={<Send className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Net pay" value={formatCurrency(summary?.totalNetPay ?? 0)} detail="Estimated disbursement" icon={<CheckCheck className="h-5 w-5" />} tone="primary" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="soft-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Status</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Cycle controls</h2>
            </div>
            <StatusPill label={payroll ? payroll.status.replace('_', ' ') : 'Awaiting creation'} tone={payroll ? mapStatusTone(payroll.status) : 'neutral'} />
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
              <p className="text-sm font-medium text-foreground">
                {payroll ? 'Use the action below to move this cycle to the next stage.' : controlNote}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {controlNote}
              </p>
              <div className="mt-5">{payrollStatusAction}</div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
              <p className="text-sm font-medium text-foreground">Lock posture</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Locked</span>
                  <StatusPill label={payroll?.lockedAt ? 'Yes' : 'No'} tone={payroll?.lockedAt ? 'success' : 'neutral'} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Processed at</span>
                  <span className="font-medium text-foreground">
                    {payroll?.processedAt ? payroll.processedAt.toLocaleString('en-KE') : 'Not processed'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Locked at</span>
                  <span className="font-medium text-foreground">
                    {payroll?.lockedAt ? payroll.lockedAt.toLocaleString('en-KE') : 'Unlocked'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
              <p className="text-sm font-medium text-foreground">Deduction picture</p>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">NSSF</span>
                  <span className="font-semibold text-foreground">{formatCurrency(summary?.totalNSSF ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">SHIF / SHA</span>
                  <span className="font-semibold text-foreground">{formatCurrency(summary?.totalHealthFund ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Housing Levy</span>
                  <span className="font-semibold text-foreground">{formatCurrency(summary?.totalHousingLevyEmployee ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">PAYE</span>
                  <span className="font-semibold text-foreground">{formatCurrency(summary?.totalIncomeTax ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                  <span className="text-muted-foreground">Total deductions</span>
                  <span className="font-semibold text-foreground">{formatCurrency(summary?.totalDeductions ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="soft-panel p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Run Ledger</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Employee payroll lines</h2>
            </div>
          </div>

          <DataTable
            data={payrollDetails}
            searchKeys={['employeeId', 'paymentStatus']}
            searchPlaceholder="Search payroll lines"
            columns={[
              {
                key: 'employeeId',
                label: 'Employee',
                render: (value) => {
                  const [name, position] = (employeeDirectory[String(value)] ?? `${String(value)}|||Payroll record`).split('|||');
                  return (
                    <div>
                      <p className="font-semibold text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{position}</p>
                    </div>
                  );
                },
              },
              {
                key: 'grossPay',
                label: 'Gross',
                sortable: true,
                render: (value) => <span className="font-medium text-foreground">{formatCurrency(Number(value))}</span>,
              },
              {
                key: 'totalDeductions',
                label: 'Deductions',
                sortable: true,
                render: (value) => <span>{formatCurrency(Number(value))}</span>,
              },
              {
                key: 'netPay',
                label: 'Net',
                sortable: true,
                render: (value) => <span className="font-semibold text-foreground">{formatCurrency(Number(value))}</span>,
              },
              {
                key: 'paymentStatus',
                label: 'Payment',
                render: (value) => (
                  <StatusPill
                    label={String(value)}
                    tone={String(value) === 'paid' ? 'success' : String(value) === 'failed' ? 'danger' : 'warning'}
                  />
                ),
              },
              {
                key: 'id',
                label: 'Payslip',
                render: (_, row) => (
                  <Button asChild variant="outline" size="sm" className="rounded-2xl">
                    <Link href={`/dashboard/payroll/${row.id}/payslip`}>Open</Link>
                  </Button>
                ),
              },
            ]}
          />

          <div className="mt-6 rounded-[24px] border border-border/70 bg-card/70 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Audit Timeline</p>
            <div className="mt-4 space-y-3">
              {auditLogs.length > 0 ? (
                auditLogs.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-4 rounded-[20px] border border-border/60 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{entry.action.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{entry.createdAt.toLocaleString('en-KE')}</p>
                    </div>
                    <StatusPill label={payroll?.status.replace('_', ' ') ?? 'draft'} tone={payroll ? mapStatusTone(payroll.status) : 'neutral'} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No payroll events recorded yet for this cycle.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-border/70 bg-card/70 p-5">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Approval Workflow</p>
            <div className="mt-4 space-y-3">
              {approvalRequests.length > 0 ? (
                approvalRequests.map((request) => (
                  <div key={request.id} className="rounded-[20px] border border-border/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">{request.payload.reason || 'Payroll approval request'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.payload.payrollMonth} · {new Date(request.createdAt).toLocaleString('en-KE')}
                        </p>
                      </div>
                      <StatusPill label={request.status} tone={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'danger' : 'warning'} />
                    </div>
                    {request.actions.length > 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">
                        {request.actions.map((action) => `${action.action}${action.comments ? ` (${action.comments})` : ''}`).join(' → ')}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No workflow approvals recorded for this payroll run yet.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-border/70 bg-card/70 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Payment Operations</p>
                <p className="mt-2 text-sm font-medium text-foreground">Disbursement and reconciliation</p>
              </div>
              {payroll?.status === 'processed' && session.userRole === 'admin' ? (
                <Button className="rounded-2xl" onClick={() => void createPaymentBatch()}>
                  Create batch
                </Button>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              {paymentBatches.length > 0 ? (
                paymentBatches.map((batch) => (
                  <div key={batch.id} className="rounded-[20px] border border-border/60 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {batch.batchType.replaceAll('_', ' ')} batch · {formatCurrency(batch.totalAmount)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {batch.totalEmployees} employees · {new Date(batch.createdAt).toLocaleString('en-KE')}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Pending {batch.itemBreakdown.pending} · Submitted {batch.itemBreakdown.submitted} · Reconciled {batch.itemBreakdown.reconciled}
                        </p>
                      </div>
                      <StatusPill
                        label={batch.status}
                        tone={batch.status === 'reconciled' ? 'success' : batch.status === 'failed' ? 'danger' : 'warning'}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {batch.status === 'draft' || batch.status === 'exported' ? (
                        <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void exportPaymentBatch(batch.id)}>
                          Export CSV
                        </Button>
                      ) : null}
                      {batch.status === 'exported' ? (
                        <Button size="sm" className="rounded-2xl" onClick={() => void updatePaymentBatch(batch.id, 'submitted', window.prompt('Batch reference (optional)') ?? '')}>
                          Mark submitted
                        </Button>
                      ) : null}
                      {batch.status === 'submitted' ? (
                        <>
                          <Button size="sm" className="rounded-2xl" onClick={() => void updatePaymentBatch(batch.id, 'reconciled', window.prompt('Reconciliation reference (optional)') ?? '')}>
                            Reconcile
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void updatePaymentBatch(batch.id, 'failed', window.prompt('Failure note') ?? 'Batch failed')}>
                            Mark failed
                          </Button>
                        </>
                      ) : null}
                      {batch.status === 'failed' ? (
                        <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => void updatePaymentBatch(batch.id, 'draft')}>
                          Reopen draft
                        </Button>
                      ) : null}
                    </div>
                    {batch.reference ? (
                      <p className="mt-3 text-xs text-muted-foreground">Reference: {batch.reference}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payment batches exist for this cycle yet. Process the payroll first, then create a batch for export and reconciliation.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
