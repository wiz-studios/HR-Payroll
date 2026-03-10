import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import {
  canAccessApprovalsInbox,
  canReviewEmployeeChangeRequests,
  canReviewLeaveApprovals,
  canReviewPayrollApprovals,
} from '@/lib/platform/roles';
import { getCompanyApprovalInbox } from '@/lib/platform/workflow';

interface ApprovalAction {
  action: string;
  actorUserId: string | null;
  comments: string | null;
  createdAt: string;
}

export async function GET(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canAccessApprovalsInbox(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can access the approvals inbox.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');

  try {
    const rawItems = await getCompanyApprovalInbox(admin, auth.session.companyId);
    const filteredItems = statusFilter ? rawItems.filter((item) => item.status === statusFilter) : rawItems;

    const employeeIds = new Set<string>();
    const payrollIds = new Set<string>();

    filteredItems.forEach((item) => {
      if (item.entityType === 'employee_change_request') {
        employeeIds.add(item.entityId);
      }
      if (item.entityType === 'leave_approval') {
        const employeeId = typeof item.payload.employeeId === 'string' ? item.payload.employeeId : null;
        if (employeeId) employeeIds.add(employeeId);
      }
      if (item.entityType === 'payroll_approval') {
        payrollIds.add(item.entityId);
      }
    });

    const [{ data: employees, error: employeeError }, { data: payrolls, error: payrollError }] = await Promise.all([
      employeeIds.size > 0
        ? admin
            .schema('HR')
            .from('employees')
            .select('id,first_name,last_name,employee_number')
            .in('id', Array.from(employeeIds))
        : Promise.resolve({ data: [], error: null }),
      payrollIds.size > 0
        ? admin.schema('HR').from('payroll_runs').select('id,payroll_month,status').in('id', Array.from(payrollIds))
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (employeeError) throw new Error(employeeError.message);
    if (payrollError) throw new Error(payrollError.message);

    const employeeDirectory = new Map(
      (employees ?? []).map((employee) => [
        employee.id,
        {
          name: `${employee.first_name} ${employee.last_name}`.trim(),
          employeeNumber: employee.employee_number,
        },
      ])
    );
    const payrollDirectory = new Map(
      (payrolls ?? []).map((payroll) => [
        payroll.id,
        {
          month: payroll.payroll_month,
          status: payroll.status,
        },
      ])
    );

    const items = filteredItems.map((item) => {
      const latestAction = (item.actions as ApprovalAction[]).at(-1) ?? null;
      if (item.entityType === 'employee_change_request') {
        const employee = employeeDirectory.get(item.entityId);
        const requestType = typeof item.payload.requestType === 'string' ? item.payload.requestType.replaceAll('_', ' ') : 'change';
        return {
          ...item,
          title: `${employee?.name ?? 'Employee'} ${requestType} request`,
          subtitle: employee?.employeeNumber ?? 'Employee record',
          href: `/dashboard/employees/${item.entityId}`,
          canReview: canReviewEmployeeChangeRequests(auth.session.userRole),
          latestAction,
        };
      }

      if (item.entityType === 'leave_approval') {
        const employeeId = typeof item.payload.employeeId === 'string' ? item.payload.employeeId : '';
        const employee = employeeDirectory.get(employeeId);
        const leaveType = typeof item.payload.leaveType === 'string' ? item.payload.leaveType : 'leave';
        const startDate = typeof item.payload.startDate === 'string' ? item.payload.startDate : '';
        const endDate = typeof item.payload.endDate === 'string' ? item.payload.endDate : '';
        return {
          ...item,
          title: `${employee?.name ?? 'Employee'} ${leaveType} leave`,
          subtitle: [employee?.employeeNumber, startDate && endDate ? `${startDate} to ${endDate}` : null].filter(Boolean).join(' · '),
          href: '/dashboard/leaves',
          canReview: canReviewLeaveApprovals(auth.session.userRole),
          latestAction,
        };
      }

      const payroll = payrollDirectory.get(item.entityId);
      return {
        ...item,
        title: `Payroll approval ${typeof item.payload.payrollMonth === 'string' ? item.payload.payrollMonth : payroll?.month ?? ''}`.trim(),
        subtitle: payroll?.status ? `Current cycle status: ${payroll.status.replaceAll('_', ' ')}` : 'Payroll run',
        href: '/dashboard/payroll',
        canReview: canReviewPayrollApprovals(auth.session.userRole),
        latestAction,
      };
    });

    return NextResponse.json({ items });
  } catch (approvalError) {
    return NextResponse.json(
      { error: approvalError instanceof Error ? approvalError.message : 'Unable to load approvals inbox.' },
      { status: 400 }
    );
  }
}
