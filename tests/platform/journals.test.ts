import { describe, expect, it } from 'vitest';
import {
  buildPayrollJournalEntries,
  exportPayrollJournalCsv,
  summarizePayrollJournal,
} from '@/lib/platform/journals';

describe('payroll journal helpers', () => {
  it('builds balanced payroll journal entries', () => {
    const entries = buildPayrollJournalEntries('run-1', '2026-03', {
      grossPay: 100000,
      payeAmount: 12000,
      nssfAmount: 2500,
      nhifAmount: 1700,
      otherDeductionsAmount: 1800,
      netPayAmount: 82000,
    });

    const summary = summarizePayrollJournal('run-1', '2026-03', 'processed', entries);

    expect(summary.totalDebits).toBe(100000);
    expect(summary.totalCredits).toBe(100000);
    expect(summary.balanced).toBe(true);
    expect(entries[0]).toMatchObject({
      accountCode: '5000',
      entryType: 'debit',
      amount: 100000,
    });
  });

  it('exports csv rows with journal headers', () => {
    const entries = buildPayrollJournalEntries('run-1', '2026-03', {
      grossPay: 50000,
      payeAmount: 5000,
      nssfAmount: 1000,
      nhifAmount: 500,
      otherDeductionsAmount: 0,
      netPayAmount: 43500,
    });

    const csv = exportPayrollJournalCsv(entries);

    expect(csv).toContain('"account_code","account_name","entry_type","amount","category","memo"');
    expect(csv).toContain('"5000","Payroll Salary Expense","debit","50000.00","expense","2026-03 payroll gross earnings"');
    expect(csv).toContain('"2140","Net Salaries Payable","credit","43500.00","payable","2026-03 net salaries payable"');
  });
});
