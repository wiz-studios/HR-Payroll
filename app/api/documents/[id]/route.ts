import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog } from '@/lib/hr/repository';
import { canManageDocuments } from '@/lib/platform/roles';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!canManageDocuments(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can update employee documents.' }, { status: 403 });
  }

  const { id } = await context.params;
  const payload = await request.json();
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .schema('hr')
    .from('employee_documents')
    .select('id,company_id,employee_id,document_type,file_path,status,metadata')
    .eq('id', id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 400 });
  }
  if (!existing || existing.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const nextMetadata = {
    ...(((existing.metadata as Record<string, string> | null) ?? {})),
    ...(typeof payload.title === 'string' ? { title: payload.title.trim() } : {}),
    ...(typeof payload.notes === 'string' ? { notes: payload.notes.trim() } : {}),
  };

  const { data: document, error } = await admin
    .schema('hr')
    .from('employee_documents')
    .update({
      status: typeof payload.status === 'string' ? payload.status : existing.status,
      metadata: nextMetadata,
    })
    .eq('id', id)
    .select('id,employee_id,document_type,file_path,status,metadata')
    .single();

  if (error || !document) {
    return NextResponse.json({ error: error?.message ?? 'Unable to update employee document.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'employee_document_updated',
    entity_type: 'employee_documents',
    entity_id: document.id,
    before: existing,
    after: document,
  });

  return NextResponse.json({ document });
}
