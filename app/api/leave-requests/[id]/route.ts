import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapLeaveRequest } from '@/lib/hr/repository';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  const { id } = await context.params;
  const updates = await request.json();
  const admin = createAdminClient();

  const { data: existing } = await admin.schema('HR').from('leave_requests').select('*').eq('id', id).maybeSingle();
  if (!existing || existing.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Leave request not found.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data, error } = await admin
    .schema('HR')
    .from('leave_requests')
    .update({
      status: updates.status,
      approved_by: updates.status === 'approved' ? auth.session.userId : existing.approved_by,
      approved_at: updates.status === 'approved' ? now : existing.approved_at,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to update leave request.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'leave_request_updated',
    entity_type: 'leave_requests',
    entity_id: data.id,
    before: existing,
    after: data,
  });

  return NextResponse.json({ leaveRequest: mapLeaveRequest(data) });
}
