import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canAccessReports } from '@/lib/platform/roles';
import { listPayrollJournals } from '@/lib/platform/journals';

export async function GET() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canAccessReports(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can access payroll journals.' }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const items = await listPayrollJournals(admin, auth.session.companyId);
    return NextResponse.json({ items });
  } catch (journalError) {
    return NextResponse.json(
      { error: journalError instanceof Error ? journalError.message : 'Unable to load payroll journals.' },
      { status: 400 }
    );
  }
}
