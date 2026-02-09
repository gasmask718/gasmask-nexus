import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ValidatedRow, DuplicateGroup } from '@/lib/uploadValidation';

interface ConfirmUploadTableProps {
  rows: ValidatedRow[];
  duplicates: DuplicateGroup[];
  duplicateActions: Record<string, 'append' | 'skip' | 'create_new'>;
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
  const totalPages = Math.ceil(validRows.length / PAGE_SIZE);
  const pageRows = validRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Build lookup: rowNumber → duplicate info
  const rowDupMap = new Map<number, { group: DuplicateGroup; action: string }>();
  for (const dup of duplicates) {
    const action = duplicateActions[dup.key] || 'skip';
    for (const rowNum of dup.fileRows) {
      rowDupMap.set(rowNum, { group: dup, action });
    }
  }

  // Get display columns from the first valid row
  const displayKeys = validRows.length > 0
    ? Object.keys(validRows[0].data).filter(k => validRows[0].data[k] !== undefined && validRows[0].data[k] !== null)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{validRows.length} records to upload</span>
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
                  const isAppend = dupInfo?.action === 'append';
                  const isSkip = dupInfo?.action === 'skip' && dupInfo.group.fileRows.indexOf(row.rowNumber) > 0;
                  const isDbDup = dupInfo?.group.existingStore;

                  return (
                    <TableRow
                      key={row.rowNumber}
                      className={
                        isSkip
                          ? 'opacity-40 line-through'
                          : isAppend
                            ? 'bg-amber-500/5 border-l-2 border-l-amber-500'
                            : ''
                      }
                    >
                      <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
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
                          {isSkip && (
                            <Badge variant="secondary" className="text-[10px]">
                              Skip
                            </Badge>
                          )}
                          {isDbDup && !isSkip && !isAppend && (
                            <Badge variant="destructive" className="text-[10px]">
                              Exists
                            </Badge>
                          )}
                          {dupInfo && !dupInfo.group.existingStore && (
                            <Badge variant="secondary" className="text-[10px] border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-900/20">
                              File Dup
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      {displayKeys.slice(0, 8).map(key => {
                        const val = row.data[key];
                        // Highlight fields that will be appended to existing record
                        const isAppendField = isAppend && val !== undefined && val !== null && val !== '';
                        return (
                          <TableCell
                            key={key}
                            className={`text-xs truncate max-w-[180px] ${isAppendField ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}`}
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
          <Badge className="text-[9px] bg-amber-500 px-1">Append</Badge>
          Updates existing store
        </span>
        <span className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[9px] px-1">Skip</Badge>
          Will be skipped
        </span>
        <span className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[9px] border-orange-400 text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-1">File Dup</Badge>
          Duplicate in file
        </span>
      </div>
    </div>
  );
}