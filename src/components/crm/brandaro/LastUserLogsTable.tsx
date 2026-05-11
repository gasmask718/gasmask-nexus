/**
 * LastUserLogsTable — Admin audit view of the most recent VA session per Brandaro phone number.
 * Reads from the `brandaro_number_last_sessions` view (RLS gated to admins).
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Phone, PhoneOutgoing } from 'lucide-react';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import {
  useNumberLastSessions,
  formatDateTime,
  formatDuration,
} from '@/hooks/useNumberLastSessions';

const PAGE_SIZE = 25;

export default function LastUserLogsTable() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNumberLastSessions();
  const rows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" />
          Phone Logs — Number Activity & Daily Dials
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Most recent VA session per Twilio number, plus today's dial count (resets daily) and lifetime totals.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No phone numbers found.
          </div>
        ) : (() => {
          const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
          const currentPage = Math.min(page, totalPages);
          const paginated = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
          return (
          <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Twilio Number</TableHead>
                  <TableHead>Last User</TableHead>
                  <TableHead>Session Start</TableHead>
                  <TableHead>Session End</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Dialed Today</TableHead>
                  <TableHead className="text-right">Total Dials</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((r) => {
                  const active = !!r.session_id && !r.ended_at;
                  return (
                    <TableRow key={r.number_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <div className="font-mono text-sm">{r.phone_number}</div>
                            {r.friendly_name && (
                              <div className="text-[11px] text-muted-foreground">{r.friendly_name}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {r.last_va_id ? (
                          <div>
                            <div className="text-sm font-medium">
                              {r.va_name || 'Unknown VA'}
                            </div>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              {r.last_va_id.slice(0, 8)}…
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never used</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatDateTime(r.started_at)}</TableCell>
                      <TableCell>
                        {active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Currently Active
                          </Badge>
                        ) : (
                          <span className="text-sm">{formatDateTime(r.ended_at)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {r.session_id ? formatDuration(r.started_at, r.ended_at) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            r.today_dials > 0
                              ? 'font-mono bg-cyan-500/10 text-cyan-600 border-cyan-500/30'
                              : 'font-mono text-muted-foreground'
                          }
                        >
                          <PhoneOutgoing className="h-3 w-3 mr-1" />
                          {r.today_dials}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {r.total_dials}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalItems={rows.length}
            onPageChange={setPage}
          />
          </>
          );
        })()}
      </CardContent>
    </Card>
  );
}