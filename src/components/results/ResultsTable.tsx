// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS TABLE — Data Table with Selection and Actions
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryResult } from '@/lib/commands/CommandEngine';

interface ResultsTableProps {
  data: QueryResult[];
  loading?: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onRowClick?: (result: QueryResult) => void;
  columns?: TableColumn[];
  pageSize?: number;
}

interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: QueryResult) => React.ReactNode;
}

const defaultColumns: TableColumn[] = [
  { key: 'title', label: 'Name', sortable: true },
  { key: 'subtitle', label: 'Details', sortable: false },
  { key: 'type', label: 'Type', sortable: true },
];

export function ResultsTable({
  data,
  loading,
  selectedIds,
  onSelectionChange,
  onRowClick,
  columns = defaultColumns,
  pageSize = 25,
}: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(0);

  const handleSelectAll = () => {
    if (selectedIds.size === data.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map((r) => r.id)));
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    
    return [...data].sort((a, b) => {
      const aVal = a[sortKey as keyof QueryResult] || a.data?.[sortKey];
      const bVal = b[sortKey as keyof QueryResult] || b.data?.[sortKey];
      
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [data, sortKey, sortDir]);

  const paginatedData = useMemo(() => {
    const start = currentPage * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(data.length / pageSize);
  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isPartialSelected = selectedIds.size > 0 && selectedIds.size < data.length;

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-lg font-medium">No results found</p>
        <p className="text-sm">Try adjusting your filters or search terms</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/50 backdrop-blur">
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={isAllSelected}
                ref={(el) => {
                  if (el) (el as HTMLButtonElement).dataset.state = isPartialSelected ? 'indeterminate' : undefined;
                }}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(col.sortable && 'cursor-pointer hover:text-foreground')}
                onClick={() => col.sortable && handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                  )}
                </div>
              </TableHead>
            ))}
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                'cursor-pointer hover:bg-muted/50 transition-colors',
                selectedIds.has(row.id) && 'bg-primary/5'
              )}
              onClick={() => onRowClick?.(row)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(row.id)}
                  onCheckedChange={() => handleSelectRow(row.id)}
                />
              </TableCell>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.render
                    ? col.render(row[col.key as keyof QueryResult] || row.data?.[col.key], row)
                    : col.key === 'type'
                    ? <Badge variant="outline" className="capitalize">{String(row[col.key as keyof QueryResult])}</Badge>
                    : String(row[col.key as keyof QueryResult] ?? row.data?.[col.key] ?? '-')}
                </TableCell>
              ))}
              <TableCell>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, data.length)} of {data.length}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultsTable;
