import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canManageTeamMembers } from '@/lib/platform/roles';

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canManageTeamMembers(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators can reset passwords.' }, { status: 403 });
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: membership, error: membershipError } = await admin
    .schema('HR')
    .from('company_users')
    .select('*')
    .eq('user_id', id)
    .eq('company_id', auth.session.companyId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Team member not found.' }, { status: 404 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: temporaryPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ temporaryPassword });
}
