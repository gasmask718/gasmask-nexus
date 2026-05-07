/**
 * LastUserLogsTable — Admin audit view of the most recent VA session per Brandaro phone number.
 * Reads from the `brandaro_number_last_sessions` view (RLS gated to admins).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, History, Phone } from 'lucide-react';
import { DataTablePagination } from '@/components/crud/DataTablePagination';

const PAGE_SIZE = 25;

type Row = {
  number_id: string;
  phone_number: string;
  friendly_name: string | null;
  in_use: boolean | null;
  session_id: string | null;
  last_va_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  va_name?: string | null;
  va_email?: string | null;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return '—';
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const sec = Math.max(0, Math.floor((endMs - startMs) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LastUserLogsTable() {
  const [page, setPage] = useState(1);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['brandaro-number-last-sessions'],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await (supabase as any)
        .from('brandaro_number_last_sessions')
        .select('*')
        .order('started_at', { ascending: false, nullsFirst: false });
      if (error) throw error;

      const base = (data ?? []) as Row[];
      const vaIds = Array.from(new Set(base.map(r => r.last_va_id).filter(Boolean))) as string[];
      if (vaIds.length === 0) return base;

      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, full_name, email')
        .in('id', vaIds);

      const map = new Map<string, { full_name: string | null; email: string | null }>();
      (profiles ?? []).forEach((p: any) => map.set(p.id, { full_name: p.full_name, email: p.email }));

      return base.map(r => ({
        ...r,
        va_name: r.last_va_id ? map.get(r.last_va_id)?.full_name ?? null : null,
        va_email: r.last_va_id ? map.get(r.last_va_id)?.email ?? null : null,
      }));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" />
          Phone Number — Last User Audit Log
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Most recent VA session per Twilio number. Active sessions show as “Currently Active”.
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
                              {r.va_name || r.va_email || 'Unknown VA'}
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
