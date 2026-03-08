import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog, mapCompany } from '@/lib/hr/repository';

export async function PATCH(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (auth.session.userRole !== 'admin') {
    return NextResponse.json({ error: 'Only administrators can update company settings.' }, { status: 403 });
  }

  const updates = await request.json();
  const admin = createAdminClient();
  const { data: existing } = await admin.schema('HR').from('companies').select('*').eq('id', auth.session.companyId).single();

  const { data, error } = await admin
    .schema('HR')
    .from('companies')
    .update({
      name: updates.name,
      registration_number: updates.registrationNumber,
      tax_pin: updates.taxPin,
      nssf_number: updates.nssf,
      nhif_number: updates.nhif,
      address: updates.address,
      phone: updates.phone,
      email: updates.email,
      updated_at: new Date().toISOString(),
    })
    .eq('id', auth.session.companyId)
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Unable to update company.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'company_updated',
    entity_type: 'companies',
    entity_id: data.id,
    before: existing,
    after: data,
  });

  return NextResponse.json({ company: mapCompany(data) });
}
