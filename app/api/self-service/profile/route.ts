import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { mapEmployee } from '@/lib/hr/repository';
import { findSessionEmployee } from '@/lib/server/self-service';

export async function GET() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();

  try {
    const employee = await findSessionEmployee(admin, auth.session);
    if (!employee) {
      return NextResponse.json({ error: 'No employee profile is linked to this account yet.' }, { status: 404 });
    }

    return NextResponse.json({ employee: mapEmployee(employee) });
  } catch (profileError) {
    return NextResponse.json(
      { error: profileError instanceof Error ? profileError.message : 'Unable to load self-service profile.' },
      { status: 400 }
    );
  }
}
