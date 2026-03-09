import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapLeaveRequest } from '@/lib/hr/repository';
import { createLeaveApprovalRequest, getLeaveApprovalRequests } from '@/lib/platform/workflow';

export async function POST(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  const payload = await request.json();
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .schema('HR')
    .from('leave_requests')
    .insert({
      company_id: auth.session.companyId,
      employee_id: payload.employeeId,
      leave_type: payload.leaveType,
      start_date: payload.startDate,
      end_date: payload.endDate,
      days: payload.days,
      status: 'pending',
      reason: payload.reason,
      created_by: auth.session.userId,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to create leave request.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'leave_request_created',
    entity_type: 'leave_requests',
    entity_id: data.id,
    after: data,
  });

  try {
    await createLeaveApprovalRequest(admin, auth.session.companyId, data.id, auth.session.userId);
    const requests = await getLeaveApprovalRequests(admin, auth.session.companyId, data.id);
    return NextResponse.json({ leaveRequest: mapLeaveRequest(data), requests });
  } catch (workflowError) {
    return NextResponse.json(
      {
        error: workflowError instanceof Error ? workflowError.message : 'Leave request was created but workflow setup failed.',
      },
      { status: 400 }
    );
  }
}
