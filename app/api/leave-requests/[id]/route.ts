import { NextResponse } from 'next/server';
import { requireServerSession } from '@/lib/server/auth';

export async function PATCH() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  return NextResponse.json(
    { error: 'Leave approvals must be reviewed through the workflow approval route.' },
    { status: 400 }
  );
}
