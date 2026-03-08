import { getCompany, getCompanyUserByUserId } from '@/lib/hr/repository';
import type { User } from '@/lib/hr/types';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface AuthSession {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: User['role'];
  companyId: string;
  companyName: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCompanyInput {
  companyName: string;
  registrationNumber: string;
  taxPin: string;
  nssf: string;
  nhif: string;
  address: string;
  phone: string;
  email: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

async function buildAuthSession() {
  const supabase = getSupabaseBrowserClient();
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
  } satisfies AuthSession;
}

async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}

class AuthService {
  async registerCompany(input: RegisterCompanyInput) {
    await requestJson('/api/register-company', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    await this.login({
      email: input.adminEmail,
      password: input.adminPassword,
    });
  }

  async login(credentials: LoginCredentials) {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }

    const session = await buildAuthSession();
    if (!session) {
      throw new Error('Account is authenticated but not linked to an HR workspace.');
    }

    return session;
  }

  async getSession() {
    return buildAuthSession();
  }

  async logout() {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
  }

  async createUser(
    _companyId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: User['role']
  ) {
    return requestJson<{ user: User; temporaryPassword: string }>('/api/team-members', {
      method: 'POST',
      body: JSON.stringify({ email, firstName, lastName, role }),
    });
  }

  async resetUserPassword(userId: string) {
    const payload = await requestJson<{ temporaryPassword: string }>(`/api/team-members/${userId}/reset-password`, {
      method: 'POST',
    });
    return payload.temporaryPassword;
  }
}

export const authService = new AuthService();
