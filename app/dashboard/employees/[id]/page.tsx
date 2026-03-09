'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { authService, AuthSession } from '@/lib/auth';
import { db, Employee } from '@/lib/db-schema';
import { formatCurrency, getStatusDisplayName, formatDate } from '@/lib/utils-hr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

type EmployeeEditor = Partial<Employee> & {
  branchId?: string;
  departmentId?: string;
  costCenterId?: string;
  payrollGroupId?: string;
  jobGrade?: string;
  workLocation?: string;
};

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [structure, setStructure] = useState<CompanyStructure>({ branches: [], departments: [], costCenters: [], payrollGroups: [] });
  const [organization, setOrganization] = useState<EmployeeOrganization | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState<EmployeeEditor>({});
  const canManageEmployee = session?.userRole === 'admin' || session?.userRole === 'manager';

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

      const [emp, structureResponse, organizationResponse] = await Promise.all([
        db.getEmployee(employeeId),
        fetch('/api/company-structure'),
        fetch(`/api/employees/${employeeId}/organization`),
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
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
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
      </Tabs>
    </div>
  );
}
