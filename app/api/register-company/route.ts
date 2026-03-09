import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/auth';
import type { RegisterCompanyInput } from '@/lib/auth';
import { syncCompanyToEnterprise, syncMembershipToEnterprise } from '@/lib/platform/sync';

export async function POST(request: Request) {
  const payload = (await request.json()) as RegisterCompanyInput;
  const admin = createAdminClient();

  const { data: authResult, error: authError } = await admin.auth.admin.createUser({
    email: payload.adminEmail,
    password: payload.adminPassword,
    email_confirm: true,
    user_metadata: {
      first_name: payload.adminFirstName,
      last_name: payload.adminLastName,
    },
  });

  if (authError || !authResult.user) {
    return NextResponse.json({ error: authError?.message ?? 'Unable to create auth user.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: company, error: companyError } = await admin
    .schema('HR')
    .from('companies')
    .insert({
      name: payload.companyName,
      registration_number: payload.registrationNumber,
      tax_pin: payload.taxPin,
      nssf_number: payload.nssf,
      nhif_number: payload.nhif,
      address: payload.address,
      phone: payload.phone,
      email: payload.email,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (companyError || !company) {
    await admin.auth.admin.deleteUser(authResult.user.id);
    return NextResponse.json({ error: companyError?.message ?? 'Unable to create company.' }, { status: 400 });
  }

  const { error: membershipError } = await admin.schema('HR').from('company_users').insert({
    company_id: company.id,
    user_id: authResult.user.id,
    email: payload.adminEmail,
    first_name: payload.adminFirstName,
    last_name: payload.adminLastName,
    role: 'admin',
    created_at: now,
    updated_at: now,
  });

  if (membershipError) {
    await admin.auth.admin.deleteUser(authResult.user.id);
    await admin.schema('HR').from('companies').delete().eq('id', company.id);
    return NextResponse.json({ error: membershipError.message }, { status: 400 });
  }

  try {
    const { data: legacyCompany, error: legacyCompanyError } = await admin
      .schema('HR')
      .from('companies')
      .select('*')
      .eq('id', company.id)
      .single();

    if (legacyCompanyError || !legacyCompany) {
      throw new Error(legacyCompanyError?.message ?? 'Unable to load created company.');
    }

    await syncCompanyToEnterprise(admin, legacyCompany);
    await syncMembershipToEnterprise(admin, {
      company_id: company.id,
      user_id: authResult.user.id,
      email: payload.adminEmail,
      first_name: payload.adminFirstName,
      last_name: payload.adminLastName,
      role: 'admin',
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    await admin.schema('HR').from('company_users').delete().eq('company_id', company.id).eq('user_id', authResult.user.id);
    await admin.schema('HR').from('companies').delete().eq('id', company.id);
    await admin.auth.admin.deleteUser(authResult.user.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to provision enterprise company records.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
