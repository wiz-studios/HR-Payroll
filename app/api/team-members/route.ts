import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapUser } from '@/lib/hr/repository';
import {
  canManageTeamMembers,
  mapEnterpriseRoleToLegacy,
  normalizeRole,
  type RuntimeRole,
} from '@/lib/platform/roles';
import { syncMembershipToEnterprise } from '@/lib/platform/sync';

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canManageTeamMembers(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators can add team members.' }, { status: 403 });
  }

  const payload = (await request.json()) as {
    email: string;
    firstName: string;
    lastName: string;
    role: RuntimeRole;
  };

  const admin = createAdminClient();
  const temporaryPassword = generateTemporaryPassword();
  const now = new Date().toISOString();

  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email: payload.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      first_name: payload.firstName,
      last_name: payload.lastName,
    },
  });

  if (authError || !authResult.user) {
    return NextResponse.json({ error: authError?.message ?? 'Unable to create team member.' }, { status: 400 });
  }

  const { data, error } = await admin
    .schema('HR')
    .from('company_users')
    .insert({
      company_id: auth.session.companyId,
      user_id: authResult.user.id,
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      role: mapEnterpriseRoleToLegacy(payload.role),
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !data) {
    await admin.auth.admin.deleteUser(authResult.user.id);
    return NextResponse.json({ error: error?.message ?? 'Unable to attach user to company.' }, { status: 400 });
  }

  try {
    await syncMembershipToEnterprise(admin, {
      company_id: auth.session.companyId,
      user_id: authResult.user.id,
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      role: payload.role,
      created_at: now,
      updated_at: now,
    });
  } catch (syncError) {
    await admin.schema('HR').from('company_users').delete().eq('id', data.id);
    await admin.auth.admin.deleteUser(authResult.user.id);
    return NextResponse.json(
      { error: syncError instanceof Error ? syncError.message : 'Unable to sync team member to enterprise schema.' },
      { status: 400 }
    );
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'team_member_created',
    entity_type: 'company_users',
    entity_id: data.id,
    after: data,
  });

  return NextResponse.json({
    user: {
      ...mapUser(data),
      role: normalizeRole(payload.role),
    },
    temporaryPassword,
  });
}
