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

export default function ReportsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (!token) return;

    const currentSession = authService.getSession(token);
    setSession(currentSession);

    if (!currentSession) return;

    const payrolls = db.getPayrollsByCompany(currentSession.companyId);
    const reportRows = payrolls
      .map((payroll) => {
        const details = db.getPayrollDetailsByPayroll(payroll.id);
        return {
          id: payroll.id,
          month: payroll.payrollMonth,
          totalEmployees: details.length,
          totalGross: details.reduce((sum, detail) => sum + detail.grossPay, 0),
          totalNSSF: details.reduce((sum, detail) => sum + detail.nssfAmount, 0),
          totalNHIF: details.reduce((sum, detail) => sum + detail.nhifAmount, 0),
          totalTax: details.reduce((sum, detail) => sum + detail.incomeTaxAmount, 0),
          totalNetPay: details.reduce((sum, detail) => sum + detail.netPay, 0),
        };
      })
      .sort((a, b) => b.month.localeCompare(a.month));

    setRows(reportRows);
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
        </div>
      </section>
    </div>
  );
}
