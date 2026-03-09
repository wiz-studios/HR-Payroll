'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CircleDollarSign,
  ClipboardCheck,
  FolderKanban,
  Users,
} from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { db } from '@/lib/db-schema';
import { formatCurrency, getMonthName } from '@/lib/utils-hr';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';
import { StatusPill } from '@/components/app/status-pill';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activePayrolls: 0,
    pendingApprovals: 0,
    totalGrossSalaries: 0,
  });
  const [payrolls, setPayrolls] = useState<Awaited<ReturnType<typeof db.getPayrollsByCompany>>>([]);
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof db.getEmployeesByCompany>>>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      const employees = await db.getEmployeesByCompany(currentSession.companyId);
      const payrolls = await db.getPayrollsByCompany(currentSession.companyId);
      const approvalsResponse = await fetch('/api/approvals?status=pending');
      const approvalsPayload = (await approvalsResponse.json().catch(() => ({ items: [] }))) as {
        items?: Array<{ id: string }>;
      };
      const activePayrolls = payrolls.filter((payroll) => ['draft', 'pending_approval', 'approved'].includes(payroll.status));
      const payrollDetailGroups = await Promise.all(activePayrolls.map((payroll) => db.getPayrollDetailsByPayroll(payroll.id)));
      const payrollDetails = payrollDetailGroups.flat();

      if (!mounted) return;
      setStats({
        totalEmployees: employees.length,
        activePayrolls: activePayrolls.length,
        pendingApprovals: approvalsResponse.ok ? (approvalsPayload.items ?? []).length : 0,
        totalGrossSalaries: payrollDetails.reduce((sum, detail) => sum + detail.grossPay, 0),
      });
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-KE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  useEffect(() => {
    let mounted = true;
    const loadCollections = async () => {
      if (!session) return;
      const [payrollData, employeeData] = await Promise.all([
        db.getPayrollsByCompany(session.companyId),
        db.getEmployeesByCompany(session.companyId),
      ]);
      if (!mounted) return;
      setPayrolls(payrollData);
      setEmployees(employeeData);
    };
    void loadCollections();
    return () => {
      mounted = false;
    };
  }, [session]);

  if (!session) {
    return null;
  }

  const latestPayroll = [...payrolls].sort((a, b) => b.payrollMonth.localeCompare(a.payrollMonth))[0];
  const departmentSummary = Object.entries(
    employees.reduce<Record<string, number>>((acc, employee) => {
      acc[employee.department] = (acc[employee.department] ?? 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const quickActions =
    session.userRole === 'employee'
      ? [
          {
            title: 'Open my profile',
            copy: 'Review your payroll identity and submit bank-detail change requests.',
            href: '/dashboard/profile',
            icon: Users,
          },
          {
            title: 'Request leave',
            copy: 'Raise time-off requests and track approval posture.',
            href: '/dashboard/leaves',
            icon: BriefcaseBusiness,
          },
          {
            title: 'Download payslips',
            copy: 'Open current and prior payroll statements.',
            href: '/dashboard/payslips',
            icon: ClipboardCheck,
          },
          {
            title: 'Open documents',
            copy: 'Review contracts, letters, and HR files linked to your record.',
            href: '/dashboard/documents',
            icon: FolderKanban,
          },
        ]
      : [
          {
            title: 'Manage employees',
            copy: 'Add headcount, update contracts, and review bank details.',
            href: '/dashboard/employees',
            icon: Users,
          },
          {
            title: 'Review leave desk',
            copy: 'Track upcoming absences before they affect payroll.',
            href: '/dashboard/leaves',
            icon: BriefcaseBusiness,
          },
          {
            title: 'Work approvals',
            copy: 'Review leave, payroll, and employee change requests from one queue.',
            href: '/dashboard/approvals',
            icon: BadgeDollarSign,
          },
          {
            title: 'Open reports',
            copy: 'Inspect payroll, tax, and disbursement summaries.',
            href: '/dashboard/reports',
            icon: ClipboardCheck,
          },
          {
            title: 'Review documents',
            copy: 'Track contracts, letters, and employee-file coverage.',
            href: '/dashboard/documents',
            icon: FolderKanban,
          },
        ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operations Overview"
        title={`Good day, ${session.userName.split(' ')[0]}.`}
        description={`Monitor payroll posture for ${session.companyName}, review workload concentration, and act on approvals before filing windows tighten.`}
        actions={
          <>
            <StatusPill label={todayLabel} tone="info" />
            {session.userRole === 'employee' ? (
              <Button asChild className="rounded-2xl px-5">
                <Link href="/dashboard/profile">
                  Open profile
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="rounded-2xl px-5">
                <Link href="/dashboard/payroll">
                  Open payroll run
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Employees"
          value={stats.totalEmployees}
          detail="Active workforce on file"
          icon={<Users className="h-5 w-5" />}
          tone="primary"
        />
        <MetricCard
          label="Open Payroll Cycles"
          value={stats.activePayrolls}
          detail="Draft, review, and approved runs"
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="accent"
        />
        <MetricCard
          label="Pending Approval"
          value={stats.pendingApprovals}
          detail="Cycles requiring leadership sign-off"
          icon={<ClipboardCheck className="h-5 w-5" />}
          tone="neutral"
        />
        <MetricCard
          label="Gross Salary Exposure"
          value={formatCurrency(stats.totalGrossSalaries)}
          detail="Across current open payrolls"
          icon={<BadgeDollarSign className="h-5 w-5" />}
          tone="primary"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="soft-panel overflow-hidden">
          <div className="hero-grid border-b border-border/60 px-6 py-6 md:px-8">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Live Runway</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-foreground">What needs attention this week</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              A fast operating summary for payroll leaders, HR operations, and finance reviewers.
            </p>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-2 md:p-8">
            <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
              <p className="text-sm font-semibold text-foreground">Latest payroll cycle</p>
              <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                {latestPayroll ? getMonthName(latestPayroll.payrollMonth) : 'No run yet'}
              </p>
              <div className="mt-4">
                <StatusPill
                  label={latestPayroll ? latestPayroll.status.replace('_', ' ') : 'Awaiting first run'}
                  tone={
                    latestPayroll?.status === 'pending_approval'
                      ? 'warning'
                      : latestPayroll?.status === 'approved' || latestPayroll?.status === 'processed'
                        ? 'success'
                        : 'neutral'
                  }
                />
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Use the payroll module to create the next cycle, move it through approval, and process employee payouts.
              </p>
            </div>

            <div className="rounded-[24px] border border-border/70 bg-card/70 p-5">
              <p className="text-sm font-semibold text-foreground">Team mix</p>
              <div className="mt-4 space-y-3">
                {departmentSummary.length > 0 ? (
                  departmentSummary.map(([department, count]) => (
                    <div key={department}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">{department}</span>
                        <span className="text-muted-foreground">{count} people</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-primary"
                          style={{ width: `${(count / Math.max(employees.length, 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No employee records yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="soft-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Quick Actions</p>
            <div className="mt-5 space-y-3">
              {[ 
                ...quickActions,
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="flex items-center gap-4 rounded-[24px] border border-border/70 bg-card/70 p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.copy}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="soft-panel p-6">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">System Posture</p>
            <div className="mt-5 space-y-4">
              {[
                ['Data services', 'Healthy', 'success' as const],
                ['Compliance calendar', stats.pendingApprovals > 0 ? 'Watch approvals' : 'On track', stats.pendingApprovals > 0 ? 'warning' as const : 'success' as const],
                ['Employee ledger', employees.length > 0 ? 'Synchronized' : 'Needs setup', employees.length > 0 ? 'info' as const : 'warning' as const],
              ].map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between rounded-[20px] border border-border/60 bg-card/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">Workspace health signal</p>
                  </div>
                  <StatusPill label={value} tone={tone} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
