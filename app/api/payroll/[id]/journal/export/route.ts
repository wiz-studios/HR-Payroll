import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canAccessReports } from '@/lib/platform/roles';
import { exportPayrollJournalCsv, getPayrollJournal } from '@/lib/platform/journals';

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canAccessReports(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can export payroll journals.' }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  try {
    const { entries, summary } = await getPayrollJournal(admin, auth.session.companyId, id);
    const csv = exportPayrollJournalCsv(entries);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${summary.payPeriodLabel}-payroll-journal.csv"`,
      },
    });
  } catch (journalError) {
    return NextResponse.json(
      { error: journalError instanceof Error ? journalError.message : 'Unable to export payroll journal.' },
      { status: 400 }
    );
  }
}
