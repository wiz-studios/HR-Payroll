import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog } from '@/lib/hr/repository';
import { getJournalAccountConfig, saveJournalAccountConfig } from '@/lib/platform/journals';

export async function GET() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!['admin', 'manager'].includes(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can access journal accounts.' }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const config = await getJournalAccountConfig(admin, auth.session.companyId);
    return NextResponse.json({ config });
  } catch (configError) {
    return NextResponse.json(
      { error: configError instanceof Error ? configError.message : 'Unable to load journal account mapping.' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can update journal accounts.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const updates = await request.json();

  try {
    const before = await getJournalAccountConfig(admin, auth.session.companyId);
    const config = await saveJournalAccountConfig(admin, auth.session.companyId, auth.session.userId, updates);

    await insertAuditLog(admin, {
      company_id: auth.session.companyId,
      actor_user_id: auth.session.userId,
      action: 'journal_accounts_updated',
      entity_type: 'payroll.journal_account_configs',
      entity_id: auth.session.companyId,
      before,
      after: config,
    });

    return NextResponse.json({ config });
  } catch (configError) {
    return NextResponse.json(
      { error: configError instanceof Error ? configError.message : 'Unable to update journal account mapping.' },
      { status: 400 }
    );
  }
}
