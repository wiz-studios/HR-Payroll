'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authService, AuthSession } from '@/lib/auth';
import { db, PayrollDetail, Employee, Payroll } from '@/lib/db-schema';
import { formatCurrency, formatDate, getMonthName } from '@/lib/utils-hr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PayslipPage() {
  const router = useRouter();
  const params = useParams();
  const detailId = params.id as string;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [detail, setDetail] = useState<PayrollDetail | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [payroll, setPayroll] = useState<Payroll | null>(null);
  const [companyTaxPin, setCompanyTaxPin] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const sess = await authService.getSession();
      if (!mounted) return;
      setSession(sess);
      if (!sess) {
        setIsLoading(false);
        return;
      }

      const d = await db.getPayrollDetail(detailId);
      if (d && d.companyId === sess.companyId) {
        setDetail(d);

        const [emp, p, company] = await Promise.all([
          db.getEmployee(d.employeeId),
          db.getPayroll(d.payrollId),
          db.getCompany(sess.companyId),
        ]);
        if (!mounted) return;
        setEmployee(emp || null);
        setPayroll(p || null);
        setCompanyTaxPin(company?.taxPin ?? null);
      }

      setIsLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [detailId]);

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!detail || !employee || !payroll || !session) {
    return <div className="text-center py-12 text-red-600">Payslip not found</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 print:max-w-none print:space-y-0">
      {/* Header Button */}
      <Button variant="outline" className="print:hidden" onClick={() => router.back()}>
        Back
      </Button>

      {/* Payslip */}
      <Card className="border-2 print:rounded-none print:border-0 print:shadow-none">
        <CardHeader className="border-b-2 bg-blue-50 print:bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">PAYROLL PERIOD</p>
              <p className="text-xl font-bold text-gray-900">{getMonthName(payroll.payrollMonth)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">PAYSLIP</p>
              <p className="text-lg font-mono font-bold">{detail.id.substring(0, 12)}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-8">
          {/* Company Info */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h3 className="font-bold text-lg mb-4">{session.companyName}</h3>
            <div className="text-sm text-gray-600">
              <p>Tax PIN: {companyTaxPin ?? '-'}</p>
            </div>
          </div>

          {/* Employee Info */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Employee Name</p>
                <p className="font-semibold text-lg">
                  {employee.firstName} {employee.lastName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Employee ID</p>
                <p className="font-semibold">{employee.employeeNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Position</p>
                <p>{employee.position}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Department</p>
                <p>{employee.department}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">ID Number</p>
                <p>{employee.idNumber}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Tax PIN</p>
                <p>{employee.taxPin}</p>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <div className="mb-8">
            <h4 className="font-bold text-sm uppercase text-gray-900 mb-4 pb-2 border-b-2 border-gray-900">
              Earnings
            </h4>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-700">Basic Salary</span>
                <span className="font-mono">{formatCurrency(detail.basicSalary)}</span>
              </div>
              {detail.allowanceBreakdown &&
                Object.entries(detail.allowanceBreakdown).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-700 capitalize">{key} Allowance</span>
                    <span className="font-mono">{formatCurrency(value)}</span>
                  </div>
                ))}
              <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                <span>Gross Pay</span>
                <span className="font-mono text-lg">{formatCurrency(detail.grossPay)}</span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div className="mb-8">
            <h4 className="font-bold text-sm uppercase text-gray-900 mb-4 pb-2 border-b-2 border-gray-900">
              Deductions
            </h4>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-700">NSSF Contribution</span>
                <span className="font-mono">{formatCurrency(detail.nssfAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">NHIF Contribution</span>
                <span className="font-mono">{formatCurrency(detail.nhifAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">Income Tax (PAYE)</span>
                <span className="font-mono">{formatCurrency(detail.incomeTaxAmount)}</span>
              </div>
              {detail.otherDeductionsBreakdown &&
                Object.entries(detail.otherDeductionsBreakdown).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-gray-700 capitalize">{key}</span>
                    <span className="font-mono">{formatCurrency(value)}</span>
                  </div>
                ))}
              <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
                <span>Total Deductions</span>
                <span className="font-mono text-lg">{formatCurrency(detail.totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="mb-8 rounded-lg border-2 border-green-200 bg-green-50 p-6 print:bg-white">
            <p className="text-sm text-gray-600 uppercase tracking-wider mb-2">Net Pay</p>
            <p className="text-4xl font-bold text-green-700">{formatCurrency(detail.netPay)}</p>
          </div>

          {/* Banking Information */}
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h4 className="font-bold text-sm uppercase text-gray-900 mb-4">Banking Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Bank Name</p>
                <p>{employee.bankName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase mb-1">Account Number</p>
                <p className="font-mono">{employee.accountNumber}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-500 text-center">
            <p>Generated on {formatDate(new Date())}</p>
            <p>This is an electronically generated payslip</p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-center gap-3 print:hidden">
        <Button onClick={() => window.print()}>
          Print Payslip
        </Button>
      </div>
    </div>
  );
}
