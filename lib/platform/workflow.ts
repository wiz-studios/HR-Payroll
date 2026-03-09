import type { SupabaseClient } from '@supabase/supabase-js';
import { insertAuditLog } from '@/lib/hr/repository';
import { getEmployeeEnterpriseContext, syncEmployeeToEnterprise } from '@/lib/platform/sync';

type UntypedClient = SupabaseClient<any, any, any>;

type RequestType = 'compensation' | 'bank_details' | 'employment';

interface ChangeRequestPayload {
  requestType: RequestType;
  effectiveFrom: string;
  reason: string;
  changes: Record<string, unknown>;
}

interface PayrollApprovalPayload {
  payrollId: string;
  payrollMonth: string;
  currentStatus: string;
  reason: string;
}

interface LeaveApprovalPayload {
  leaveRequestId: string;
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
}

async function ensureEmployeeChangeDefinition(client: UntypedClient, companyId: string) {
  const { data: existing, error } = await client
    .schema('workflow')
    .from('approval_definitions')
    .select('id')
    .eq('company_id', companyId)
    .eq('workflow_key', 'employee_change_request')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing?.id) return existing.id as string;

  const { data: definition, error: definitionError } = await client
    .schema('workflow')
    .from('approval_definitions')
    .insert({
      company_id: companyId,
      workflow_key: 'employee_change_request',
      name: 'Employee Change Request',
      entity_type: 'employee_change_request',
      trigger_event: 'employee_change_submitted',
      conditions: {},
      is_active: true,
      version: 1,
    })
    .select('id')
    .single();

  if (definitionError || !definition) {
    throw new Error(definitionError?.message ?? 'Unable to create approval definition.');
  }

  const { error: stepError } = await client.schema('workflow').from('approval_steps').insert({
    definition_id: definition.id,
    step_order: 1,
    approver_role: 'company_admin',
    approver_scope: 'company',
    min_approvals: 1,
  });

  if (stepError) {
    throw new Error(stepError.message);
  }

  return definition.id as string;
}

async function ensurePayrollApprovalDefinition(client: UntypedClient, companyId: string) {
  const { data: existing, error } = await client
    .schema('workflow')
    .from('approval_definitions')
    .select('id')
    .eq('company_id', companyId)
    .eq('workflow_key', 'payroll_approval')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing?.id) return existing.id as string;

  const { data: definition, error: definitionError } = await client
    .schema('workflow')
    .from('approval_definitions')
    .insert({
      company_id: companyId,
      workflow_key: 'payroll_approval',
      name: 'Payroll Approval',
      entity_type: 'payroll_approval',
      trigger_event: 'payroll_submitted_for_approval',
      conditions: {},
      is_active: true,
      version: 1,
    })
    .select('id')
    .single();

  if (definitionError || !definition) {
    throw new Error(definitionError?.message ?? 'Unable to create payroll approval definition.');
  }

  const { error: stepError } = await client.schema('workflow').from('approval_steps').insert({
    definition_id: definition.id,
    step_order: 1,
    approver_role: 'company_admin',
    approver_scope: 'company',
    min_approvals: 1,
  });

  if (stepError) throw new Error(stepError.message);

  return definition.id as string;
}

async function ensureLeaveApprovalDefinition(client: UntypedClient, companyId: string) {
  const { data: existing, error } = await client
    .schema('workflow')
    .from('approval_definitions')
    .select('id')
    .eq('company_id', companyId)
    .eq('workflow_key', 'leave_approval')
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (existing?.id) return existing.id as string;

  const { data: definition, error: definitionError } = await client
    .schema('workflow')
    .from('approval_definitions')
    .insert({
      company_id: companyId,
      workflow_key: 'leave_approval',
      name: 'Leave Approval',
      entity_type: 'leave_approval',
      trigger_event: 'leave_submitted_for_approval',
      conditions: {},
      is_active: true,
      version: 1,
    })
    .select('id')
    .single();

  if (definitionError || !definition) {
    throw new Error(definitionError?.message ?? 'Unable to create leave approval definition.');
  }

  const { error: stepError } = await client.schema('workflow').from('approval_steps').insert({
    definition_id: definition.id,
    step_order: 1,
    approver_role: 'hr_manager',
    approver_scope: 'company',
    min_approvals: 1,
  });

  if (stepError) throw new Error(stepError.message);

  return definition.id as string;
}

export async function createEmployeeChangeRequest(
  client: UntypedClient,
  companyId: string,
  employeeId: string,
  requestedBy: string,
  payload: ChangeRequestPayload
) {
  const definitionId = await ensureEmployeeChangeDefinition(client, companyId);
  const now = new Date().toISOString();

  const { data: instance, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .insert({
      company_id: companyId,
      definition_id: definitionId,
      entity_type: 'employee_change_request',
      entity_id: employeeId,
      status: 'pending',
      requested_by: requestedBy,
      current_step_order: 1,
      payload,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error || !instance) {
    throw new Error(error?.message ?? 'Unable to create employee change request.');
  }

  const { error: actionError } = await client.schema('workflow').from('approval_actions').insert({
    instance_id: instance.id,
    action: 'submitted',
    actor_user_id: requestedBy,
    comments: payload.reason,
    created_at: now,
  });

  if (actionError) {
    throw new Error(actionError.message);
  }

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: requestedBy,
    action: 'employee_change_requested',
    entity_type: 'workflow.approval_instances',
    entity_id: instance.id,
    after: payload,
  });

  return instance.id as string;
}

export async function createPayrollApprovalRequest(
  client: UntypedClient,
  companyId: string,
  payrollId: string,
  requestedBy: string,
  reason: string
) {
  const definitionId = await ensurePayrollApprovalDefinition(client, companyId);
  const { data: payroll, error: payrollError } = await client
    .schema('HR')
    .from('payroll_runs')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', payrollId)
    .single();

  if (payrollError || !payroll) {
    throw new Error(payrollError?.message ?? 'Payroll run not found.');
  }
  if (payroll.status !== 'draft') {
    throw new Error('Only draft payroll runs can be submitted for approval.');
  }

  const { data: pending } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id')
    .eq('company_id', companyId)
    .eq('entity_type', 'payroll_approval')
    .eq('entity_id', payrollId)
    .eq('status', 'pending')
    .maybeSingle();

  if (pending?.id) {
    throw new Error('This payroll run already has a pending approval request.');
  }

  const now = new Date().toISOString();
  const { error: payrollUpdateError } = await client
    .schema('HR')
    .from('payroll_runs')
    .update({
      status: 'pending_approval',
      updated_at: now,
    })
    .eq('id', payrollId);

  if (payrollUpdateError) throw new Error(payrollUpdateError.message);

  const payload: PayrollApprovalPayload = {
    payrollId,
    payrollMonth: payroll.payroll_month as string,
    currentStatus: 'pending_approval',
    reason,
  };

  const { data: instance, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .insert({
      company_id: companyId,
      definition_id: definitionId,
      entity_type: 'payroll_approval',
      entity_id: payrollId,
      status: 'pending',
      requested_by: requestedBy,
      current_step_order: 1,
      payload,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error || !instance) {
    throw new Error(error?.message ?? 'Unable to create payroll approval request.');
  }

  const { error: actionError } = await client.schema('workflow').from('approval_actions').insert({
    instance_id: instance.id,
    action: 'submitted',
    actor_user_id: requestedBy,
    comments: reason,
    created_at: now,
  });

  if (actionError) throw new Error(actionError.message);

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: requestedBy,
    action: 'payroll_submitted',
    entity_type: 'payroll_runs',
    entity_id: payrollId,
    before: { status: 'draft' },
    after: { status: 'pending_approval', requestId: instance.id },
  });

  return instance.id as string;
}

export async function createLeaveApprovalRequest(
  client: UntypedClient,
  companyId: string,
  leaveRequestId: string,
  requestedBy: string
) {
  const definitionId = await ensureLeaveApprovalDefinition(client, companyId);
  const { data: leaveRequest, error: leaveError } = await client
    .schema('HR')
    .from('leave_requests')
    .select('*')
    .eq('company_id', companyId)
    .eq('id', leaveRequestId)
    .single();

  if (leaveError || !leaveRequest) {
    throw new Error(leaveError?.message ?? 'Leave request not found.');
  }
  if (leaveRequest.status !== 'pending') {
    throw new Error('Only pending leave requests can enter approval workflow.');
  }

  const { data: pending } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id')
    .eq('company_id', companyId)
    .eq('entity_type', 'leave_approval')
    .eq('entity_id', leaveRequestId)
    .eq('status', 'pending')
    .maybeSingle();

  if (pending?.id) return pending.id as string;

  const now = new Date().toISOString();
  const payload: LeaveApprovalPayload = {
    leaveRequestId,
    employeeId: leaveRequest.employee_id as string,
    leaveType: leaveRequest.leave_type as string,
    startDate: leaveRequest.start_date as string,
    endDate: leaveRequest.end_date as string,
    days: Number(leaveRequest.days),
    reason: leaveRequest.reason as string,
  };

  const { data: instance, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .insert({
      company_id: companyId,
      definition_id: definitionId,
      entity_type: 'leave_approval',
      entity_id: leaveRequestId,
      status: 'pending',
      requested_by: requestedBy,
      current_step_order: 1,
      payload,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error || !instance) {
    throw new Error(error?.message ?? 'Unable to create leave approval request.');
  }

  const { error: actionError } = await client.schema('workflow').from('approval_actions').insert({
    instance_id: instance.id,
    action: 'submitted',
    actor_user_id: requestedBy,
    comments: leaveRequest.reason as string,
    created_at: now,
  });

  if (actionError) throw new Error(actionError.message);

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: requestedBy,
    action: 'leave_request_submitted',
    entity_type: 'leave_requests',
    entity_id: leaveRequestId,
    after: payload,
  });

  return instance.id as string;
}

export async function getPayrollApprovalRequests(client: UntypedClient, companyId: string, payrollId: string) {
  const { data: instances, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id,status,requested_by,current_step_order,payload,created_at,updated_at')
    .eq('company_id', companyId)
    .eq('entity_type', 'payroll_approval')
    .eq('entity_id', payrollId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const instanceIds = (instances ?? []).map((instance) => instance.id as string);
  const { data: actions, error: actionsError } = await client
    .schema('workflow')
    .from('approval_actions')
    .select('instance_id,action,actor_user_id,comments,created_at')
    .in('instance_id', instanceIds.length > 0 ? instanceIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at');

  if (actionsError) throw new Error(actionsError.message);

  return (instances ?? []).map((instance) => ({
    id: instance.id as string,
    status: instance.status as string,
    requestedBy: instance.requested_by as string | null,
    currentStepOrder: Number(instance.current_step_order ?? 1),
    payload: (instance.payload as PayrollApprovalPayload) ?? null,
    createdAt: instance.created_at as string,
    updatedAt: instance.updated_at as string,
    actions: (actions ?? [])
      .filter((action) => action.instance_id === instance.id)
      .map((action) => ({
        action: action.action as string,
        actorUserId: action.actor_user_id as string | null,
        comments: action.comments as string | null,
        createdAt: action.created_at as string,
      })),
  }));
}

export async function getLeaveApprovalRequests(client: UntypedClient, companyId: string, leaveRequestId: string) {
  const { data: instances, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id,status,requested_by,current_step_order,payload,created_at,updated_at')
    .eq('company_id', companyId)
    .eq('entity_type', 'leave_approval')
    .eq('entity_id', leaveRequestId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const instanceIds = (instances ?? []).map((instance) => instance.id as string);
  const { data: actions, error: actionsError } = await client
    .schema('workflow')
    .from('approval_actions')
    .select('instance_id,action,actor_user_id,comments,created_at')
    .in('instance_id', instanceIds.length > 0 ? instanceIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at');

  if (actionsError) throw new Error(actionsError.message);

  return (instances ?? []).map((instance) => ({
    id: instance.id as string,
    status: instance.status as string,
    requestedBy: instance.requested_by as string | null,
    currentStepOrder: Number(instance.current_step_order ?? 1),
    payload: (instance.payload as LeaveApprovalPayload) ?? null,
    createdAt: instance.created_at as string,
    updatedAt: instance.updated_at as string,
    actions: (actions ?? [])
      .filter((action) => action.instance_id === instance.id)
      .map((action) => ({
        action: action.action as string,
        actorUserId: action.actor_user_id as string | null,
        comments: action.comments as string | null,
        createdAt: action.created_at as string,
      })),
  }));
}

export async function reviewPayrollApprovalRequest(
  client: UntypedClient,
  companyId: string,
  actorUserId: string,
  requestId: string,
  decision: 'approved' | 'rejected',
  comments?: string
) {
  const { data: instance, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id,entity_id,status,payload')
    .eq('company_id', companyId)
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!instance) throw new Error('Approval request not found.');
  if (instance.status !== 'pending') throw new Error('Only pending approval requests can be reviewed.');

  const payrollId = String(instance.entity_id);
  const now = new Date().toISOString();
  const nextStatus = decision === 'approved' ? 'approved' : 'draft';

  const { error: payrollUpdateError } = await client
    .schema('HR')
    .from('payroll_runs')
    .update({
      status: nextStatus,
      approved_at: decision === 'approved' ? now : null,
      approved_by: decision === 'approved' ? actorUserId : null,
      updated_at: now,
    })
    .eq('company_id', companyId)
    .eq('id', payrollId);

  if (payrollUpdateError) throw new Error(payrollUpdateError.message);

  const { error: instanceUpdateError } = await client
    .schema('workflow')
    .from('approval_instances')
    .update({
      status: decision,
      updated_at: now,
    })
    .eq('id', requestId);

  if (instanceUpdateError) throw new Error(instanceUpdateError.message);

  const { error: actionError } = await client.schema('workflow').from('approval_actions').insert({
    instance_id: requestId,
    action: decision,
    actor_user_id: actorUserId,
    comments: comments ?? null,
    created_at: now,
  });

  if (actionError) throw new Error(actionError.message);

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: actorUserId,
    action: decision === 'approved' ? 'payroll_approved' : 'payroll_reopened',
    entity_type: 'payroll_runs',
    entity_id: payrollId,
    before: { status: 'pending_approval' },
    after: { status: nextStatus, requestId },
  });
}

export async function reviewLeaveApprovalRequest(
  client: UntypedClient,
  companyId: string,
  actorUserId: string,
  requestId: string,
  decision: 'approved' | 'rejected',
  comments?: string
) {
  const { data: instance, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id,entity_id,status,payload')
    .eq('company_id', companyId)
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!instance) throw new Error('Leave approval request not found.');
  if (instance.status !== 'pending') throw new Error('Only pending leave approvals can be reviewed.');

  const leaveRequestId = String(instance.entity_id);
  const now = new Date().toISOString();
  const leaveStatus = decision === 'approved' ? 'approved' : 'rejected';

  const { error: leaveUpdateError } = await client
    .schema('HR')
    .from('leave_requests')
    .update({
      status: leaveStatus,
      approved_by: decision === 'approved' ? actorUserId : null,
      approved_at: decision === 'approved' ? now : null,
      updated_at: now,
    })
    .eq('company_id', companyId)
    .eq('id', leaveRequestId);

  if (leaveUpdateError) throw new Error(leaveUpdateError.message);

  const { error: instanceUpdateError } = await client
    .schema('workflow')
    .from('approval_instances')
    .update({
      status: decision,
      updated_at: now,
    })
    .eq('id', requestId);

  if (instanceUpdateError) throw new Error(instanceUpdateError.message);

  const { error: actionError } = await client.schema('workflow').from('approval_actions').insert({
    instance_id: requestId,
    action: decision,
    actor_user_id: actorUserId,
    comments: comments ?? null,
    created_at: now,
  });

  if (actionError) throw new Error(actionError.message);

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: actorUserId,
    action: decision === 'approved' ? 'leave_request_approved' : 'leave_request_rejected',
    entity_type: 'leave_requests',
    entity_id: leaveRequestId,
    before: { status: 'pending' },
    after: { status: leaveStatus, requestId },
  });
}

export async function getCompanyApprovalInbox(client: UntypedClient, companyId: string) {
  const { data: instances, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id,entity_type,entity_id,status,payload,requested_by,created_at,updated_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const instanceIds = (instances ?? []).map((instance) => instance.id as string);
  const { data: actions, error: actionsError } = await client
    .schema('workflow')
    .from('approval_actions')
    .select('instance_id,action,actor_user_id,comments,created_at')
    .in('instance_id', instanceIds.length > 0 ? instanceIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at');

  if (actionsError) throw new Error(actionsError.message);

  return (instances ?? []).map((instance) => ({
    id: instance.id as string,
    entityType: instance.entity_type as string,
    entityId: instance.entity_id as string,
    status: instance.status as string,
    requestedBy: instance.requested_by as string | null,
    payload: (instance.payload as Record<string, unknown>) ?? {},
    createdAt: instance.created_at as string,
    updatedAt: instance.updated_at as string,
    actions: (actions ?? [])
      .filter((action) => action.instance_id === instance.id)
      .map((action) => ({
        action: action.action as string,
        actorUserId: action.actor_user_id as string | null,
        comments: action.comments as string | null,
        createdAt: action.created_at as string,
      })),
  }));
}

export async function getEmployeeChangeRequests(client: UntypedClient, companyId: string, employeeId: string) {
  const { data: instances, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id,status,requested_by,current_step_order,payload,created_at,updated_at')
    .eq('company_id', companyId)
    .eq('entity_type', 'employee_change_request')
    .eq('entity_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const instanceIds = (instances ?? []).map((instance) => instance.id as string);
  const { data: actions, error: actionsError } = await client
    .schema('workflow')
    .from('approval_actions')
    .select('instance_id,action,actor_user_id,comments,created_at')
    .in('instance_id', instanceIds.length > 0 ? instanceIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at');

  if (actionsError) throw new Error(actionsError.message);

  return (instances ?? []).map((instance) => ({
    id: instance.id as string,
    status: instance.status as string,
    requestedBy: instance.requested_by as string | null,
    currentStepOrder: Number(instance.current_step_order ?? 1),
    payload: (instance.payload as ChangeRequestPayload) ?? null,
    createdAt: instance.created_at as string,
    updatedAt: instance.updated_at as string,
    actions: (actions ?? [])
      .filter((action) => action.instance_id === instance.id)
      .map((action) => ({
        action: action.action as string,
        actorUserId: action.actor_user_id as string | null,
        comments: action.comments as string | null,
        createdAt: action.created_at as string,
      })),
  }));
}

export async function reviewEmployeeChangeRequest(
  client: UntypedClient,
  companyId: string,
  actorUserId: string,
  instanceId: string,
  decision: 'approved' | 'rejected',
  comments?: string
) {
  const { data: instance, error } = await client
    .schema('workflow')
    .from('approval_instances')
    .select('id,entity_id,status,payload')
    .eq('company_id', companyId)
    .eq('id', instanceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!instance) throw new Error('Change request not found.');
  if (instance.status !== 'pending') throw new Error('Only pending requests can be reviewed.');

  const payload = (instance.payload as ChangeRequestPayload | null) ?? null;
  if (!payload) throw new Error('Change request payload is missing.');

  if (decision === 'approved') {
    await applyApprovedEmployeeChangeRequest(client, companyId, String(instance.entity_id), payload);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await client
    .schema('workflow')
    .from('approval_instances')
    .update({
      status: decision,
      updated_at: now,
    })
    .eq('id', instanceId);

  if (updateError) throw new Error(updateError.message);

  const { error: actionError } = await client.schema('workflow').from('approval_actions').insert({
    instance_id: instanceId,
    action: decision,
    actor_user_id: actorUserId,
    comments: comments ?? null,
    created_at: now,
  });

  if (actionError) throw new Error(actionError.message);

  await insertAuditLog(client as never, {
    company_id: companyId,
    actor_user_id: actorUserId,
    action: decision === 'approved' ? 'employee_change_approved' : 'employee_change_rejected',
    entity_type: 'workflow.approval_instances',
    entity_id: instanceId,
    before: payload,
    after: { decision, comments: comments ?? null },
  });
}

async function applyApprovedEmployeeChangeRequest(
  client: UntypedClient,
  companyId: string,
  employeeId: string,
  payload: ChangeRequestPayload
) {
  const { data: employee, error } = await client.schema('HR').from('employees').select('*').eq('id', employeeId).eq('company_id', companyId).single();
  if (error || !employee) {
    throw new Error(error?.message ?? 'Employee not found.');
  }

  const currentOrganization = await getEmployeeEnterpriseContext(client, companyId, employeeId);
  const changeSet = payload.changes ?? {};
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.requestType === 'compensation') {
    updatePayload.base_salary = Number(changeSet.baseSalary ?? employee.base_salary);
    updatePayload.allowances = (changeSet.allowances as Record<string, number> | undefined) ?? employee.allowances;
    updatePayload.deductions = (changeSet.deductions as Record<string, number> | undefined) ?? employee.deductions;
  } else if (payload.requestType === 'bank_details') {
    updatePayload.bank_name = String(changeSet.bankName ?? employee.bank_name);
    updatePayload.bank_code = String(changeSet.bankCode ?? employee.bank_code);
    updatePayload.account_number = String(changeSet.accountNumber ?? employee.account_number);
  } else {
    updatePayload.department = String(changeSet.departmentName ?? employee.department);
    updatePayload.position = String(changeSet.position ?? employee.position);
    updatePayload.employment_type = String(changeSet.employmentType ?? employee.employment_type);
  }

  const { data: updatedEmployee, error: updateError } = await client
    .schema('HR')
    .from('employees')
    .update(updatePayload)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (updateError || !updatedEmployee) {
    throw new Error(updateError?.message ?? 'Unable to apply employee change.');
  }

  await syncEmployeeToEnterprise(client, updatedEmployee, {
    branchId: String(changeSet.branchId ?? currentOrganization.branchId ?? '') || undefined,
    departmentId: String(changeSet.departmentId ?? currentOrganization.departmentId ?? '') || undefined,
    costCenterId: String(changeSet.costCenterId ?? currentOrganization.costCenterId ?? '') || undefined,
    payrollGroupId: String(changeSet.payrollGroupId ?? currentOrganization.payrollGroupId ?? '') || undefined,
    jobGrade: String(changeSet.jobGrade ?? currentOrganization.jobGrade ?? '') || undefined,
    workLocation: String(changeSet.workLocation ?? currentOrganization.workLocation ?? '') || undefined,
    effectiveFrom: payload.effectiveFrom,
  });
}
