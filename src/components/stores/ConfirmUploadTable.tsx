import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft, ChevronRight, Merge } from 'lucide-react';
import type { ValidatedRow, DuplicateGroup } from '@/lib/uploadValidation';

interface ConfirmUploadTableProps {
  rows: ValidatedRow[];
  duplicates: DuplicateGroup[];
  duplicateActions: Record<string, 'append' | 'combine' | 'skip' | 'create_new' | 'update'>;
  columns: string[];
}

const PAGE_SIZE = 25;

export default function ConfirmUploadTable({
  rows,
  duplicates,
  duplicateActions,
  columns,
}: ConfirmUploadTableProps) {
  const [page, setPage] = useState(0);

  const validRows = rows.filter(r => r.status === 'valid');

  // Build lookup: rowNumber → duplicate info
  const rowDupMap = new Map<number, { group: DuplicateGroup; action: string; isPrimary: boolean; isSecondary: boolean }>();
  for (const dup of duplicates) {
    const action = duplicateActions[dup.key] || 'skip';
    for (let i = 0; i < dup.fileRows.length; i++) {
      const rowNum = dup.fileRows[i];
      rowDupMap.set(rowNum, {
        group: dup,
        action,
        isPrimary: i === 0,
        isSecondary: i > 0,
      });
    }
  }

  // Filter out secondary combined rows from the display — they are merged into the primary
  const displayRows = validRows.filter(r => {
    const dupInfo = rowDupMap.get(r.rowNumber);
    if (dupInfo?.action === 'combine' && dupInfo.isSecondary) return false;
    if (dupInfo?.action === 'skip') return false;
    return true;
  });

  const skippedCount = validRows.length - displayRows.length;
  const mergedCount = duplicates.filter(d => (duplicateActions[d.key] || 'skip') === 'combine').length;

  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE);
  const pageRows = displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Get display columns from the first valid row
  const displayKeys = validRows.length > 0
    ? Object.keys(validRows[0].data).filter(k => validRows[0].data[k] !== undefined && validRows[0].data[k] !== null)
    : [];

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span>{displayRows.length} records to upload</span>
          {mergedCount > 0 && (
            <Badge className="text-[10px] bg-purple-500 hover:bg-purple-600 text-white">
              <Merge className="h-3 w-3 mr-1" />
              {mergedCount} merged
            </Badge>
          )}
          {skippedCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {skippedCount} skipped
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs">
            Page {page + 1} of {totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <ScrollArea className="h-[400px]">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  {displayKeys.slice(0, 8).map(key => (
                    <TableHead key={key} className="min-w-[120px] capitalize">
                      {key.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => {
                  const dupInfo = rowDupMap.get(row.rowNumber);
                  const isMerged = dupInfo?.action === 'combine' && dupInfo.isPrimary;
                  const isAppend = dupInfo?.action === 'append';
                  const isUpdate = dupInfo?.action === 'update';
                  const isDbDup = dupInfo?.group.existingStore;

                  return (
                    <TableRow
                      key={row.rowNumber}
                      className={
                        isMerged
                          ? 'bg-purple-500/5 border-l-2 border-l-purple-500'
                          : isAppend
                            ? 'bg-amber-500/5 border-l-2 border-l-amber-500'
                            : isUpdate
                              ? 'bg-blue-500/5 border-l-2 border-l-blue-500'
                              : ''
                      }
                    >
                      <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isMerged && (
                            <Badge className="text-[10px] bg-purple-500 hover:bg-purple-600 text-white">
                              <Merge className="h-3 w-3 mr-0.5" />
                              Merged
                            </Badge>
                          )}
                          {!dupInfo && (
                            <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">
                              New
                            </Badge>
                          )}
                          {isAppend && (
                            <Badge className="text-[10px] bg-amber-500 hover:bg-amber-600">
                              Append
                            </Badge>
                          )}
                          {isUpdate && (
                            <Badge className="text-[10px] bg-blue-500 hover:bg-blue-600">
                              Update
                            </Badge>
                          )}
                          {isDbDup && isMerged && (
                            <Badge variant="outline" className="text-[10px] border-purple-400 text-purple-600">
                              + Exists
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {displayKeys.slice(0, 8).map(key => {
                        const val = row.data[key];
                        const isMergedField = isMerged && val !== undefined && val !== null && val !== '';
                        const isAppendField = isAppend && val !== undefined && val !== null && val !== '';
                        const isUpdateField = isUpdate && val !== undefined && val !== null;
                        return (
                          <TableCell
                            key={key}
                            className={`text-xs truncate max-w-[180px] ${isMergedField ? 'font-semibold text-purple-700 dark:text-purple-400' : ''} ${isAppendField ? 'font-semibold text-amber-700 dark:text-amber-400' : ''} ${isUpdateField ? 'font-semibold text-blue-700 dark:text-blue-400' : ''}`}
                            title={String(val ?? '')}
                          >
                            {val !== undefined && val !== null ? String(val) : <span className="text-muted-foreground italic">—</span>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Badge variant="outline" className="text-[9px] border-green-500 text-green-600 px-1">New</Badge>
          Fresh record
        </span>
        <span className="flex items-center gap-1">
          <Badge className="text-[9px] bg-purple-500 text-white px-1">
            <Merge className="h-2.5 w-2.5 mr-0.5" />
            Merged
          </Badge>
          Combined duplicates
        </span>
        <span className="flex items-center gap-1">
          <Badge className="text-[9px] bg-amber-500 px-1">Append</Badge>
          Updates existing store
        </span>
        <span className="flex items-center gap-1">
          <Badge className="text-[9px] bg-blue-500 text-white px-1">Update</Badge>
          Overwrites existing
        </span>
      </div>
    </div>
  );
}
