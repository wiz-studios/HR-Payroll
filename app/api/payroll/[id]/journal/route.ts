import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getPayrollJournal } from '@/lib/platform/journals';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!['admin', 'manager'].includes(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can access payroll journals.' }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  try {
    const journal = await getPayrollJournal(admin, auth.session.companyId, id);
    return NextResponse.json(journal);
  } catch (journalError) {
    return NextResponse.json(
      { error: journalError instanceof Error ? journalError.message : 'Unable to load payroll journal.' },
      { status: 400 }
    );
  }
}
