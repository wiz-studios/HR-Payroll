import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapPayroll } from '@/lib/hr/repository';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const payload = await request.json();
  const admin = createAdminClient();

  const { data: existing } = await admin.schema('HR').from('payroll_runs').select('*').eq('id', id).maybeSingle();
  if (!existing || existing.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Payroll run not found.' }, { status: 404 });
  }

  if (payload.status === 'approved' && auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can approve payroll.' }, { status: 403 });
  }

  if (payload.status === 'processed' && auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can process payroll.' }, { status: 403 });
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .schema('HR')
    .from('payroll_runs')
    .update({
      status: payload.status,
      approved_at: payload.status === 'approved' ? now : existing.approved_at,
      approved_by: payload.status === 'approved' ? auth.session.userId : existing.approved_by,
      processed_at: payload.status === 'processed' ? now : existing.processed_at,
      processed_by: payload.status === 'processed' ? auth.session.userId : existing.processed_by,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to update payroll status.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'payroll_status_updated',
    entity_type: 'payroll_runs',
    entity_id: data.id,
    before: existing,
    after: data,
  });

  return NextResponse.json({ payroll: mapPayroll(data) });
}
