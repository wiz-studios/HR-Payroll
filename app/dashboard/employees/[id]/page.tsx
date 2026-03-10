'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authService, AuthSession } from '@/lib/auth';
import { canManageEmployees as canManageEmployeesByRole, canReviewEmployeeChangeRequests } from '@/lib/platform/roles';
import { db, Employee } from '@/lib/db-schema';
import { formatCurrency, getStatusDisplayName, formatDate } from '@/lib/utils-hr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CompanyStructure {
  branches: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  costCenters: Array<{ id: string; name: string }>;
  payrollGroups: Array<{ id: string; name: string }>;
}

interface EmployeeOrganization {
  branchId: string | null;
  departmentId: string | null;
  costCenterId: string | null;
  payrollGroupId: string | null;
  jobGrade: string | null;
  workLocation: string | null;
}

interface EmployeeHistory {
  employmentHistory: Array<{
    id: string;
    branchName: string | null;
    departmentName: string | null;
    costCenterName: string | null;
    payrollGroupName: string | null;
    jobTitle: string;
    jobGrade: string | null;
    workLocation: string | null;
    employmentType: string;
    joinDate: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    isCurrent: boolean;
    createdAt: string;
  }>;
  compensationHistory: Array<{
    id: string;
    currency: string;
    salaryFrequency: string;
    paymentMethod: string;
    baseSalary: number;
    allowances: Record<string, number>;
    recurringDeductions: Record<string, number>;
    effectiveFrom: string;
    effectiveTo: string | null;
    isCurrent: boolean;
    createdAt: string;
  }>;
}

interface EmployeeChangeRequest {
  id: string;
  status: string;
  payload: {
    requestType: 'compensation' | 'bank_details' | 'employment';
    effectiveFrom: string;
    reason: string;
    changes: Record<string, unknown>;
  };
  createdAt: string;
  updatedAt: string;
  actions: Array<{
    action: string;
    actorUserId: string | null;
    comments: string | null;
    createdAt: string;
  }>;
}

type EmployeeEditor = Partial<Employee> & {
  branchId?: string;
  departmentId?: string;
  costCenterId?: string;
  payrollGroupId?: string;
  jobGrade?: string;
  workLocation?: string;
  effectiveFrom?: string;
};

type ChangeRequestForm = {
  requestType: 'compensation' | 'bank_details' | 'employment';
  effectiveFrom: string;
  reason: string;
  baseSalary: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  branchId: string;
  departmentId: string;
  costCenterId: string;
  payrollGroupId: string;
  position: string;
  employmentType: Employee['employmentType'];
  jobGrade: string;
  workLocation: string;
};

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [structure, setStructure] = useState<CompanyStructure>({ branches: [], departments: [], costCenters: [], payrollGroups: [] });
  const [organization, setOrganization] = useState<EmployeeOrganization | null>(null);
  const [history, setHistory] = useState<EmployeeHistory>({ employmentHistory: [], compensationHistory: [] });
  const [requests, setRequests] = useState<EmployeeChangeRequest[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState<EmployeeEditor>({});
  const [requestForm, setRequestForm] = useState<ChangeRequestForm>({
    requestType: 'compensation',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    reason: '',
    baseSalary: '',
    bankName: '',
    bankCode: '',
    accountNumber: '',
    branchId: '',
    departmentId: '',
    costCenterId: '',
    payrollGroupId: '',
    position: '',
    employmentType: 'permanent',
    jobGrade: '',
    workLocation: '',
  });
  const canManageEmployee = session ? canManageEmployeesByRole(session.userRole) : false;
  const canReviewRequests = session ? canReviewEmployeeChangeRequests(session.userRole) : false;

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

      const [emp, structureResponse, organizationResponse, historyResponse, requestsResponse] = await Promise.all([
        db.getEmployee(employeeId),
        fetch('/api/company-structure'),
        fetch(`/api/employees/${employeeId}/organization`),
        fetch(`/api/employees/${employeeId}/history`),
        fetch(`/api/employees/${employeeId}/change-requests`),
      ]);
      const structurePayload = (await structureResponse.json().catch(() => ({
        branches: [],
        departments: [],
        costCenters: [],
        payrollGroups: [],
      }))) as CompanyStructure;
      const organizationPayload = (await organizationResponse.json().catch(() => ({
        branchId: null,
        departmentId: null,
        costCenterId: null,
        payrollGroupId: null,
        jobGrade: null,
        workLocation: null,
      }))) as EmployeeOrganization;
      const historyPayload = (await historyResponse.json().catch(() => ({
        employmentHistory: [],
        compensationHistory: [],
      }))) as EmployeeHistory;
      const requestsPayload = (await requestsResponse.json().catch(() => ({
        requests: [],
      }))) as { requests: EmployeeChangeRequest[] };
      if (emp && emp.companyId === sess.companyId) {
        setEmployee(emp);
        setFormData({
          ...emp,
          branchId: organizationPayload.branchId ?? '',
          departmentId: organizationPayload.departmentId ?? '',
          costCenterId: organizationPayload.costCenterId ?? '',
          payrollGroupId: organizationPayload.payrollGroupId ?? '',
          jobGrade: organizationPayload.jobGrade ?? '',
          workLocation: organizationPayload.workLocation ?? '',
          effectiveFrom: new Date().toISOString().slice(0, 10),
        });
        setOrganization(organizationPayload);
        if (structureResponse.ok) {
          setStructure({
            branches: structurePayload.branches ?? [],
            departments: structurePayload.departments ?? [],
            costCenters: structurePayload.costCenters ?? [],
            payrollGroups: structurePayload.payrollGroups ?? [],
          });
        }
        if (historyResponse.ok) {
          setHistory({
            employmentHistory: historyPayload.employmentHistory ?? [],
            compensationHistory: historyPayload.compensationHistory ?? [],
          });
        }
        if (requestsResponse.ok) {
          setRequests(requestsPayload.requests ?? []);
        }
        setRequestForm({
          requestType: 'compensation',
          effectiveFrom: new Date().toISOString().slice(0, 10),
          reason: '',
          baseSalary: String(emp.baseSalary),
          bankName: emp.bankName,
          bankCode: emp.bankCode,
          accountNumber: emp.accountNumber,
          branchId: organizationPayload.branchId ?? '',
          departmentId: organizationPayload.departmentId ?? '',
          costCenterId: organizationPayload.costCenterId ?? '',
          payrollGroupId: organizationPayload.payrollGroupId ?? '',
          position: emp.position,
          employmentType: emp.employmentType,
          jobGrade: organizationPayload.jobGrade ?? '',
          workLocation: organizationPayload.workLocation ?? '',
        });
      } else {
        setError('Employee not found');
      }
      setIsLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [employeeId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'baseSalary' ? parseFloat(value) : value,
    });
  };

  const handleAllowanceChange = (key: string, value: string) => {
    setFormData({
      ...formData,
      allowances: {
        ...formData.allowances,
        [key]: parseFloat(value) || 0,
      },
    });
  };

  const handleDeductionChange = (key: string, value: string) => {
    setFormData({
      ...formData,
      deductions: {
        ...formData.deductions,
        [key]: parseFloat(value) || 0,
      },
    });
  };

  const handleRequestFormChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setRequestForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmitChangeRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!employee) return;

    let changes: Record<string, unknown> = {};
    if (requestForm.requestType === 'compensation') {
      changes = {
        baseSalary: Number(requestForm.baseSalary),
        allowances: employee.allowances,
        deductions: employee.deductions,
      };
    } else if (requestForm.requestType === 'bank_details') {
      changes = {
        bankName: requestForm.bankName,
        bankCode: requestForm.bankCode,
        accountNumber: requestForm.accountNumber,
      };
    } else {
      changes = {
        branchId: requestForm.branchId || null,
        departmentId: requestForm.departmentId || null,
        departmentName: structure.departments.find((department) => department.id === requestForm.departmentId)?.name ?? employee.department,
        costCenterId: requestForm.costCenterId || null,
        payrollGroupId: requestForm.payrollGroupId || null,
        position: requestForm.position,
        employmentType: requestForm.employmentType,
        jobGrade: requestForm.jobGrade || null,
        workLocation: requestForm.workLocation || null,
      };
    }

    const response = await fetch(`/api/employees/${employeeId}/change-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: requestForm.requestType,
        effectiveFrom: requestForm.effectiveFrom,
        reason: requestForm.reason,
        changes,
      }),
    });
    const payload = (await response.json().catch(() => ({ requests: [] }))) as { error?: string; requests?: EmployeeChangeRequest[] };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to submit change request.');
      return;
    }

    setRequests(payload.requests ?? []);
    setIsRequestDialogOpen(false);
    setSuccess('Change request submitted for approval.');
    setRequestForm((current) => ({ ...current, reason: '', effectiveFrom: new Date().toISOString().slice(0, 10) }));
  };

  const handleReviewRequest = async (requestId: string, decision: 'approved' | 'rejected') => {
    const comments = decision === 'rejected' ? window.prompt('Reason for rejection (optional)') ?? '' : '';
    const response = await fetch(`/api/employees/${employeeId}/change-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comments }),
    });
    const payload = (await response.json().catch(() => ({ requests: [] }))) as { error?: string; requests?: EmployeeChangeRequest[] };
    if (!response.ok) {
      setError(payload.error ?? 'Unable to review change request.');
      return;
    }

    setRequests(payload.requests ?? []);
    setSuccess(`Change request ${decision}.`);
    if (decision === 'approved') {
      window.location.reload();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (structure.departments.length > 0 && !formData.departmentId) {
      setError('Select a department for the employee.');
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          department: structure.departments.find((department) => department.id === formData.departmentId)?.name ?? formData.department,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save changes');
      }

      if (payload.employee) {
        setEmployee(payload.employee);
        setOrganization({
          branchId: formData.branchId ?? null,
          departmentId: formData.departmentId ?? null,
          costCenterId: formData.costCenterId ?? null,
          payrollGroupId: formData.payrollGroupId ?? null,
          jobGrade: formData.jobGrade ?? null,
          workLocation: formData.workLocation ?? null,
        });
        const historyResponse = await fetch(`/api/employees/${employeeId}/history`);
        const historyPayload = (await historyResponse.json().catch(() => ({
          employmentHistory: [],
          compensationHistory: [],
        }))) as EmployeeHistory;
        if (historyResponse.ok) {
          setHistory({
            employmentHistory: historyPayload.employmentHistory ?? [],
            compensationHistory: historyPayload.compensationHistory ?? [],
          });
        }
        setIsEditing(false);
        setSuccess('Employee information updated successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as Employee['status'];
    void (async () => {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          branchId: organization?.branchId ?? undefined,
          departmentId: organization?.departmentId ?? undefined,
          costCenterId: organization?.costCenterId ?? undefined,
          payrollGroupId: organization?.payrollGroupId ?? undefined,
          jobGrade: organization?.jobGrade ?? undefined,
          workLocation: organization?.workLocation ?? undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? 'Failed to update status');
        return;
      }
      setEmployee(payload.employee);
      setSuccess('Status updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    })();
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!employee || !session) {
    return <div className="text-center py-12 text-red-600">{error || 'Employee not found'}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {employee.firstName} {employee.lastName}
          </h2>
          <p className="text-gray-600 mt-1">{employee.employeeNumber} • {employee.position}</p>
        </div>
        <div className="flex items-center gap-3">
          {canManageEmployee ? (
            <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
              <DialogTrigger asChild>
                <Button>Request change</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Submit employee change request</DialogTitle>
                  <DialogDescription>Create an approval-backed request for compensation, bank, or employment changes.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="requestType">Request type</Label>
                      <select id="requestType" name="requestType" value={requestForm.requestType} onChange={handleRequestFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                        <option value="compensation">Compensation</option>
                        <option value="bank_details">Bank details</option>
                        <option value="employment">Employment change</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requestEffectiveFrom">Effective from</Label>
                      <Input id="requestEffectiveFrom" name="effectiveFrom" type="date" value={requestForm.effectiveFrom} onChange={handleRequestFormChange} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Input id="reason" name="reason" value={requestForm.reason} onChange={handleRequestFormChange} required />
                  </div>

                  {requestForm.requestType === 'compensation' ? (
                    <div className="space-y-2">
                      <Label htmlFor="baseSalary">Proposed base salary</Label>
                      <Input id="baseSalary" name="baseSalary" type="number" value={requestForm.baseSalary} onChange={handleRequestFormChange} />
                    </div>
                  ) : null}

                  {requestForm.requestType === 'bank_details' ? (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bankName">Bank name</Label>
                        <Input id="bankName" name="bankName" value={requestForm.bankName} onChange={handleRequestFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bankCode">Bank code</Label>
                        <Input id="bankCode" name="bankCode" value={requestForm.bankCode} onChange={handleRequestFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="accountNumber">Account number</Label>
                        <Input id="accountNumber" name="accountNumber" value={requestForm.accountNumber} onChange={handleRequestFormChange} />
                      </div>
                    </div>
                  ) : null}

                  {requestForm.requestType === 'employment' ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="branchId">Branch</Label>
                        <select id="branchId" name="branchId" value={requestForm.branchId} onChange={handleRequestFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option value="">No branch</option>
                          {structure.branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="departmentId">Department</Label>
                        <select id="departmentId" name="departmentId" value={requestForm.departmentId} onChange={handleRequestFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option value="">No department</option>
                          {structure.departments.map((department) => (
                            <option key={department.id} value={department.id}>{department.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="costCenterId">Cost center</Label>
                        <select id="costCenterId" name="costCenterId" value={requestForm.costCenterId} onChange={handleRequestFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option value="">No cost center</option>
                          {structure.costCenters.map((costCenter) => (
                            <option key={costCenter.id} value={costCenter.id}>{costCenter.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="payrollGroupId">Payroll group</Label>
                        <select id="payrollGroupId" name="payrollGroupId" value={requestForm.payrollGroupId} onChange={handleRequestFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option value="">Default monthly group</option>
                          {structure.payrollGroups.map((group) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="position">Position</Label>
                        <Input id="position" name="position" value={requestForm.position} onChange={handleRequestFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employmentType">Employment type</Label>
                        <select id="employmentType" name="employmentType" value={requestForm.employmentType} onChange={handleRequestFormChange} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                          <option value="permanent">Permanent</option>
                          <option value="contract">Contract</option>
                          <option value="casual">Casual</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="jobGrade">Job grade</Label>
                        <Input id="jobGrade" name="jobGrade" value={requestForm.jobGrade} onChange={handleRequestFormChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="workLocation">Work location</Label>
                        <Input id="workLocation" name="workLocation" value={requestForm.workLocation} onChange={handleRequestFormChange} />
                      </div>
                    </div>
                  ) : null}

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Submit request</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : null}
          <Button variant="outline" onClick={() => router.back()}>
            Back
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General Info</TabsTrigger>
          <TabsTrigger value="compensation">Compensation</TabsTrigger>
          <TabsTrigger value="banking">Banking</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
        </TabsList>

        {/* General Information */}
        <TabsContent value="general">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>General Information</CardTitle>
              {canManageEmployee && !isEditing && (
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-6">
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="effectiveFrom">Change effective from</Label>
                      <Input
                        id="effectiveFrom"
                        name="effectiveFrom"
                        type="date"
                        value={formData.effectiveFrom || ''}
                        onChange={handleInputChange}
                      />
                      <p className="text-xs text-gray-500">Use today or a backdated effective date. Future-dated changes are not enabled yet.</p>
                    </div>
                  </div>
                ) : null}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    {isEditing ? (
                      <Input
                        id="firstName"
                        name="firstName"
                        value={formData.firstName || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{employee.firstName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    {isEditing ? (
                      <Input
                        id="lastName"
                        name="lastName"
                        value={formData.lastName || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{employee.lastName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    {isEditing ? (
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{employee.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    {isEditing ? (
                      <Input
                        id="phoneNumber"
                        name="phoneNumber"
                        value={formData.phoneNumber || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{employee.phoneNumber}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="idNumber">ID Number</Label>
                    {isEditing ? (
                      <Input
                        id="idNumber"
                        name="idNumber"
                        value={formData.idNumber || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{employee.idNumber}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="taxPin">Tax PIN</Label>
                    {isEditing ? (
                      <Input
                        id="taxPin"
                        name="taxPin"
                        value={formData.taxPin || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{employee.taxPin}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department</Label>
                    {isEditing ? (
                      <select
                        id="departmentId"
                        name="departmentId"
                        value={formData.departmentId || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">No department</option>
                        {structure.departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-2 text-gray-900">{employee.department}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="position">Position</Label>
                    {isEditing ? (
                      <Input
                        id="position"
                        name="position"
                        value={formData.position || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{employee.position}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branchId">Branch</Label>
                    {isEditing ? (
                      <select
                        id="branchId"
                        name="branchId"
                        value={formData.branchId || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">No branch</option>
                        {structure.branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-2 text-gray-900">{structure.branches.find((branch) => branch.id === organization?.branchId)?.name ?? 'Not assigned'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costCenterId">Cost Center</Label>
                    {isEditing ? (
                      <select
                        id="costCenterId"
                        name="costCenterId"
                        value={formData.costCenterId || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">No cost center</option>
                        {structure.costCenters.map((costCenter) => (
                          <option key={costCenter.id} value={costCenter.id}>
                            {costCenter.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-2 text-gray-900">{structure.costCenters.find((costCenter) => costCenter.id === organization?.costCenterId)?.name ?? 'Not assigned'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payrollGroupId">Payroll Group</Label>
                    {isEditing ? (
                      <select
                        id="payrollGroupId"
                        name="payrollGroupId"
                        value={formData.payrollGroupId || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Default monthly group</option>
                        {structure.payrollGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="py-2 text-gray-900">{structure.payrollGroups.find((group) => group.id === organization?.payrollGroupId)?.name ?? 'Default monthly group'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jobGrade">Job Grade</Label>
                    {isEditing ? (
                      <Input
                        id="jobGrade"
                        name="jobGrade"
                        value={formData.jobGrade || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{organization?.jobGrade || 'Not set'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workLocation">Work Location</Label>
                    {isEditing ? (
                      <Input
                        id="workLocation"
                        name="workLocation"
                        value={formData.workLocation || ''}
                        onChange={handleInputChange}
                      />
                    ) : (
                      <p className="py-2 text-gray-900">{organization?.workLocation || 'Not set'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="employmentType">Employment Type</Label>
                    {isEditing ? (
                      <select
                        id="employmentType"
                        name="employmentType"
                        value={formData.employmentType || 'permanent'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="permanent">Permanent</option>
                        <option value="contract">Contract</option>
                        <option value="casual">Casual</option>
                      </select>
                    ) : (
                      <p className="py-2 text-gray-900 capitalize">{employee.employmentType}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    {canManageEmployee ? (
                      <select
                        id="status"
                        value={employee.status}
                        onChange={handleStatusChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on_leave">On Leave</option>
                        <option value="terminated">Terminated</option>
                      </select>
                    ) : (
                      <p className="py-2 text-gray-900">{getStatusDisplayName(employee.status)}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Joining Date</Label>
                    <p className="py-2 text-gray-900">{formatDate(employee.joiningDate)}</p>
                  </div>
                </div>

                {canManageEmployee && isEditing && (
                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          ...employee,
                          branchId: organization?.branchId ?? '',
                          departmentId: organization?.departmentId ?? '',
                          costCenterId: organization?.costCenterId ?? '',
                          payrollGroupId: organization?.payrollGroupId ?? '',
                          jobGrade: organization?.jobGrade ?? '',
                          workLocation: organization?.workLocation ?? '',
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compensation */}
        <TabsContent value="compensation">
          <Card>
            <CardHeader>
              <CardTitle>Compensation & Benefits</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Salary</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="baseSalary">Base Salary (KES)</Label>
                      {isEditing ? (
                        <Input
                          id="baseSalary"
                          name="baseSalary"
                          type="number"
                          value={formData.baseSalary || employee.baseSalary}
                          onChange={handleInputChange}
                        />
                      ) : (
                        <p className="py-2 text-gray-900">{formatCurrency(employee.baseSalary)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Allowances</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {['housing', 'transport', 'medical', 'meal'].map(key => (
                      <div key={key} className="space-y-2">
                        <Label className="capitalize">{key} Allowance</Label>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={(formData.allowances?.[key as keyof typeof formData.allowances] as number) || 0}
                            onChange={(e) => handleAllowanceChange(key, e.target.value)}
                          />
                        ) : (
                          <p className="py-2 text-gray-900">
                            {formatCurrency((employee.allowances?.[key as keyof typeof employee.allowances] as number) || 0)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Deductions</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {['nssf', 'nhif', 'unionFees'].map(key => (
                      <div key={key} className="space-y-2">
                        <Label className="capitalize">{key}</Label>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={(formData.deductions?.[key as keyof typeof formData.deductions] as number) || 0}
                            onChange={(e) => handleDeductionChange(key, e.target.value)}
                          />
                        ) : (
                          <p className="py-2 text-gray-900">
                            {formatCurrency((employee.deductions?.[key as keyof typeof employee.deductions] as number) || 0)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {canManageEmployee && isEditing && (
                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          ...employee,
                          branchId: organization?.branchId ?? '',
                          departmentId: organization?.departmentId ?? '',
                          costCenterId: organization?.costCenterId ?? '',
                          payrollGroupId: organization?.payrollGroupId ?? '',
                          jobGrade: organization?.jobGrade ?? '',
                          workLocation: organization?.workLocation ?? '',
                        });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banking */}
        <TabsContent value="banking">
          <Card>
            <CardHeader>
              <CardTitle>Banking Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bank Name</Label>
                    <p className="py-2 text-gray-900">{employee.bankName}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <p className="py-2 text-gray-900">{employee.accountNumber}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Bank Code</Label>
                    <p className="py-2 text-gray-900">{employee.bankCode}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Employment history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {history.employmentHistory.length > 0 ? (
                  history.employmentHistory.map((record) => (
                    <div key={record.id} className="rounded-xl border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{record.jobTitle}</p>
                          <p className="text-sm text-gray-600">
                            {record.departmentName ?? 'No department'} · {record.employmentType}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs ${record.isCurrent ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                          {record.isCurrent ? 'Current' : 'Closed'}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-gray-600">
                        <p>Effective: {record.effectiveFrom} {record.effectiveTo ? `to ${record.effectiveTo}` : 'onward'}</p>
                        <p>Branch: {record.branchName ?? 'Not assigned'}</p>
                        <p>Cost center: {record.costCenterName ?? 'Not assigned'}</p>
                        <p>Payroll group: {record.payrollGroupName ?? 'Default monthly group'}</p>
                        <p>Grade / location: {record.jobGrade ?? 'N/A'} / {record.workLocation ?? 'N/A'}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No employment history found yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Compensation history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {history.compensationHistory.length > 0 ? (
                  history.compensationHistory.map((record) => (
                    <div key={record.id} className="rounded-xl border border-gray-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-gray-900">{formatCurrency(record.baseSalary)}</p>
                          <p className="text-sm text-gray-600">
                            {record.salaryFrequency} · {record.paymentMethod}
                          </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs ${record.isCurrent ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700'}`}>
                          {record.isCurrent ? 'Current' : 'Closed'}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-gray-600">
                        <p>Effective: {record.effectiveFrom} {record.effectiveTo ? `to ${record.effectiveTo}` : 'onward'}</p>
                        <p>
                          Allowances: {Object.entries(record.allowances).length > 0 ? Object.entries(record.allowances).map(([key, value]) => `${key} ${formatCurrency(Number(value))}`).join(', ') : 'None'}
                        </p>
                        <p>
                          Deductions: {Object.entries(record.recurringDeductions).length > 0 ? Object.entries(record.recurringDeductions).map(([key, value]) => `${key} ${formatCurrency(Number(value))}`).join(', ') : 'None'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-600">No compensation history found yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Change requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {requests.length > 0 ? (
                requests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-gray-900 capitalize">{request.payload.requestType.replace('_', ' ')}</p>
                        <p className="text-sm text-gray-600">
                          Effective {request.payload.effectiveFrom} · {request.payload.reason}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs ${request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : request.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-gray-600">
                      <p>Created: {new Date(request.createdAt).toLocaleString()}</p>
                      <p>Changes: {Object.entries(request.payload.changes).map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`).join(' | ')}</p>
                      {request.actions.length > 0 ? (
                        <p className="mt-2">Trail: {request.actions.map((action) => `${action.action} ${action.comments ? `(${action.comments})` : ''}`).join(' → ')}</p>
                      ) : null}
                    </div>
                    {canReviewRequests && request.status === 'pending' ? (
                      <div className="mt-4 flex gap-3">
                        <Button size="sm" onClick={() => void handleReviewRequest(request.id, 'approved')}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleReviewRequest(request.id, 'rejected')}>
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-600">No change requests submitted yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
