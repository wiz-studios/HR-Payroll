import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerSession = vi.fn();
const createAdminClient = vi.fn();
const getJournalAccountConfig = vi.fn();
const saveJournalAccountConfig = vi.fn();
const insertAuditLog = vi.fn();

vi.mock('@/lib/server/auth', () => ({
  requireServerSession,
  createAdminClient,
}));

vi.mock('@/lib/platform/journals', () => ({
  getJournalAccountConfig,
  saveJournalAccountConfig,
}));

vi.mock('@/lib/hr/repository', () => ({
  insertAuditLog,
}));

describe('/api/company/journal-accounts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns config for manager GET access', async () => {
    requireServerSession.mockResolvedValue({
      session: {
        userRole: 'manager',
        companyId: 'company-1',
      },
    });
    createAdminClient.mockReturnValue({ admin: true });
    getJournalAccountConfig.mockResolvedValue({
      salaryExpense: { code: '5000', name: 'Expense' },
    });

    const { GET } = await import('@/app/api/company/journal-accounts/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.config.salaryExpense.code).toBe('5000');
  });

  it('blocks non-admin PATCH access', async () => {
    requireServerSession.mockResolvedValue({
      session: {
        userRole: 'manager',
      },
    });

    const { PATCH } = await import('@/app/api/company/journal-accounts/route');
    const response = await PATCH(
      new Request('http://localhost/api/company/journal-accounts', {
        method: 'PATCH',
        body: JSON.stringify({}),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain('Only administrators');
    expect(saveJournalAccountConfig).not.toHaveBeenCalled();
  });

  it('persists config and audits admin PATCH access', async () => {
    requireServerSession.mockResolvedValue({
      session: {
        userRole: 'admin',
        companyId: 'company-1',
        userId: 'user-1',
      },
    });
    createAdminClient.mockReturnValue({ admin: true });
    getJournalAccountConfig.mockResolvedValueOnce({
      salaryExpense: { code: '5000', name: 'Old' },
    });
    saveJournalAccountConfig.mockResolvedValue({
      salaryExpense: { code: '5100', name: 'New' },
    });

    const { PATCH } = await import('@/app/api/company/journal-accounts/route');
    const response = await PATCH(
      new Request('http://localhost/api/company/journal-accounts', {
        method: 'PATCH',
        body: JSON.stringify({ salaryExpense: { code: '5100', name: 'New' } }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(saveJournalAccountConfig).toHaveBeenCalledWith(
      { admin: true },
      'company-1',
      'user-1',
      { salaryExpense: { code: '5100', name: 'New' } }
    );
    expect(insertAuditLog).toHaveBeenCalled();
    expect(payload.config.salaryExpense.code).toBe('5100');
  });
});
