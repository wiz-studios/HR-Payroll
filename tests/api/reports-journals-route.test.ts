import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerSession = vi.fn();
const createAdminClient = vi.fn();
const listPayrollJournals = vi.fn();

vi.mock('@/lib/server/auth', () => ({
  requireServerSession,
  createAdminClient,
}));

vi.mock('@/lib/platform/journals', () => ({
  listPayrollJournals,
}));

describe('GET /api/reports/journals', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects employee access', async () => {
    requireServerSession.mockResolvedValue({
      session: {
        userRole: 'employee',
      },
    });

    const { GET } = await import('@/app/api/reports/journals/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain('Only administrators and managers');
    expect(listPayrollJournals).not.toHaveBeenCalled();
  });

  it('returns journal summaries for admin users', async () => {
    requireServerSession.mockResolvedValue({
      session: {
        userRole: 'admin',
        companyId: 'company-1',
      },
    });
    createAdminClient.mockReturnValue({ admin: true });
    listPayrollJournals.mockResolvedValue([
      {
        payrollId: 'run-1',
        payPeriodLabel: '2026-03',
        status: 'processed',
        totalDebits: 1000,
        totalCredits: 1000,
        entryCount: 3,
        balanced: true,
      },
    ]);

    const { GET } = await import('@/app/api/reports/journals/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.items).toHaveLength(1);
    expect(listPayrollJournals).toHaveBeenCalledWith({ admin: true }, 'company-1');
  });
});
