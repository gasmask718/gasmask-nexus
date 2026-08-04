import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, Plus, Download, Trash2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const PAGE_SIZE = 50;

type DncRow = {
  id: string;
  phone_number: string;
  phone_e164: string | null;
  business: string | null;
  source: string | null;
  reason: string | null;
  added_at: string | null;
  metadata: unknown;
};

// Replicates the trigger normalizeE164 logic: strip non-digits, prepend 1 if 10 digits,
// require final format +1XXXXXXXXXX (11 digits).
function normalizeE164(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return { ok: false, error: 'Enter a phone number' };
  const withCC = digits.length === 10 ? `1${digits}` : digits;
  if (withCC.length !== 11 || !withCC.startsWith('1')) {
    return { ok: false, error: 'Must be a US number (10 digits, or 11 starting with 1)' };
  }
  return { ok: true, value: `+${withCC}` };
}

function AddDncDialog({ open, onOpenChange, businesses }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  businesses: { business_key: string }[];
}) {
  const [phone, setPhone] = useState('');
  const [business, setBusiness] = useState<string>('');
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const normalized = normalizeE164(phone);

  const add = useMutation({
    mutationFn: async () => {
      if (!normalized.ok) throw new Error((normalized as { ok: false; error: string }).error);
      if (!business) throw new Error('Business unit required');
      if (reason.trim().length < 10) throw new Error('Reason must be at least 10 characters');
      try {
        // verifiedInsert throws when RLS silently drops the row instead of
        // returning an error (PostgREST 201/204 with zero rows).
        await verifiedInsert('add number to DNC list', () =>
          supabase.from('dnc_list').insert({
            phone_number: phone,
            phone_e164: normalized.value,
            source: 'manual_admin',
            business,
            reason: reason.trim(),
          }),
        );
      } catch (err) {
        const raw = err instanceof VerifiedMutationError ? err.cause : err;
        const code = (raw as { code?: string } | null)?.code;
        const msg = (raw as { message?: string } | null)?.message ?? '';
        if (code === '23505' || /duplicate|unique/i.test(msg)) {
          return { alreadyOnList: true };
        }
        throw err;
      }

      // Fire-and-forget immutable compliance audit event.
      try {
        await supabase.functions.invoke('dc-log-compliance-event', {
          body: {
            event_type: 'dnc_added',
            business_unit_key: business,
            actor: 'manual_admin',
            event_data: {
              phone_e164: normalized.value,
              reason: reason.trim(),
              source: 'manual_admin',
            },
          },
        });
      } catch (e) {
        console.error('[DCDNCManager] compliance log failed (non-fatal)', e);
      }
      return { alreadyOnList: false };
    },

    onSuccess: (res) => {
      if (res.alreadyOnList) {
        toast.message('Already on DNC list', { description: phone });
      } else {
        toast.success('Added to DNC list');
      }
      qc.invalidateQueries({ queryKey: ['dnc-list'] });
      setPhone(''); setBusiness(''); setReason('');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to DNC List</DialogTitle>
          <DialogDescription>Suppresses all outbound calls to this number.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Phone number</Label>
            <Input
              value={phone}
              inputMode="tel"
              autoComplete="tel"
              onChange={(e) => {
                // Enforce E.164 charset: digits only, with a single optional leading '+'
                const raw = e.target.value;
                const hasPlus = raw.trimStart().startsWith('+');
                const digits = raw.replace(/\D/g, '').slice(0, 15);
                setPhone(hasPlus ? `+${digits}` : digits);
              }}
              onKeyDown={(e) => {
                const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                if (allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
                if (e.key === '+' && (e.currentTarget.selectionStart ?? 0) === 0 && !phone.startsWith('+')) return;
                if (/^[0-9]$/.test(e.key)) return;
                e.preventDefault();
              }}
              placeholder="+15555550001"
            />
            <div className="text-xs mt-1">
              {phone && normalized.ok && (
                <span className="text-green-600 dark:text-green-400">Normalized: <span className="font-mono">{normalized.value}</span></span>
              )}
              {phone && !normalized.ok && (
                <span className="text-red-600 dark:text-red-400">{(normalized as { ok: false; error: string }).error}</span>
              )}
            </div>
          </div>
          <div>
            <Label>Business unit</Label>
            <Select value={business} onValueChange={setBusiness}>
              <SelectTrigger><SelectValue placeholder="Select business unit" /></SelectTrigger>
              <SelectContent>
                {businesses.map((b) => (
                  <SelectItem key={b.business_key} value={b.business_key}>{b.business_key}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason (min 10 chars)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why is this number being added?" />
            <div className="text-xs text-muted-foreground mt-1">{reason.trim().length} / 10</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => add.mutate()}
            disabled={add.isPending || !normalized.ok || !business || reason.trim().length < 10}
          >
            {add.isPending ? 'Adding…' : 'Add to DNC'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDncDialog({ row, open, onOpenChange }: {
  row: DncRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const qc = useQueryClient();

  const target = row?.phone_e164 ?? row?.phone_number ?? '';
  const armed = confirmText === target && !!target;

  const remove = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error('No row selected');
      if (!armed) throw new Error('Confirmation phone does not match');
      const { data: deleted, error: delErr } = await supabase
        .from('dnc_list')
        .delete()
        .eq('id', row.id)
        .select('id');
      if (delErr) throw delErr;
      if (!deleted || deleted.length === 0) {
        throw new Error(
          'Deletion blocked: no rows were removed. You may not have admin permission to remove DNC entries, or your session has expired. Please sign in again and retry.'
        );
      }

      const { error: logErr } = await supabase.from('dc_lead_sync_log').insert({
        sync_source: 'dnc_manual_removal',
        sync_direction: 'out',
        business_unit_key: row.business ?? 'unknown',
        lead_id: row.id, // dc_lead_sync_log.lead_id is NOT NULL; use dnc_list.id as the reference
        status_before: 'dnc',
        status_after: 'cleared',
        error_message: `Manual DNC removal by admin — ${reason.trim() || 'no reason provided'}`,
        success: true,
      });

      // Fire-and-forget immutable compliance audit event.
      try {
        await supabase.functions.invoke('dc-log-compliance-event', {
          body: {
            event_type: 'dnc_removed',
            business_unit_key: row.business ?? null,
            actor: 'manual_admin',
            event_data: {
              phone_e164: row.phone_e164 ?? row.phone_number,
              reason: reason.trim() || null,
            },
          },
        });
      } catch (e) {
        console.error('[DCDNCManager] compliance log failed (non-fatal)', e);
      }

      if (logErr) {
        // Deletion succeeded; log failure surfaces as warning.
        return { warning: `Removed, but sync log failed: ${logErr.message}` };
      }
      return { warning: null };
    },

    onSuccess: (res) => {
      if (res.warning) toast.warning(res.warning);
      else toast.success('Removed from DNC list');
      qc.invalidateQueries({ queryKey: ['dnc-list'] });
      setConfirmText(''); setReason('');
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setConfirmText(''); setReason(''); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" /> Remove from DNC
          </DialogTitle>
          <DialogDescription>
            This will allow outbound calls to this number again. Type the phone number exactly to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <div><span className="text-muted-foreground">Phone:</span> <span className="font-mono">{target}</span></div>
            <div><span className="text-muted-foreground">Business:</span> {row?.business ?? '—'}</div>
            <div><span className="text-muted-foreground">Reason on file:</span> {row?.reason ?? '—'}</div>
          </div>
          <div>
            <Label>Type <span className="font-mono">{target}</span> to confirm</Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={target} />
          </div>
          <div>
            <Label>Removal reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => remove.mutate()} disabled={!armed || remove.isPending}>
            {remove.isPending ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function DCDNCManager() {
  const [page, setPage] = useState(0);
  const [businessFilter, setBusinessFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [removeRow, setRemoveRow] = useState<DncRow | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: businesses = [] } = useQuery({
    queryKey: ['dc-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase.from('dc_businesses').select('business_key').order('business_key');
      if (error) throw error;
      return (data ?? []) as { business_key: string }[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dnc-list', page, businessFilter, search],
    queryFn: async () => {
      let q = supabase
        .from('dnc_list')
        .select('id, phone_number, phone_e164, business, source, reason, added_at, metadata', { count: 'exact' })
        .order('added_at', { ascending: false, nullsFirst: false });
      if (businessFilter !== 'all') q = q.eq('business', businessFilter);
      if (search.trim().length >= 2) {
        const term = search.replace(/[%,()]/g, '').trim();
        q = q.or(`phone_e164.ilike.%${term}%,phone_number.ilike.%${term}%`);
      }
      q = q.range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: (data ?? []) as DncRow[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const exportCsv = async () => {
    const { data, error } = await supabase
      .from('dnc_list')
      .select('phone_e164, business, source, reason, added_at')
      .order('added_at', { ascending: false, nullsFirst: false });
    if (error) { toast.error(`Export failed: ${error.message}`); return; }
    const rows = data ?? [];
    const headers = ['phone_e164', 'business', 'source', 'reason', 'added_at'];
    const escape = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => escape((r as Record<string, unknown>)[h])).join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dnc_list_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">DNC Management</h1>
          <p className="text-muted-foreground text-sm">Do-not-call suppression list across all business units.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Add to DNC</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>DNC List</span>
            <span className="text-sm font-normal text-muted-foreground">{total} total</span>
          </CardTitle>
          <CardDescription>
            <div className="flex flex-col md:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search phone…" value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
              </div>
              <Select value={businessFilter} onValueChange={(v) => { setBusinessFilter(v); setPage(0); }}>
                <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All business units</SelectItem>
                  {businesses.map((b) => (
                    <SelectItem key={b.business_key} value={b.business_key}>{b.business_key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Phone (E.164)</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
              )}
              {!isLoading && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No entries.</TableCell></TableRow>
              )}
              {rows.map((r) => {
                const isOpen = expanded === r.id;
                return (
                  <>
                    <TableRow key={r.id}>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => setExpanded(isOpen ? null : r.id)}>
                          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.phone_e164 || r.phone_number}</TableCell>
                      <TableCell>{r.business ? <Badge variant="outline">{r.business}</Badge> : '—'}</TableCell>
                      <TableCell className="text-sm">{r.source ?? '—'}</TableCell>
                      <TableCell className="text-sm max-w-[280px] truncate" title={r.reason ?? ''}>{r.reason ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.added_at ? formatDistanceToNow(new Date(r.added_at), { addSuffix: true }) : '—'}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => setRemoveRow(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow key={`${r.id}-meta`}>
                        <TableCell colSpan={7} className="bg-muted/30">
                          <div className="text-xs">
                            <div className="font-medium mb-1">Metadata</div>
                            <pre className="whitespace-pre-wrap break-all text-muted-foreground">
                              {r.metadata ? JSON.stringify(r.metadata, null, 2) : '(none)'}
                            </pre>
                            <div className="mt-2 text-muted-foreground">
                              phone_number (raw): <span className="font-mono">{r.phone_number}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between mt-4 text-sm">
            <div className="text-muted-foreground">Page {page + 1} of {pageCount}</div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddDncDialog open={addOpen} onOpenChange={setAddOpen} businesses={businesses} />
      <RemoveDncDialog row={removeRow} open={!!removeRow} onOpenChange={(o) => { if (!o) setRemoveRow(null); }} />
    </div>
  );
}
