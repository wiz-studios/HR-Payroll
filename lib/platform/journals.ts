import type { SupabaseClient } from '@supabase/supabase-js';

type UntypedClient = SupabaseClient<any, any, any>;

export interface PayrollJournalEntry {
  id: string;
  accountCode: string;
  accountName: string;
  entryType: 'debit' | 'credit';
  amount: number;
  category: 'expense' | 'liability' | 'payable';
  memo: string;
}

export interface PayrollJournalSummary {
  payrollId: string;
  payPeriodLabel: string;
  status: string;
  totalDebits: number;
  totalCredits: number;
  entryCount: number;
  balanced: boolean;
}

export interface JournalAccountConfig {
  salaryExpense: { code: string; name: string };
  payeLiability: { code: string; name: string };
  nssfLiability: { code: string; name: string };
  nhifLiability: { code: string; name: string };
  otherDeductionsLiability: { code: string; name: string };
  netPayable: { code: string; name: string };
}

export const DEFAULT_JOURNAL_ACCOUNTS: JournalAccountConfig = {
  salaryExpense: { code: '5000', name: 'Payroll Salary Expense' },
  payeLiability: { code: '2100', name: 'PAYE Liability' },
  nssfLiability: { code: '2110', name: 'NSSF Liability' },
  nhifLiability: { code: '2120', name: 'NHIF/SHIF Liability' },
  otherDeductionsLiability: { code: '2130', name: 'Other Payroll Deductions' },
  netPayable: { code: '2140', name: 'Net Salaries Payable' },
};

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export function buildPayrollJournalEntries(
  payrollId: string,
  payPeriodLabel: string,
  totals: {
    grossPay: number;
    payeAmount: number;
    nssfAmount: number;
    nhifAmount: number;
    otherDeductionsAmount: number;
    netPayAmount: number;
  },
  accounts: JournalAccountConfig = DEFAULT_JOURNAL_ACCOUNTS
) {
  const normalizedTotals = {
    grossPay: roundCurrency(totals.grossPay),
    payeAmount: roundCurrency(totals.payeAmount),
    nssfAmount: roundCurrency(totals.nssfAmount),
    nhifAmount: roundCurrency(totals.nhifAmount),
    otherDeductionsAmount: roundCurrency(totals.otherDeductionsAmount),
    netPayAmount: roundCurrency(totals.netPayAmount),
  };

  const entries: PayrollJournalEntry[] = [
    {
      id: `${payrollId}-expense`,
      accountCode: accounts.salaryExpense.code,
      accountName: accounts.salaryExpense.name,
      entryType: 'debit',
      amount: normalizedTotals.grossPay,
      category: 'expense',
      memo: `${payPeriodLabel} payroll gross earnings`,
    },
  ];

  if (normalizedTotals.payeAmount > 0) {
    entries.push({
      id: `${payrollId}-paye`,
      accountCode: accounts.payeLiability.code,
      accountName: accounts.payeLiability.name,
      entryType: 'credit',
      amount: normalizedTotals.payeAmount,
      category: 'liability',
      memo: `${payPeriodLabel} PAYE withholding`,
    });
  }

  if (normalizedTotals.nssfAmount > 0) {
    entries.push({
      id: `${payrollId}-nssf`,
      accountCode: accounts.nssfLiability.code,
      accountName: accounts.nssfLiability.name,
      entryType: 'credit',
      amount: normalizedTotals.nssfAmount,
      category: 'liability',
      memo: `${payPeriodLabel} NSSF withholding`,
    });
  }

  if (normalizedTotals.nhifAmount > 0) {
    entries.push({
      id: `${payrollId}-nhif`,
      accountCode: accounts.nhifLiability.code,
      accountName: accounts.nhifLiability.name,
      entryType: 'credit',
      amount: normalizedTotals.nhifAmount,
      category: 'liability',
      memo: `${payPeriodLabel} NHIF/SHIF withholding`,
    });
  }

  if (normalizedTotals.otherDeductionsAmount > 0) {
    entries.push({
      id: `${payrollId}-other-deductions`,
      accountCode: accounts.otherDeductionsLiability.code,
      accountName: accounts.otherDeductionsLiability.name,
      entryType: 'credit',
      amount: normalizedTotals.otherDeductionsAmount,
      category: 'liability',
      memo: `${payPeriodLabel} other payroll deductions`,
    });
  }

  if (normalizedTotals.netPayAmount > 0) {
    entries.push({
      id: `${payrollId}-net-payable`,
      accountCode: accounts.netPayable.code,
      accountName: accounts.netPayable.name,
      entryType: 'credit',
      amount: normalizedTotals.netPayAmount,
      category: 'payable',
      memo: `${payPeriodLabel} net salaries payable`,
    });
  }

  return entries;
}

export function summarizePayrollJournal(
  payrollId: string,
  payPeriodLabel: string,
  status: string,
  entries: PayrollJournalEntry[]
): PayrollJournalSummary {
  const totalDebits = roundCurrency(
    entries.filter((entry) => entry.entryType === 'debit').reduce((sum, entry) => sum + entry.amount, 0)
  );
  const totalCredits = roundCurrency(
    entries.filter((entry) => entry.entryType === 'credit').reduce((sum, entry) => sum + entry.amount, 0)
  );

  return {
    payrollId,
    payPeriodLabel,
    status,
    totalDebits,
    totalCredits,
    entryCount: entries.length,
    balanced: totalDebits === totalCredits,
  };
}

export async function getPayrollJournal(client: UntypedClient, companyId: string, payrollId: string) {
  const { data: payrollRun, error: payrollError } = await client
    .schema('payroll')
    .from('pay_runs')
    .select('id,pay_period_label,status')
    .eq('company_id', companyId)
    .eq('id', payrollId)
    .maybeSingle();

  if (payrollError) {
    throw new Error(payrollError.message);
  }
  if (!payrollRun) {
    throw new Error('Payroll journal source run not found.');
  }

  const { data: payRunItems, error: itemsError } = await client
    .schema('payroll')
    .from('pay_run_items')
    .select('gross_pay,total_deductions,net_pay,deductions')
    .eq('company_id', companyId)
    .eq('pay_run_id', payrollId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const totals = (payRunItems ?? []).reduce(
    (accumulator, item) => {
      const deductions = (item.deductions as Record<string, unknown> | null) ?? {};
      const otherTotal =
        typeof deductions.otherTotal === 'number'
          ? deductions.otherTotal
          : typeof deductions.otherTotal === 'string'
            ? Number(deductions.otherTotal)
            : 0;

      return {
        grossPay: accumulator.grossPay + Number(item.gross_pay ?? 0),
        payeAmount: accumulator.payeAmount + Number(deductions.incomeTax ?? 0),
        nssfAmount: accumulator.nssfAmount + Number(deductions.nssf ?? 0),
        nhifAmount: accumulator.nhifAmount + Number(deductions.nhif ?? 0),
        otherDeductionsAmount: accumulator.otherDeductionsAmount + otherTotal,
        netPayAmount: accumulator.netPayAmount + Number(item.net_pay ?? 0),
      };
    },
    {
      grossPay: 0,
      payeAmount: 0,
      nssfAmount: 0,
      nhifAmount: 0,
      otherDeductionsAmount: 0,
      netPayAmount: 0,
    }
  );

  const entries = buildPayrollJournalEntries(
    payrollRun.id as string,
    payrollRun.pay_period_label as string,
    totals
  );
  const summary = summarizePayrollJournal(
    payrollRun.id as string,
    payrollRun.pay_period_label as string,
    payrollRun.status as string,
    entries
  );

  return { entries, summary };
}

export function exportPayrollJournalCsv(entries: PayrollJournalEntry[]) {
  const header = ['account_code', 'account_name', 'entry_type', 'amount', 'category', 'memo'];
  const rows = entries.map((entry) => [
    entry.accountCode,
    entry.accountName,
    entry.entryType,
    entry.amount.toFixed(2),
    entry.category,
    entry.memo,
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

export async function listPayrollJournals(client: UntypedClient, companyId: string) {
  const { data: payRuns, error } = await client
    .schema('payroll')
    .from('pay_runs')
    .select('id,pay_period_label,status')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const items = await Promise.all(
    (payRuns ?? []).map(async (payRun) => {
      const { summary } = await getPayrollJournal(client, companyId, payRun.id as string);
      return summary;
    })
  );

  return items;
}
