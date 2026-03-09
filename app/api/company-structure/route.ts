import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { getCompanyStructure } from '@/lib/platform/sync';

export async function GET() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();

  try {
    const structure = await getCompanyStructure(admin, auth.session.companyId);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load company structure.' },
      { status: 400 }
    );
  }
}
