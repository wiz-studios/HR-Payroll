'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface DashboardLayoutProps {
  children: ReactNode;
}

const navItems = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager', 'employee'] },
  { label: 'Employees', path: '/dashboard/employees', icon: Users, roles: ['admin', 'manager'] },
  { label: 'Leave Desk', path: '/dashboard/leaves', icon: BriefcaseBusiness, roles: ['admin', 'manager'] },
  { label: 'Payroll Run', path: '/dashboard/payroll', icon: CircleDollarSign, roles: ['admin', 'manager'] },
  { label: 'Reports', path: '/dashboard/reports', icon: FileBarChart2, roles: ['admin', 'manager'] },
  { label: 'Compliance', path: '/dashboard/compliance', icon: ClipboardCheck, roles: ['admin'] },
  { label: 'Settings', path: '/dashboard/settings', icon: Settings, roles: ['admin'] },
];

function Sidebar({
  pathname,
  session,
  collapsed,
  onToggle,
  onNavigate,
}: {
  pathname: string;
  session: AuthSession;
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}) {
  const visibleNavItems = navItems.filter((item) => item.roles.includes(session.userRole));

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground',
        collapsed ? 'w-[92px]' : 'w-[280px]'
      )}
    >
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/10">
            <Sparkles className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-sidebar-foreground/60">PayrollKE</p>
              <p className="truncate text-sm font-semibold">{session.companyName}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="px-4 py-5">
        {!collapsed ? (
          <div className="rounded-3xl border border-sidebar-border bg-sidebar-accent p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-sidebar-foreground/55">Command Center</p>
            <p className="mt-2 text-sm font-medium leading-6 text-sidebar-foreground">
              Review salaries, exceptions, and filing deadlines from one workspace.
            </p>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2 px-3">
        {visibleNavItems.map((item) => {
          const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={onNavigate}
              className={cn(
                'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/10'
                  : 'text-sidebar-foreground/72 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-2xl transition-colors',
                  active ? 'bg-black/10' : 'bg-white/5 group-hover:bg-white/10'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              {!collapsed ? <span>{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-border px-3 py-4">
        <Button
          variant="ghost"
          className="w-full justify-start rounded-2xl px-4 py-6 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onToggle}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed ? <span>Collapse navigation</span> : null}
        </Button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      router.push('/');
      return;
    }

    const currentSession = authService.getSession(token);
    if (!currentSession) {
      localStorage.removeItem('sessionToken');
      router.push('/');
      return;
    }

    setSession(currentSession);
    setIsLoading(false);
  }, [router]);

  const activeItem = useMemo(
    () => navItems.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`)),
    [pathname]
  );

  const handleLogout = () => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      authService.logout(token);
      localStorage.removeItem('sessionToken');
    }
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="app-shell flex items-center justify-center p-6">
        <div className="soft-panel flex w-full max-w-sm items-center gap-3 p-6">
          <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const initials = session.userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell">
      <div className="flex min-h-screen">
        <div className="hidden lg:block">
          <Sidebar
            pathname={pathname}
            session={session}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((value) => !value)}
          />
        </div>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/88 backdrop-blur-xl">
            <div className="mx-auto flex w-full max-w-[1600px] items-center gap-4 px-4 py-4 md:px-6 lg:px-8">
              <div className="flex flex-1 items-center gap-3">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                  <SheetTrigger asChild className="lg:hidden">
                    <Button variant="outline" size="icon" className="rounded-2xl border-border/70 bg-card/80">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[310px] border-border bg-sidebar p-0 text-sidebar-foreground">
                    <Sidebar
                      pathname={pathname}
                      session={session}
                      collapsed={false}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </SheetContent>
                </Sheet>

                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                    {session.companyName}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <h1 className="text-lg font-semibold tracking-[-0.03em] text-foreground md:text-xl">
                      {activeItem?.label ?? 'PayrollKE'}
                    </h1>
                    <span className="hidden rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-foreground sm:inline-flex">
                      {session.userRole}
                    </span>
                  </div>
                </div>
              </div>

              <div className="hidden items-center gap-2 md:flex">
                <Button variant="outline" size="icon" className="rounded-2xl border-border/70 bg-card/70">
                  <Bell className="h-4 w-4" />
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto rounded-2xl border border-border/70 bg-card/80 px-2 py-2 shadow-sm hover:bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/12 text-sm font-semibold text-primary">
                        {initials}
                      </div>
                      <div className="hidden text-left sm:block">
                        <p className="text-sm font-semibold text-foreground">{session.userName}</p>
                        <p className="text-xs text-muted-foreground">{session.userEmail}</p>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 rounded-2xl border-border/70">
                  <DropdownMenuLabel className="space-y-1 p-4">
                    <p className="text-sm font-semibold text-foreground">{session.userName}</p>
                    <p className="text-xs text-muted-foreground">{session.companyName}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <Building2 className="mr-2 h-4 w-4" />
                    Company profile
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <UserRound className="mr-2 h-4 w-4" />
                    Access policy
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 lg:px-8 lg:py-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
