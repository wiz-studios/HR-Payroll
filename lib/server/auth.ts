import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCompany, getCompanyUserByUserId } from '@/lib/hr/repository';
import type { User } from '@/lib/hr/types';

export interface ServerSession {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: User['role'];
  companyId: string;
  companyName: string;
}

export async function getServerSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const membership = await getCompanyUserByUserId(supabase, user.id);
  if (!membership) {
    return null;
  }

  const company = await getCompany(supabase, membership.companyId);
  if (!company) {
    return null;
  }

  return {
    userId: user.id,
    userEmail: user.email ?? membership.email,
    userName: `${membership.firstName} ${membership.lastName}`.trim(),
    userRole: membership.role,
    companyId: company.id,
    companyName: company.name,
  } satisfies ServerSession;
}

export async function requireServerSession() {
  const session = await getServerSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { session };
}

export function createAdminClient() {
  return createSupabaseAdminClient();
}
