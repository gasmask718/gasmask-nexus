/**
 * LastUserLogsTable — Admin audit view of the most recent VA session per Brandaro phone number.
 * Reads from the `brandaro_number_last_sessions` view (RLS gated to admins).
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, History, Phone, PhoneOutgoing, Unlock } from 'lucide-react';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  useNumberLastSessions,
  formatDateTime,
  formatDuration,
} from '@/hooks/useNumberLastSessions';

const PAGE_SIZE = 25;

export default function LastUserLogsTable() {
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useNumberLastSessions();
  const queryClient = useQueryClient();
  const rows = data?.rows ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['brandaro-number-last-sessions'] });
    queryClient.invalidateQueries({ queryKey: ['admin-phone-numbers'] });
  };

  // Optimistically patch a row in the cached query data so the UI updates instantly.
  const patchRow = (numberId: string, patch: Record<string, any>) => {
    queryClient.setQueryData<any>(['brandaro-number-last-sessions'], (prev: any) => {
      if (!prev?.rows) return prev;
      const rows = prev.rows.map((r: any) =>
        r.number_id === numberId ? { ...r, ...patch } : r
      );
      const byId = new Map(prev.byId ?? []);
      const existing = byId.get(numberId);
      if (existing) byId.set(numberId, { ...existing, ...patch });
      return { rows, byId };
    });
  };

  const forceRelease = async (numberId: string) => {
    if (!confirm('Force-release this number? Any active VA session will be ended.')) return;
    setBusyId(numberId);
    try {
      const { error: e1 } = await (supabase as any)
        .from('brandaro_phone_numbers')
        .update({ in_use: false, assigned_va_id: null })
        .eq('id', numberId);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any)
        .from('brandaro_number_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('number_id', numberId)
        .is('ended_at', null);
      if (e2) throw e2;
      // Optimistic UI: clear active session markers immediately.
      patchRow(numberId, {
        in_use: false,
        assigned_va_id: null,
        session_id: null,
        ended_at: new Date().toISOString(),
        session_active: false,
      });
      toast.success('Number released');
      invalidate();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to release number');
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (numberId: string, next: boolean) => {
    // Optimistic flip first so the switch reflects instantly.
    patchRow(numberId, { is_active: next });
    setBusyId(numberId);
    try {
      const { error } = await (supabase as any)
        .from('brandaro_phone_numbers')
        .update({ is_active: next })
        .eq('id', numberId);
      if (error) throw error;
      toast.success(next ? 'Number activated' : 'Number deactivated');
      invalidate();
    } catch (err: any) {
      // Roll back on failure.
      patchRow(numberId, { is_active: !next });
      toast.error(err.message ?? 'Failed to update number');
    } finally {
      setBusyId(null);
    }
  };

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
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={r.is_active !== false}
                            disabled={busyId === r.number_id}
                            onCheckedChange={(v) => toggleActive(r.number_id, v)}
                          />
                          <span className="text-[11px] text-muted-foreground">
                            {r.is_active !== false ? 'On' : 'Off'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={!active || busyId === r.number_id}
                          onClick={() => forceRelease(r.number_id)}
                          title={active ? 'Force release VA from this number' : 'No active session'}
                        >
                          {busyId === r.number_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Unlock className="h-3 w-3" />
                          )}
                          Force Release
                        </Button>
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