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

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [session, setSession] = useState<AuthSession | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState<Partial<Employee>>({});

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

      const emp = await db.getEmployee(employeeId);
      if (emp && emp.companyId === sess.companyId) {
        setEmployee(emp);
        setFormData(emp);
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

    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? 'Failed to save changes');
      }

      if (payload.employee) {
        setEmployee(payload.employee);
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
        body: JSON.stringify({ status: newStatus }),
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
              {!isEditing && (
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
                      <Input
                        id="department"
                        name="department"
                        value={formData.department || ''}
                        onChange={handleInputChange}
                      />
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
                  </div>

                  <div className="space-y-2">
                    <Label>Joining Date</Label>
                    <p className="py-2 text-gray-900">{formatDate(employee.joiningDate)}</p>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData(employee);
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

                {isEditing && (
                  <div className="flex gap-3 justify-end pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false);
                        setFormData(employee);
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
