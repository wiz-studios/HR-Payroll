'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCheck, CircleDollarSign, FileText, Play, Send } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { db, Payroll, PayrollDetail } from '@/lib/db-schema';
import { generatePayrollSummary, PayrollCalculationResult, PayrollSummary } from '@/lib/payroll-calculator';
import { formatCurrency, getCurrentMonth, getMonthName, getNextMonth, getPreviousMonth } from '@/lib/utils-hr';
import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';
import { StatusPill } from '@/components/app/status-pill';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPayroll = async (companyId: string, month: string) => {
    const existingPayroll = (await db.getPayrollByMonth(companyId, month)) ?? null;
    setPayroll(existingPayroll);

    if (!existingPayroll) {
      setPayrollDetails([]);
      setSummary(null);
      return;
    }

    const details = await db.getPayrollDetailsByPayroll(existingPayroll.id);
    const calculations = new Map<string, PayrollCalculationResult>();

    details.forEach((detail) => {
      calculations.set(detail.employeeId, {
        basicSalary: detail.basicSalary,
        allowances: { total: detail.allowancesTotal, breakdown: detail.allowanceBreakdown },
        grossSalary: detail.grossPay,
        deductions: {
          nssf: detail.nssfAmount,
          nhif: detail.nhifAmount,
          incomeTax: detail.incomeTaxAmount,
          other: { total: detail.otherDeductionsTotal, breakdown: detail.otherDeductionsBreakdown },
          total: detail.totalDeductions,
        },
        netPay: detail.netPay,
        taxableIncome: 0,
        personalRelief: 0,
        insuranceRelief: 0,
      });
    });

    setPayrollDetails(details);
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

  const payrollStatusAction = (() => {
    if (!payroll) return null;
    if (payroll.status === 'draft') {
      return (
        <Button className="rounded-2xl" onClick={() => void updatePayrollStatus('pending_approval', 'Payroll submitted for approval.')}>
          <Send className="mr-2 h-4 w-4" />
          Submit for approval
        </Button>
      );
    }
    if (payroll.status === 'pending_approval' && session?.userRole === 'admin') {
      return (
        <Button
          className="rounded-2xl"
          onClick={() => void updatePayrollStatus('approved', 'Payroll approved.')}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Approve payroll
        </Button>
      );
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
    return null;
  })();

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
                {payroll
                  ? 'Use the action below to move this cycle to the next stage.'
                  : 'Generate a payroll run to calculate salaries for all active employees.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Draft cycles can be reviewed before approval. Once processed, figures should be treated as payroll-ready.
              </p>
              <div className="mt-5">{payrollStatusAction}</div>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
              <p className="text-sm font-medium text-foreground">Deduction picture</p>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">NSSF</span>
                  <span className="font-semibold text-foreground">{formatCurrency(summary?.totalNSSF ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">NHIF</span>
                  <span className="font-semibold text-foreground">{formatCurrency(summary?.totalNHIF ?? 0)}</span>
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
        </div>
      </section>
    </div>
  );
}
