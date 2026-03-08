'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Shield } from 'lucide-react';
import { authService } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    companyName: '',
    registrationNumber: '',
    taxPin: '',
    nssf: '',
    nhif: '',
    address: '',
    phone: '',
    email: '',
    adminEmail: '',
    adminPassword: '',
    adminFirstName: '',
    adminLastName: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(formData.adminPassword)) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
      return;
    }

    setIsLoading(true);
    try {
      await authService.registerCompany(formData);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="app-shell hero-grid">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-6 lg:px-8">
        <div className="grid min-h-screen items-start gap-8 py-6 lg:grid-cols-[0.78fr_1.22fr]">
          <section className="soft-panel relative overflow-hidden p-7 md:p-9 lg:sticky lg:top-8">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-accent/24 via-primary/14 to-transparent" />
            <div className="relative space-y-8">
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Back to sign in
              </Link>

              <div className="space-y-4">
                <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/80">Organization Setup</p>
                <h1 className="text-4xl font-semibold tracking-[-0.05em] text-foreground md:text-5xl">
                  Launch a payroll workspace that your HR and finance teams can actually run.
                </h1>
                <p className="text-base leading-7 text-muted-foreground">
                  Create your company tenant, provision the first admin account, and launch a payroll workspace with live company data.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-border/70 bg-card/75 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Company workspace</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Registration details, statutory IDs, and organization contact points stay scoped to one company.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-card/75 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/20 text-accent-foreground">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Admin access</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        The first admin gets full payroll, reporting, and compliance access from day one.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[24px] border border-border/70 bg-card/75 p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Kenya compliance baseline</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        The workspace is pre-shaped around KRA, NHIF, and NSSF tracking flows.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="soft-panel p-7 md:p-9">
            <div className="space-y-7">
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-[-0.04em] text-foreground">Register your company</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Enter the business and administrator information required to create the tenant.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error ? (
                  <Alert variant="destructive" className="rounded-2xl border-destructive/30">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['companyName', 'Company name', 'Acme HR Ltd'],
                    ['registrationNumber', 'Registration number', 'PVT/REG/2026/001'],
                    ['taxPin', 'KRA PIN', 'A000000001Z'],
                    ['nssf', 'NSSF number', 'NSSF/2026/001'],
                    ['nhif', 'NHIF number', 'NHIF/2026/001'],
                    ['phone', 'Company phone', '+254712345678'],
                    ['email', 'Company email', 'hr@company.com'],
                    ['address', 'Address', 'Nairobi, Kenya'],
                    ['adminFirstName', 'Admin first name', 'Amina'],
                    ['adminLastName', 'Admin last name', 'Otieno'],
                    ['adminEmail', 'Admin email', 'admin@company.com'],
                    ['adminPassword', 'Admin password', 'Create a secure password'],
                  ].map(([name, label, placeholder]) => (
                    <div key={name} className={name === 'address' ? 'md:col-span-2' : ''}>
                      <Label htmlFor={name}>{label}</Label>
                      <Input
                        id={name}
                        name={name}
                        type={name.toLowerCase().includes('email') ? 'email' : name === 'adminPassword' ? 'password' : 'text'}
                        placeholder={placeholder}
                        value={formData[name as keyof typeof formData]}
                        onChange={handleChange}
                        className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                        required
                      />
                    </div>
                  ))}
                </div>

                <Button type="submit" disabled={isLoading} className="h-12 rounded-2xl px-6 text-sm font-semibold">
                  {isLoading ? 'Creating workspace...' : 'Create company workspace'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
