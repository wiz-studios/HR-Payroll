'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Landmark, Wallet } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import type { Employee, Payroll, PayrollDetail } from '@/lib/hr/types';
import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency, getMonthName } from '@/lib/utils-hr';

interface PayslipRow {
  id: string;
  detail: PayrollDetail;
  payroll: Payroll | null;
}

export default function PayslipsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      const response = await fetch('/api/self-service/payslips');
      const payload = (await response.json().catch(() => ({ payslips: [] }))) as {
        employee?: Employee;
        payslips?: Array<{ detail: PayrollDetail; payroll: Payroll | null }>;
        error?: string;
      };
      if (!mounted) return;

      if (!response.ok) {
        setError(payload.error ?? 'No payslips are available for this account yet.');
        return;
      }

      setEmployee(payload.employee ?? null);
      setRows(
        (payload.payslips ?? []).map((entry) => ({
          id: entry.detail.id,
          detail: entry.detail,
          payroll: entry.payroll,
        }))
      );
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(
    () => ({
      count: rows.length,
      gross: rows.reduce((sum, row) => sum + row.detail.grossPay, 0),
      net: rows.reduce((sum, row) => sum + row.detail.netPay, 0),
    }),
    [rows]
  );

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Self Service"
        title="My payslips"
        description="Open finalized payroll statements, review gross-to-net history, and print payslips from a controlled employee-only ledger."
      />

      {error ? (
        <Alert variant="destructive" className="rounded-2xl border-destructive/30">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Payslips" value={totals.count} detail={employee ? employee.employeeNumber : 'No linked employee'} icon={<FileText className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Gross history" value={formatCurrency(totals.gross)} detail="Across available statements" icon={<Landmark className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Net received" value={formatCurrency(totals.net)} detail="Across available statements" icon={<Wallet className="h-5 w-5" />} tone="neutral" />
      </section>

      <section className="soft-panel p-6">
        <div className="mb-5">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Statement Ledger</p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">Payslip history</h2>
        </div>

        <DataTable
          data={rows}
          searchKeys={['id']}
          searchPlaceholder="Search payslip records"
          columns={[
            {
              key: 'id',
              label: 'Period',
              render: (_, row) => (
                <div>
                  <p className="font-semibold text-foreground">
                    {row.payroll ? getMonthName(row.payroll.payrollMonth) : 'Unknown period'}
                  </p>
                  <p className="text-xs text-muted-foreground">{row.detail.paymentStatus}</p>
                </div>
              ),
            },
            {
              key: 'detail',
              label: 'Gross',
              render: (_, row) => <span>{formatCurrency(row.detail.grossPay)}</span>,
            },
            {
              key: 'payroll',
              label: 'Deductions',
              render: (_, row) => <span>{formatCurrency(row.detail.totalDeductions)}</span>,
            },
            {
              key: 'detail',
              label: 'Net pay',
              render: (_, row) => <span className="font-semibold text-foreground">{formatCurrency(row.detail.netPay)}</span>,
            },
            {
              key: 'id',
              label: 'Open',
              render: (value) => (
                <Button asChild variant="outline" size="sm" className="rounded-2xl">
                  <Link href={`/dashboard/payroll/${String(value)}/payslip`}>Open</Link>
                </Button>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
