import { NextResponse } from 'next/server';
import { createAdminClient, requireServerSession } from '@/lib/server/auth';
import { insertAuditLog } from '@/lib/hr/repository';
import { findSessionEmployee, getSessionEmployeeDocuments } from '@/lib/server/self-service';

export async function GET() {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;

  const admin = createAdminClient();

  if (auth.session.userRole === 'employee') {
    try {
      const result = await getSessionEmployeeDocuments(admin, auth.session);
      return NextResponse.json({
        employee: result.employee,
        documents: result.documents.map((document) => ({
          id: document.id,
          documentType: document.document_type,
          filePath: document.file_path,
          status: document.status,
          metadata: (document.metadata as Record<string, string> | null) ?? {},
          createdAt: document.created_at,
        })),
      });
    } catch (documentError) {
      return NextResponse.json(
        { error: documentError instanceof Error ? documentError.message : 'Unable to load employee documents.' },
        { status: 400 }
      );
    }
  }

  const [{ data: documents, error: documentError }, { data: employees, error: employeeError }] = await Promise.all([
    admin
      .schema('hr')
      .from('employee_documents')
      .select('id,employee_id,document_type,file_path,status,metadata,created_at')
      .eq('company_id', auth.session.companyId)
      .order('created_at', { ascending: false }),
    admin
      .schema('HR')
      .from('employees')
      .select('id,employee_number,first_name,last_name')
      .eq('company_id', auth.session.companyId)
      .order('first_name'),
  ]);

  if (documentError) {
    return NextResponse.json({ error: documentError.message }, { status: 400 });
  }
  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 400 });
  }

  const employeeLookup = new Map(
    (employees ?? []).map((employee) => [
      employee.id,
      {
        employeeNumber: employee.employee_number,
        employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
      },
    ])
  );

  return NextResponse.json({
    employees:
      (employees ?? []).map((employee) => ({
        id: employee.id,
        employeeNumber: employee.employee_number,
        employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
      })) ?? [],
    documents:
      (documents ?? []).map((document) => ({
        id: document.id,
        employeeId: document.employee_id,
        employeeNumber: employeeLookup.get(document.employee_id)?.employeeNumber ?? 'Unknown',
        employeeName: employeeLookup.get(document.employee_id)?.employeeName ?? 'Unknown employee',
        documentType: document.document_type,
        filePath: document.file_path,
        status: document.status,
        metadata: (document.metadata as Record<string, string> | null) ?? {},
        createdAt: document.created_at,
      })) ?? [],
  });
}

export async function POST(request: Request) {
  const auth = await requireServerSession();
  if ('error' in auth) return auth.error;
  if (!['admin', 'manager'].includes(auth.session.userRole)) {
    return NextResponse.json({ error: 'Only administrators and managers can upload employee documents.' }, { status: 403 });
  }

  const payload = await request.json();
  const admin = createAdminClient();

  const { data: employee, error: employeeError } = await admin
    .schema('HR')
    .from('employees')
    .select('id,company_id')
    .eq('id', payload.employeeId)
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 400 });
  }
  if (!employee || employee.company_id !== auth.session.companyId) {
    return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const metadata = {
    title: typeof payload.title === 'string' ? payload.title.trim() : '',
    notes: typeof payload.notes === 'string' ? payload.notes.trim() : '',
  };

  const { data: document, error } = await admin
    .schema('hr')
    .from('employee_documents')
    .insert({
      company_id: auth.session.companyId,
      employee_id: payload.employeeId,
      document_type: payload.documentType,
      file_path: payload.filePath,
      status: payload.status ?? 'active',
      metadata,
      uploaded_by: auth.session.userId,
      created_at: now,
    })
    .select('id,employee_id,document_type,file_path,status,metadata,created_at')
    .single();

  if (error || !document) {
    return NextResponse.json({ error: error?.message ?? 'Unable to store employee document.' }, { status: 400 });
  }

  await insertAuditLog(admin, {
    company_id: auth.session.companyId,
    actor_user_id: auth.session.userId,
    action: 'employee_document_created',
    entity_type: 'employee_documents',
    entity_id: document.id,
    after: {
      employeeId: document.employee_id,
      documentType: document.document_type,
      filePath: document.file_path,
      status: document.status,
      metadata: document.metadata,
    },
  });

  return GET();
}
