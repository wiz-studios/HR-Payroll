'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCheck, CircleDollarSign, FileText, Play, Send } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { db, Payroll, PayrollDetail } from '@/lib/db-schema';
import { calculateBulkPayroll, generatePayrollSummary, PayrollCalculationResult, PayrollSummary } from '@/lib/payroll-calculator';
import { formatCurrency, generateId, getCurrentMonth, getMonthName, getNextMonth, getPreviousMonth } from '@/lib/utils-hr';
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
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadPayroll = (companyId: string, month: string) => {
    const existingPayroll = db.getPayrollByMonth(companyId, month) ?? null;
    setPayroll(existingPayroll);

    if (!existingPayroll) {
      setPayrollDetails([]);
      setSummary(null);
      return;
    }

    const details = db.getPayrollDetailsByPayroll(existingPayroll.id);
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
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    const currentSession = authService.getSession(token);
    setSession(currentSession);
    if (currentSession) {
      loadPayroll(currentSession.companyId, selectedMonth);
    }
  }, [selectedMonth]);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleCreatePayroll = () => {
    if (!session) return;
    clearMessages();

    if (payroll) {
      setError('Payroll for the selected month already exists.');
      return;
    }

    const employees = db.getActiveEmployeesByCompany(session.companyId);
    if (employees.length === 0) {
      setError('No active employees are available for payroll.');
      return;
    }

    const calculations = calculateBulkPayroll(employees);
    const createdPayroll: Payroll = {
      id: generateId('payroll'),
      companyId: session.companyId,
      payrollMonth: selectedMonth,
      payrollCycle: 'monthly',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.createPayroll(createdPayroll);

    const details = employees.map((employee) => {
      const calc = calculations.get(employee.id)!;
      const detail: PayrollDetail = {
        id: generateId('detail'),
        payrollId: createdPayroll.id,
        employeeId: employee.id,
        companyId: session.companyId,
        basicSalary: calc.basicSalary,
        allowancesTotal: calc.allowances.total,
        allowanceBreakdown: calc.allowances.breakdown,
        grossPay: calc.grossSalary,
        nssfAmount: calc.deductions.nssf,
        nhifAmount: calc.deductions.nhif,
        incomeTaxAmount: calc.deductions.incomeTax,
        otherDeductionsTotal: calc.deductions.other.total,
        otherDeductionsBreakdown: calc.deductions.other.breakdown,
        totalDeductions: calc.deductions.total,
        netPay: calc.netPay,
        paymentStatus: 'pending',
        paymentMethod: 'bank_transfer',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.createPayrollDetail(detail);
      return detail;
    });

    setPayroll(createdPayroll);
    setPayrollDetails(details);
    setSummary(generatePayrollSummary(calculations));
    setSuccess('Payroll run created successfully.');
  };

  const updatePayrollStatus = (updates: Partial<Payroll>, successMessage: string) => {
    if (!payroll) return;
    clearMessages();
    const updated = db.updatePayroll(payroll.id, updates);
    if (updated) {
      setPayroll(updated);
      setSuccess(successMessage);
    }
  };

  const payrollStatusAction = (() => {
    if (!payroll) return null;
    if (payroll.status === 'draft') {
      return (
        <Button className="rounded-2xl" onClick={() => updatePayrollStatus({ status: 'pending_approval' }, 'Payroll submitted for approval.')}>
          <Send className="mr-2 h-4 w-4" />
          Submit for approval
        </Button>
      );
    }
    if (payroll.status === 'pending_approval' && session?.userRole === 'admin') {
      return (
        <Button
          className="rounded-2xl"
          onClick={() =>
            updatePayrollStatus(
              { status: 'approved', approvedAt: new Date(), approvedBy: session.userId },
              'Payroll approved.'
            )
          }
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
          onClick={() =>
            updatePayrollStatus(
              { status: 'processed', processedAt: new Date(), processedBy: session.userId },
              'Payroll processed and ready for disbursement.'
            )
          }
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
                  const employee = db.getEmployeesByCompany(session.companyId).find((item) => item.id === value);
                  return (
                    <div>
                      <p className="font-semibold text-foreground">
                        {employee ? `${employee.firstName} ${employee.lastName}` : String(value)}
                      </p>
                      <p className="text-xs text-muted-foreground">{employee?.position ?? 'Payroll record'}</p>
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
                    <Link href={`/dashboard/payroll/${row.payrollId}/payslip`}>Open</Link>
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
