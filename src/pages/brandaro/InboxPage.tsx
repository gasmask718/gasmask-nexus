import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Inbox as InboxIcon, MessageSquare, Search, Check, X, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { dynastyDateTime } from '@/lib/dates';

// Pending message statuses that exist in the check constraint
type PendingStatus = 'pending' | 'approved' | 'sent' | 'rejected' | 'edited';
type PendingFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface PendingRow {
  id: string;
  lead_id: string | null;
  lead_name: string | null;
  phone_number: string | null;
  message_body: string;
  message_type: string;
  status: PendingStatus;
  created_at: string;
}

interface InboundRow {
  id: string;
  lead_id: string | null;
  sender_phone: string | null;
  message: string;
  channel: string;
  created_at: string;
  intent_detected: string | null;
  ai_auto_responded: boolean | null;
  resolved: boolean | null;
}

interface LeadLookup {
  id: string;
  business_name: string | null;
  phone_number: string | null;
  pipeline_stage: string | null;
  city: string | null;
  state: string | null;
}

const normalizePhone = (p: string | null | undefined) => (p || '').replace(/\D/g, '');

export default function InboxPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'inbound'>('pending');
  const [pendingFilter, setPendingFilter] = useState<PendingFilter>('pending');
  const [search, setSearch] = useState('');
  const [expandedInbound, setExpandedInbound] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  // ── Pending count (auto-refresh every 30s) ─────────────────────────
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['brandaro-pending-count'],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('brandaro_pending_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count || 0;
    },
    refetchInterval: 30_000,
  });

  // ── Pending messages ───────────────────────────────────────────────
  const { data: pending = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['brandaro-pending-messages'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_pending_messages')
        .select('id, lead_id, lead_name, phone_number, message_body, message_type, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as PendingRow[];
    },
  });

  // ── Inbound messages ───────────────────────────────────────────────
  const { data: inbound = [], isLoading: inboundLoading } = useQuery({
    queryKey: ['brandaro-inbound-messages'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('brandaro_inbound_messages')
        .select('id, lead_id, sender_phone, message, channel, created_at, intent_detected, ai_auto_responded, resolved')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as InboundRow[];
    },
  });

  // ── Lead lookups for both tabs ─────────────────────────────────────
  const leadIds = useMemo(() => {
    const ids = new Set<string>();
    pending.forEach(p => p.lead_id && ids.add(p.lead_id));
    inbound.forEach(i => i.lead_id && ids.add(i.lead_id));
    return Array.from(ids);
  }, [pending, inbound]);

  const phoneKeys = useMemo(() => {
    const s = new Set<string>();
    pending.forEach(p => { const n = normalizePhone(p.phone_number); if (n) s.add(n); });
    inbound.forEach(i => { const n = normalizePhone(i.sender_phone); if (n) s.add(n); });
    return Array.from(s);
  }, [pending, inbound]);

  const { data: leads = [] } = useQuery({
    queryKey: ['brandaro-inbox-leads', leadIds.length, phoneKeys.length],
    enabled: leadIds.length > 0 || phoneKeys.length > 0,
    queryFn: async () => {
      const all: LeadLookup[] = [];
      if (leadIds.length) {
        const { data } = await (supabase as any)
          .from('brandaro_qualified_leads')
          .select('id, business_name, phone_number, pipeline_stage, city, state')
          .in('id', leadIds);
        if (data) all.push(...(data as LeadLookup[]));
      }
      if (phoneKeys.length) {
        // Some phone_number rows may be formatted; fetch and match client-side by normalized digits
        const { data } = await (supabase as any)
          .from('brandaro_qualified_leads')
          .select('id, business_name, phone_number, pipeline_stage, city, state')
          .not('phone_number', 'is', null)
          .limit(5000);
        if (data) {
          const seen = new Set(all.map(l => l.id));
          for (const l of data as LeadLookup[]) {
            const n = normalizePhone(l.phone_number);
            if (n && phoneKeys.includes(n) && !seen.has(l.id)) {
              all.push(l);
              seen.add(l.id);
            }
          }
        }
      }
      return all;
    },
  });

  const leadByPhone = useMemo(() => {
    const m = new Map<string, LeadLookup>();
    leads.forEach(l => { const n = normalizePhone(l.phone_number); if (n && !m.has(n)) m.set(n, l); });
    return m;
  }, [leads]);
  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads]);

  const lookupLead = (row: { lead_id: string | null; phone_number?: string | null; sender_phone?: string | null }): LeadLookup | undefined => {
    if (row.lead_id && leadById.has(row.lead_id)) return leadById.get(row.lead_id);
    const phone = normalizePhone(row.phone_number ?? row.sender_phone ?? '');
    return phone ? leadByPhone.get(phone) : undefined;
  };

  // ── Filtering ──────────────────────────────────────────────────────
  const filteredPending = useMemo(() => {
    const s = search.trim().toLowerCase();
    return pending.filter(p => {
      if (pendingFilter !== 'all' && p.status !== pendingFilter) return false;
      if (!s) return true;
      return (
        (p.phone_number || '').toLowerCase().includes(s) ||
        (p.message_body || '').toLowerCase().includes(s) ||
        (p.lead_name || '').toLowerCase().includes(s)
      );
    });
  }, [pending, pendingFilter, search]);

  // ── Actions ────────────────────────────────────────────────────────
  const setStatus = async (id: string, next: 'approved' | 'rejected') => {
    setActioning(id);
    const patch: Record<string, any> = { status: next };
    if (next === 'approved') patch.approved_at = new Date().toISOString();
    const { error } = await (supabase as any)
      .from('brandaro_pending_messages')
      .update(patch)
      .eq('id', id);
    setActioning(null);
    if (error) {
      toast.error(`Failed: ${error.message}`);
      return;
    }
    toast.success(next === 'approved' ? 'Message approved' : 'Message skipped');
    qc.invalidateQueries({ queryKey: ['brandaro-pending-messages'] });
    qc.invalidateQueries({ queryKey: ['brandaro-pending-count'] });
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    sent: 'bg-green-500/10 text-green-500 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    edited: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <InboxIcon className="h-6 w-6" />
            Inbox
          </h1>
          <p className="text-sm text-muted-foreground">Approve outbound messages and review inbound replies.</p>
        </div>
        <Badge variant="outline" className={`text-sm ${statusColor.pending}`}>
          {pendingCount.toLocaleString()} pending
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">
            Pending Queue
            <Badge variant="secondary" className="ml-2">{(statusCounts.all ?? 0).toLocaleString()}</Badge>
          </TabsTrigger>
          <TabsTrigger value="inbound">
            Inbound
            <Badge variant="secondary" className="ml-2">{inbound.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ── PENDING QUEUE ─────────────────────────────────────────── */}
        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="text-base">Outbound Message Queue</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'pending', 'approved', 'rejected', 'failed', 'sent'] as PendingFilter[]).map(f => (
                  <Button
                    key={f}
                    size="sm"
                    variant={pendingFilter === f ? 'default' : 'outline'}
                    onClick={() => { setPendingFilter(f); setPage(0); }}
                    className="capitalize"
                  >
                    {f === 'rejected' ? 'Skipped' : f}
                    <Badge variant="secondary" className="ml-2">{(statusCounts[f] ?? 0).toLocaleString()}</Badge>
                  </Button>
                ))}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search phone or message..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 w-64"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {pendingLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p>No messages match this filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Business</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPending.map(row => {
                        const lead = lookupLead(row);
                        const preview = (row.message_body || '').slice(0, 100);
                        const isPending = row.status === 'pending';
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {lead?.business_name || row.lead_name || <span className="text-muted-foreground">Unknown</span>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">{row.phone_number || '—'}</TableCell>
                            <TableCell className="max-w-[380px] text-sm text-muted-foreground">
                              {preview}{(row.message_body || '').length > 100 ? '…' : ''}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={statusColor[row.status]}>{row.status}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {dynastyDateTime(row.created_at)}
                            </TableCell>
                            <TableCell className="text-right">
                              {isPending ? (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    disabled={actioning === row.id}
                                    onClick={() => setStatus(row.id, 'approved')}
                                  >
                                    {actioning === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Check className="h-3 w-3 mr-1" />Approve</>}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={actioning === row.id}
                                    onClick={() => setStatus(row.id, 'rejected')}
                                  >
                                    <X className="h-3 w-3 mr-1" />Skip
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {filterTotal === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filterTotal)} of {filterTotal.toLocaleString()}
                      {search.trim() && ' (search applies to this page)'}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
                      <Button size="sm" variant="outline" disabled={(page + 1) * PAGE_SIZE >= filterTotal} onClick={() => setPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INBOUND ───────────────────────────────────────────────── */}
        <TabsContent value="inbound" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inbound Replies</CardTitle>
            </CardHeader>
            <CardContent>
              {inboundLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : inbound.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-40" />
                  <p>No inbound messages yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>From Phone</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Received</TableHead>
                        <TableHead>Lead Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inbound.map(row => {
                        const lead = lookupLead(row);
                        const isOpen = expandedInbound === row.id;
                        return (
                          <>
                            <TableRow
                              key={row.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setExpandedInbound(isOpen ? null : row.id)}
                            >
                              <TableCell>
                                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">{row.sender_phone || '—'}</TableCell>
                              <TableCell className="max-w-[420px] text-sm text-muted-foreground truncate">
                                {(row.message || '').slice(0, 100)}{(row.message || '').length > 100 ? '…' : ''}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {dynastyDateTime(row.created_at)}
                              </TableCell>
                              <TableCell>
                                {lead ? (
                                  <span className="font-medium">{lead.business_name}</span>
                                ) : (
                                  <span className="text-muted-foreground">Unknown</span>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow key={`${row.id}-detail`} className="bg-muted/30">
                                <TableCell />
                                <TableCell colSpan={4} className="py-4">
                                  <div className="space-y-3">
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Full message</p>
                                      <p className="text-sm whitespace-pre-wrap">{row.message}</p>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                      <div><span className="text-muted-foreground">Channel:</span> <span className="font-medium">{row.channel}</span></div>
                                      {row.intent_detected && (
                                        <div><span className="text-muted-foreground">Intent:</span> <span className="font-medium">{row.intent_detected}</span></div>
                                      )}
                                      <div><span className="text-muted-foreground">AI replied:</span> <span className="font-medium">{row.ai_auto_responded ? 'Yes' : 'No'}</span></div>
                                      <div><span className="text-muted-foreground">Resolved:</span> <span className="font-medium">{row.resolved ? 'Yes' : 'No'}</span></div>
                                    </div>
                                    {lead && (
                                      <div className="p-3 rounded-md border bg-background">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Matched Lead</p>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                          <div><span className="text-muted-foreground">Business:</span> <span className="font-medium">{lead.business_name}</span></div>
                                          <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{lead.phone_number}</span></div>
                                          <div><span className="text-muted-foreground">Stage:</span> <span className="font-medium">{lead.pipeline_stage}</span></div>
                                          <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{[lead.city, lead.state].filter(Boolean).join(', ') || '—'}</span></div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
