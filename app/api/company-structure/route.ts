import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { canManageStructure } from '@/lib/platform/roles';
import { createCompanyStructureItem, getCompanyStructure, updateCompanyStructureItem } from '@/lib/platform/sync';

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

export async function POST(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canManageStructure(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can manage organization structures.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const payload = await request.json();

  try {
    await createCompanyStructureItem(admin, auth.session.companyId, payload);
    const structure = await getCompanyStructure(admin, auth.session.companyId);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create organization structure item.' },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canManageStructure(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can manage organization structures.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const payload = await request.json();

  try {
    await updateCompanyStructureItem(admin, auth.session.companyId, payload);
    const structure = await getCompanyStructure(admin, auth.session.companyId);
    return NextResponse.json(structure);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update organization structure item.' },
      { status: 400 }
    );
  }
}
