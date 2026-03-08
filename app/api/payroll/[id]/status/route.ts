import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapPayroll } from '@/lib/hr/repository';

const TRANSITIONS = {
  draft: ['pending_approval'],
  pending_approval: ['draft', 'approved'],
  approved: ['processed'],
  processed: ['paid'],
  paid: [],
} satisfies Record<string, string[]>;

const ACTION_BY_STATUS = {
  draft: 'payroll_reopened',
  pending_approval: 'payroll_submitted',
  approved: 'payroll_approved',
  processed: 'payroll_processed',
  paid: 'payroll_paid',
} satisfies Record<string, string>;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const payload = await request.json();
  const nextStatus = payload.status as string | undefined;
  if (!nextStatus || !(nextStatus in TRANSITIONS)) {
    return NextResponse.json({ error: 'Invalid payroll status.' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin.schema('HR').from('payroll_runs').select('*').eq('id', id).maybeSingle();
  if (!existing || existing.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Payroll run not found.' }, { status: 404 });
  }

  if (!TRANSITIONS[existing.status].includes(nextStatus)) {
    return NextResponse.json(
      { error: `Invalid transition from ${existing.status.replace('_', ' ')} to ${nextStatus.replace('_', ' ')}.` },
      { status: 400 }
    );
  }

  if (nextStatus === 'approved' && auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can approve payroll.' }, { status: 403 });
  }

  if ((nextStatus === 'processed' || nextStatus === 'paid') && auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can process payroll.' }, { status: 403 });
  }

  if (existing.locked_at && existing.status !== 'processed') {
    return NextResponse.json({ error: 'This payroll run is locked and can no longer be changed.' }, { status: 409 });
  }

  const now = new Date().toISOString();
  if (nextStatus === 'processed') {
    const { error: detailError } = await admin
      .schema('HR')
      .from('payroll_details')
      .update({
        payment_status: 'processed',
        updated_at: now,
      })
      .eq('payroll_id', id)
      .eq('company_id', auth.session.companyId)
      .eq('payment_status', 'pending');

    if (detailError) {
      return NextResponse.json({ error: detailError.message }, { status: 400 });
    }
  }

  if (nextStatus === 'paid') {
    const { error: detailError } = await admin
      .schema('HR')
      .from('payroll_details')
      .update({
        payment_status: 'paid',
        payment_date: now,
        updated_at: now,
      })
      .eq('payroll_id', id)
      .eq('company_id', auth.session.companyId)
      .in('payment_status', ['pending', 'processed']);

    if (detailError) {
      return NextResponse.json({ error: detailError.message }, { status: 400 });
    }
  }

  const { data, error } = await admin
    .schema('HR')
    .from('payroll_runs')
    .update({
      status: nextStatus,
      approved_at: nextStatus === 'approved' ? now : existing.approved_at,
      approved_by: nextStatus === 'approved' ? auth.session.userId : existing.approved_by,
      processed_at: nextStatus === 'processed' ? now : existing.processed_at,
      processed_by: nextStatus === 'processed' ? auth.session.userId : existing.processed_by,
      locked_at: nextStatus === 'processed' ? (existing.locked_at ?? now) : existing.locked_at,
      locked_by: nextStatus === 'processed' ? (existing.locked_by ?? auth.session.userId) : existing.locked_by,
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
    action: ACTION_BY_STATUS[nextStatus],
    entity_type: 'payroll_runs',
    entity_id: data.id,
    before: {
      status: existing.status,
      approvedAt: existing.approved_at,
      processedAt: existing.processed_at,
      lockedAt: existing.locked_at,
      paymentStatus: existing.status === 'paid' ? 'paid' : existing.status === 'processed' ? 'processed' : 'pending',
    },
    after: {
      status: data.status,
      approvedAt: data.approved_at,
      processedAt: data.processed_at,
      lockedAt: data.locked_at,
      paymentStatus: nextStatus === 'paid' ? 'paid' : nextStatus === 'processed' ? 'processed' : 'pending',
    },
  });

  return NextResponse.json({ payroll: mapPayroll(data) });
}
