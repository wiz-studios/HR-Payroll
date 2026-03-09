'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ReceiptText, ShieldCheck, Wallet } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { db } from '@/lib/db-schema';
import { formatCurrency, getMonthName } from '@/lib/utils-hr';
import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';

interface ReportRow {
  id: string;
  month: string;
  totalEmployees: number;
  totalGross: number;
  totalNSSF: number;
  totalNHIF: number;
  totalTax: number;
  totalNetPay: number;
}

interface PaymentReportRow {
  id: string;
  month: string;
  payrollStatus: string;
  batchType: string;
  status: string;
  reference: string | null;
  totalAmount: number;
  totalEmployees: number;
}

interface JournalReportRow {
  payrollId: string;
  payPeriodLabel: string;
  status: string;
  totalDebits: number;
  totalCredits: number;
  entryCount: number;
  balanced: boolean;
}

export default function ReportsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentReportRow[]>([]);
  const [journalRows, setJournalRows] = useState<JournalReportRow[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      const payrolls = await db.getPayrollsByCompany(currentSession.companyId);
      const paymentReportResponse = await fetch('/api/reports/payments');
      const journalReportResponse = await fetch('/api/reports/journals');
      const paymentReportPayload = (await paymentReportResponse.json().catch(() => ({ items: [] }))) as {
        items?: PaymentReportRow[];
      };
      const journalReportPayload = (await journalReportResponse.json().catch(() => ({ items: [] }))) as {
        items?: JournalReportRow[];
      };
      const reportRows = await Promise.all(payrolls
      .map((payroll) => {
        return db.getPayrollDetailsByPayroll(payroll.id).then((details) => ({
          id: payroll.id,
          month: payroll.payrollMonth,
          totalEmployees: details.length,
          totalGross: details.reduce((sum, detail) => sum + detail.grossPay, 0),
          totalNSSF: details.reduce((sum, detail) => sum + detail.nssfAmount, 0),
          totalNHIF: details.reduce((sum, detail) => sum + detail.nhifAmount, 0),
          totalTax: details.reduce((sum, detail) => sum + detail.incomeTaxAmount, 0),
          totalNetPay: details.reduce((sum, detail) => sum + detail.netPay, 0),
        }));
      }));
      if (!mounted) return;
      setRows(reportRows.sort((a, b) => b.month.localeCompare(a.month)));
      setPaymentRows((paymentReportPayload.items ?? []).sort((a, b) => b.month.localeCompare(a.month)));
      setJournalRows((journalReportPayload.items ?? []).sort((a, b) => b.payPeriodLabel.localeCompare(a.payPeriodLabel)));
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(
    () => ({
      gross: rows.reduce((sum, row) => sum + row.totalGross, 0),
      deductions: rows.reduce((sum, row) => sum + row.totalNSSF + row.totalNHIF + row.totalTax, 0),
      net: rows.reduce((sum, row) => sum + row.totalNetPay, 0),
      cycles: rows.length,
    }),
    [rows]
  );

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reporting"
        title="Payroll and statutory reporting"
        description="Review month-by-month payroll outcomes, statutory deductions, and payout posture across completed and in-flight cycles."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Payroll cycles" value={totals.cycles} detail="Months with payroll detail" icon={<BarChart3 className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Gross payroll" value={formatCurrency(totals.gross)} detail="All captured cycles" icon={<Wallet className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Statutory burden" value={formatCurrency(totals.deductions)} detail="NSSF, NHIF, and PAYE" icon={<ShieldCheck className="h-5 w-5" />} tone="neutral" />
        <MetricCard label="Net disbursement" value={formatCurrency(totals.net)} detail="Estimated employee payouts" icon={<ReceiptText className="h-5 w-5" />} tone="primary" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="soft-panel p-6">
          <div className="mb-5">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Report Ledger</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Monthly payroll summary</h2>
          </div>

          <DataTable
            data={rows}
            searchKeys={['month']}
            searchPlaceholder="Search report month"
            columns={[
              {
                key: 'month',
                label: 'Month',
                sortable: true,
                render: (value) => <span className="font-semibold text-foreground">{getMonthName(String(value))}</span>,
              },
              {
                key: 'totalEmployees',
                label: 'Employees',
                sortable: true,
              },
              {
                key: 'totalGross',
                label: 'Gross',
                sortable: true,
                render: (value) => formatCurrency(Number(value)),
              },
              {
                key: 'totalTax',
                label: 'PAYE',
                sortable: true,
                render: (value) => formatCurrency(Number(value)),
              },
              {
                key: 'totalNetPay',
                label: 'Net pay',
                sortable: true,
                render: (value) => <span className="font-semibold text-foreground">{formatCurrency(Number(value))}</span>,
              },
            ]}
          />
        </div>

        <div className="space-y-5">
          <div className="soft-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Reporting Focus</p>
            <div className="mt-5 space-y-4">
              <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                <p className="text-sm font-semibold text-foreground">Payroll trendline</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Compare gross payroll growth against net disbursement to catch cost spikes before month end.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                <p className="text-sm font-semibold text-foreground">Tax posture</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Use PAYE, NHIF, and NSSF totals here as a pre-filing checkpoint before compliance submissions.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                <p className="text-sm font-semibold text-foreground">Disbursement readiness</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Net pay totals help finance validate salary funding requirements ahead of bank processing.
                </p>
              </div>
            </div>
          </div>

          <div className="soft-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Payment batches</p>
            <div className="mt-5 space-y-3">
              {paymentRows.length > 0 ? (
                paymentRows.slice(0, 5).map((row) => (
                  <div key={row.id} className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{getMonthName(row.month)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.batchType.replaceAll('_', ' ')} · {row.payrollStatus.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(row.totalAmount)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {row.totalEmployees} employees · {row.status.replaceAll('_', ' ')}
                      {row.reference ? ` · ${row.reference}` : ''}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payment batches have been created yet. Process and export a payroll cycle to start reconciliation reporting.
                </p>
              )}
            </div>
          </div>

          <div className="soft-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Journal exports</p>
            <div className="mt-5 space-y-3">
              {journalRows.length > 0 ? (
                journalRows.slice(0, 5).map((row) => (
                  <div key={row.payrollId} className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{getMonthName(row.payPeriodLabel)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.entryCount} journal lines · {row.status.replaceAll('_', ' ')}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(row.totalDebits)}</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {row.balanced ? 'Balanced journal' : 'Out-of-balance journal'} · credits {formatCurrency(row.totalCredits)}
                    </p>
                    <a
                      href={`/api/payroll/${row.payrollId}/journal/export`}
                      className="mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Export journal CSV
                    </a>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payroll journals are available yet. Generate payroll runs to expose accounting-ready journal entries.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
