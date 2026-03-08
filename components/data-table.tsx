'use client';

import { useState } from 'react';
import { ArrowUpDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  pagination?: boolean;
  pageSize?: number;
  searchPlaceholder?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowClick,
  searchable = true,
  searchKeys = [],
  pagination = true,
  pageSize = 10,
  searchPlaceholder = 'Search records',
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  let filtered = data;
  if (searchable && searchTerm && searchKeys.length > 0) {
    filtered = data.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }

  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      return aVal < bVal ? (sortOrder === 'asc' ? -1 : 1) : sortOrder === 'asc' ? 1 : -1;
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedData = pagination ? filtered.slice(startIdx, startIdx + pageSize) : filtered;

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {searchable && searchKeys.length > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              className="h-12 rounded-2xl border-border/70 bg-card pl-11 pr-11"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card/80 shadow-[0_18px_40px_-30px_rgba(24,39,75,0.2)] backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-secondary/65">
              <tr>
                {columns.map((column) => (
                  <th
                    key={String(column.key)}
                    className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                    style={{ width: column.width }}
                  >
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(column.key)}
                        className="inline-flex items-center gap-2 transition hover:text-foreground"
                      >
                        <span>{column.label}</span>
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-5 py-14 text-center text-sm text-muted-foreground">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick?.(row)}
                    className="border-t border-border/60 transition hover:bg-secondary/45"
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        className="px-5 py-4 text-sm text-foreground"
                      >
                        {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && filtered.length > pageSize ? (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {startIdx + 1}-{Math.min(startIdx + pageSize, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => setCurrentPage((value) => Math.max(1, value - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl"
              onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
