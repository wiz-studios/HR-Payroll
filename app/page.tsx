'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CalendarCheck2, ShieldCheck, WalletCards } from 'lucide-react';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const highlights = [
  {
    title: 'Kenya-first payroll logic',
    description: 'PAYE, NHIF, NSSF, and relief calculations tuned for local payroll operations.',
    icon: WalletCards,
  },
  {
    title: 'Operational HR workspace',
    description: 'Employees, leave, approvals, and filing workflows in one secure interface.',
    icon: CalendarCheck2,
  },
  {
    title: 'Audit-friendly records',
    description: 'Trace payroll cycles, ownership, and compliance status from a single dashboard.',
    icon: ShieldCheck,
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await authService.login({ email, password });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="app-shell hero-grid">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col justify-center px-4 py-8 md:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="soft-panel relative overflow-hidden p-7 md:p-10 lg:p-14">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-primary/14 via-accent/18 to-transparent" />
            <div className="relative space-y-10">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-card/75 px-4 py-2 text-sm text-muted-foreground">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  Kenya HR and Payroll Operating System
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.06em] text-foreground md:text-6xl">
                    Payroll operations that feel like a control room, not a spreadsheet.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                    PayrollKE gives HR, finance, and operations teams a sharper workspace for employee records,
                    monthly payroll, compliance deadlines, and payslip delivery.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-[24px] border border-border/70 bg-card/70 p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h2 className="mt-5 text-lg font-semibold tracking-[-0.03em] text-foreground">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[28px] border border-border/70 bg-secondary/55 p-5 md:p-6">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">Production Ready Path</p>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  Sign in with a Supabase-backed account tied to a company workspace. Demo bootstrap data has been removed.
                </p>
              </div>
            </div>
          </section>

          <section className="soft-panel mx-auto w-full max-w-xl p-7 md:p-9">
            <div className="space-y-7">
              <div className="space-y-3">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Sign In</p>
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Enter the payroll workspace</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Authenticate to access employee records, payroll cycles, and compliance dashboards.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error ? (
                  <Alert variant="destructive" className="rounded-2xl border-destructive/30">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="h-12 rounded-2xl border-border/70 bg-card"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="h-12 rounded-2xl border-border/70 bg-card"
                    required
                  />
                </div>

                <Button type="submit" disabled={isLoading} className="h-12 w-full rounded-2xl text-sm font-semibold">
                  {isLoading ? 'Signing in...' : 'Continue to dashboard'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>

              <div className="rounded-[24px] border border-border/70 bg-card/70 p-5 text-sm text-muted-foreground">
                Setting up a new organization?
                <Link href="/register" className="ml-2 font-semibold text-primary transition hover:text-primary/80">
                  Register your company
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
