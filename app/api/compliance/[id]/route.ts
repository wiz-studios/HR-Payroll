import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapComplianceRecord } from '@/lib/hr/repository';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  const { id } = await context.params;
  const updates = await request.json();
  const admin = createAdminClient();

  const { data: existing } = await admin.schema('HR').from('compliance_records').select('*').eq('id', id).maybeSingle();
  if (!existing || existing.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Compliance record not found.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .schema('HR')
    .from('compliance_records')
    .update({
      status: updates.status,
      submission_date: updates.status === 'submitted' ? now : existing.submission_date,
      response_date: updates.status === 'accepted' || updates.status === 'rejected' ? now : existing.response_date,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to update compliance record.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'compliance_record_updated',
    entity_type: 'compliance_records',
    entity_id: data.id,
    before: existing,
    after: data,
  });

  return NextResponse.json({ record: mapComplianceRecord(data) });
}
