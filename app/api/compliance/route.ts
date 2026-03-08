import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapComplianceRecord } from '@/lib/hr/repository';

export async function POST(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  const payload = await request.json();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .schema('HR')
    .from('compliance_records')
    .insert({
      company_id: auth.session.companyId,
      record_type: payload.recordType,
      authority: payload.authority,
      period: payload.period,
      status: payload.status ?? 'pending',
      details: payload.details ?? {},
      created_by: auth.session.userId,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to create compliance record.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'compliance_record_created',
    entity_type: 'compliance_records',
    entity_id: data.id,
    after: data,
  });

  return NextResponse.json({ record: mapComplianceRecord(data) });
}
