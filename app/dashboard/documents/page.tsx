'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileStack, FolderOpen, ShieldCheck } from 'lucide-react';
import { authService, AuthSession } from '@/lib/auth';
import { canManageDocuments as canManageDocumentsByRole } from '@/lib/platform/roles';
import { DataTable } from '@/components/data-table';
import { MetricCard } from '@/components/app/metric-card';
import { PageHeader } from '@/components/app/page-header';
import { StatusPill } from '@/components/app/status-pill';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

interface DocumentRecord {
  id: string;
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  documentType: string;
  filePath: string;
  status: string;
  metadata: Record<string, string>;
  createdAt: string;
}

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  employeeName: string;
}

export default function DocumentsPage() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    documentType: 'contract',
    title: '',
    filePath: '',
    notes: '',
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const currentSession = await authService.getSession();
      if (!mounted || !currentSession) return;
      setSession(currentSession);

      const response = await fetch('/api/documents');
      const payload = (await response.json().catch(() => ({ documents: [], employees: [] }))) as {
        error?: string;
        documents?: DocumentRecord[];
        employees?: EmployeeOption[];
      };

      if (!mounted) return;
      if (!response.ok) {
        setError(payload.error ?? 'Unable to load employee documents.');
        return;
      }

      setDocuments(payload.documents ?? []);
      setEmployees(payload.employees ?? []);
      if ((payload.employees ?? []).length > 0) {
        setFormData((current) => ({
          ...current,
          employeeId: current.employeeId || payload.employees?.[0]?.id || '',
        }));
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const canManageDocuments = session ? canManageDocumentsByRole(session.userRole) : false;

  const activeDocuments = useMemo(
    () => documents.filter((document) => document.status === 'active').length,
    [documents]
  );

  const protectedEmployees = useMemo(
    () => new Set(documents.map((document) => document.employeeId).filter(Boolean)).size,
    [documents]
  );

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const response = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    const payload = (await response.json().catch(() => ({ documents: [], employees: [] }))) as {
      error?: string;
      documents?: DocumentRecord[];
      employees?: EmployeeOption[];
    };

    if (!response.ok) {
      setError(payload.error ?? 'Unable to store employee document.');
      return;
    }

    setDocuments(payload.documents ?? []);
    setEmployees(payload.employees ?? []);
    setIsUploadOpen(false);
    setSuccess('Employee document stored successfully.');
    setFormData((current) => ({
      ...current,
      title: '',
      filePath: '',
      notes: '',
    }));
  };

  const handleArchive = async (documentId: string) => {
    const response = await fetch(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    });
    const payload = (await response.json().catch(() => ({ document: null }))) as {
      error?: string;
      document?: DocumentRecord;
    };

    if (!response.ok || !payload.document) {
      setError(payload.error ?? 'Unable to archive employee document.');
      return;
    }

    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId
          ? {
              ...document,
              status: payload.document?.status ?? 'archived',
              metadata: payload.document?.metadata ?? document.metadata,
            }
          : document
      )
    );
    setSuccess('Employee document archived.');
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Documents"
        title={canManageDocuments ? 'Employee document control' : 'My documents'}
        description={
          canManageDocuments
            ? 'Store contracts, tax letters, and HR files against employee records with a controlled audit trail.'
            : 'Review the HR and payroll documents currently attached to your employee record.'
        }
        actions={
          canManageDocuments ? (
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl px-5">Add document</Button>
              </DialogTrigger>
              <DialogContent className="rounded-[28px] border-border/70 bg-background sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Attach employee document</DialogTitle>
                  <DialogDescription>Store the file path or public URL now; storage-bucket upload flows can layer on top later.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="employeeId">Employee</Label>
                      <select
                        id="employeeId"
                        value={formData.employeeId}
                        onChange={(event) => setFormData((current) => ({ ...current, employeeId: event.target.value }))}
                        className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card px-4 text-sm"
                      >
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.employeeNumber} · {employee.employeeName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="documentType">Document type</Label>
                      <Input
                        id="documentType"
                        value={formData.documentType}
                        onChange={(event) => setFormData((current) => ({ ...current, documentType: event.target.value }))}
                        className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                      className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                    />
                  </div>

                  <div>
                    <Label htmlFor="filePath">File path or URL</Label>
                    <Input
                      id="filePath"
                      value={formData.filePath}
                      onChange={(event) => setFormData((current) => ({ ...current, filePath: event.target.value }))}
                      className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                    />
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                      className="mt-2 h-12 rounded-2xl border-border/70 bg-card"
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setIsUploadOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-2xl">
                      Save document
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive" className="rounded-2xl border-destructive/30">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert className="rounded-2xl border-emerald-600/20 bg-emerald-500/10 text-emerald-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Documents" value={String(documents.length)} detail="Records currently registered in the workspace" icon={<FileStack className="h-5 w-5" />} tone="primary" />
        <MetricCard label="Active files" value={String(activeDocuments)} detail="Documents currently available to operations" icon={<ShieldCheck className="h-5 w-5" />} tone="accent" />
        <MetricCard label="Covered staff" value={String(protectedEmployees)} detail="Employees with at least one linked document" icon={<FolderOpen className="h-5 w-5" />} tone="neutral" />
      </section>

      <DataTable
        data={documents}
        columns={[
          ...(canManageDocuments
            ? [
                {
                  key: 'employeeName' as const,
                  label: 'Employee',
                  render: (_value, row) => (
                    <div>
                      <p className="font-medium text-foreground">{row.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{row.employeeNumber}</p>
                    </div>
                  ),
                },
              ]
            : []),
          { key: 'documentType', label: 'Type', sortable: true },
          {
            key: 'metadata',
            label: 'Title',
            render: (value) => (value as Record<string, string> | undefined)?.title || 'Untitled document',
          },
          {
            key: 'status',
            label: 'Status',
            render: (value) => (
              <StatusPill
                label={String(value)}
                tone={value === 'active' ? 'success' : value === 'archived' ? 'neutral' : 'warning'}
              />
            ),
          },
          {
            key: 'createdAt',
            label: 'Registered',
            sortable: true,
            render: (value) => new Date(String(value)).toLocaleDateString(),
          },
          {
            key: 'filePath',
            label: 'Open',
            render: (value) => (
              <a
                href={String(value)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                onClick={(event) => event.stopPropagation()}
              >
                Open
              </a>
            ),
          },
          ...(canManageDocuments
            ? [
                {
                  key: 'id' as const,
                  label: 'Action',
                  render: (_value, row) =>
                    row.status === 'active' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-2xl"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleArchive(row.id);
                        }}
                      >
                        Archive
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Locked</span>
                    ),
                },
              ]
            : []),
        ]}
        searchable
        searchKeys={canManageDocuments ? ['employeeName', 'employeeNumber', 'documentType'] : ['documentType']}
        searchPlaceholder={canManageDocuments ? 'Search employee documents' : 'Search my documents'}
      />
    </div>
  );
}
