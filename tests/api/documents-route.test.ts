import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerSession = vi.fn();
const createAdminClient = vi.fn();
const insertAuditLog = vi.fn();
const findSessionEmployee = vi.fn();
const getSessionEmployeeDocuments = vi.fn();

vi.mock('@/lib/server/auth', () => ({
  requireServerSession,
  createAdminClient,
}));

vi.mock('@/lib/hr/repository', () => ({
  insertAuditLog,
}));

vi.mock('@/lib/server/self-service', () => ({
  findSessionEmployee,
  getSessionEmployeeDocuments,
}));

describe('/api/documents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns self-service documents for employee users', async () => {
    requireServerSession.mockResolvedValue({
      session: {
        userRole: 'employee',
        companyId: 'company-1',
      },
    });
    createAdminClient.mockReturnValue({ admin: true });
    getSessionEmployeeDocuments.mockResolvedValue({
      employee: { id: 'emp-1' },
      documents: [
        {
          id: 'doc-1',
          document_type: 'contract',
          file_path: '/docs/contract.pdf',
          status: 'active',
          metadata: { title: 'Contract' },
          created_at: '2026-03-09T00:00:00.000Z',
        },
      ],
    });

    const { GET } = await import('@/app/api/documents/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.documents).toHaveLength(1);
    expect(payload.documents[0].documentType).toBe('contract');
  });

  it('blocks employee uploads', async () => {
    requireServerSession.mockResolvedValue({
      session: {
        userRole: 'employee',
      },
    });

    const { POST } = await import('@/app/api/documents/route');
    const response = await POST(
      new Request('http://localhost/api/documents', {
        method: 'POST',
        body: JSON.stringify({}),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain('Only administrators and managers');
  });
});
