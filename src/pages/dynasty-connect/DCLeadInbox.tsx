import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, ChevronLeft, ChevronRight, Phone, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

type UnifiedLead = {
  lead_id: string;
  business_unit_key: string;
  source_table: string;
  lead_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  last_disposition: string | null;
  last_contacted_at: string | null;
  call_attempts: number | null;
  lifecycle_stage: string | null;
  notes: string | null;
  compliance_hold: boolean;
  phone_invalid: boolean;
  created_at: string;
  updated_at: string;
};

const BU_LABEL: Record<string, string> = {
  top_tier: 'TopTier',
  unforgettable_times: 'Unforgettable Times',
  surplus_funds: 'Surplus Funds',
  real_estate: 'Real Estate',
  dynasty_direct: 'Dynasty Direct',
  gasmask: 'GasMask',
  brandaro: 'Brandaro',
};

const BU_BADGE: Record<string, string> = {
  top_tier: 'bg-purple-500/15 text-purple-400 border-purple-500/40',
  unforgettable_times: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
  surplus_funds: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  real_estate: 'bg-green-500/15 text-green-400 border-green-500/40',
  dynasty_direct: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/40',
  gasmask: 'bg-red-500/15 text-red-400 border-red-500/40',
  brandaro: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40',
};

const DISPO_BADGE: Record<string, string> = {
  new: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  called: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  interested: 'bg-green-500/15 text-green-400 border-green-500/40',
  callback: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  voicemail: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40',
  not_interested: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/40',
  dnc: 'bg-red-500/15 text-red-400 border-red-500/40',
  wrong_number: 'bg-orange-500/15 text-orange-400 border-orange-500/40',
};

const DISPO_OPTIONS = [
  'all', 'new', 'called', 'interested', 'callback', 'voicemail',
  'not_interested', 'dnc', 'wrong_number',
];

const PAGE_SIZE = 50;

export default function DCLeadInbox() {
  const { user, session, loading: authLoading } = useAuth();
  const [bu, setBu] = useState('all');
  const [dispo, setDispo] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<UnifiedLead | null>(null);

  // 🔍 TEMP DEBUG: log auth state + backend-visible role/uid/jwt
  useEffect(() => {
    console.log('[DCLeadInbox] render', {
      authLoading,
      hasUser: !!user,
      hasSession: !!session,
      userId: user?.id,
      queryWillRun: !authLoading && !!user && !!session,
      timestamp: new Date().toISOString(),
    });
  }, [authLoading, user, session]);

  useEffect(() => {
    (async () => {
      console.log('[DCLeadInbox] === AUTH DEBUG START ===', new Date().toISOString());
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('[DCLeadInbox] SESSION:', sessionData.session);
        console.log('[DCLeadInbox] SESSION access_token present:', !!sessionData.session?.access_token);
        console.log('[DCLeadInbox] SESSION expires_at:', sessionData.session?.expires_at);
      } catch (e) {
        console.log('[DCLeadInbox] SESSION ERROR:', e);
      }
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        console.log('[DCLeadInbox] USER:', userData.user);
        console.log('[DCLeadInbox] USER ERROR:', userErr);
      } catch (e) {
        console.log('[DCLeadInbox] getUser threw:', e);
      }
      try {
        const { data, error } = await supabase.rpc('debug_auth' as any);
        console.log('[DCLeadInbox] DEBUG AUTH:', data);
        console.log('[DCLeadInbox] DEBUG AUTH ERROR:', error);
      } catch (e) {
        console.log('[DCLeadInbox] debug_auth threw:', e);
      }
      console.log('[DCLeadInbox] === AUTH DEBUG END ===');
    })();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dc-unified-leads', user?.id, bu, dispo, search, dateFrom, dateTo, page],
    enabled: !authLoading && !!user && !!session,
    queryFn: async () => {
      // View sort: last_contacted_at DESC nulls last.
      // supabase-js: .order('col', { ascending: false, nullsFirst: false })
      let q = (supabase as any)
        .from('dc_unified_leads')
        .select('*', { count: 'exact' })
        .order('last_contacted_at', { ascending: false, nullsFirst: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      console.log('[DCLeadInbox] executing dc_unified_leads query at', new Date().toISOString(), {
        hasUser: !!user, hasSession: !!session,
      });

      if (bu !== 'all') q = q.eq('business_unit_key', bu);
      if (dispo !== 'all') q = q.eq('last_disposition', dispo);
      if (dateFrom) q = q.gte('last_contacted_at', dateFrom);
      if (dateTo) q = q.lte('last_contacted_at', dateTo);
      if (search.trim()) {
        const s = search.trim().replace(/[,()]/g, '');
        q = q.or(`lead_name.ilike.%${s}%,phone.ilike.%${s}%`);
      }

      const { data, count, error } = await q;
      if (error) throw error;
      return { rows: (data || []) as UnifiedLead[], count: count || 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">📥 Lead Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Unified view across all Dynasty Connect business units — {total.toLocaleString()} leads
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or phone…"
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              />
            </div>
            <Select value={bu} onValueChange={(v) => { setBu(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Business unit" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All units</SelectItem>
                {Object.entries(BU_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dispo} onValueChange={(v) => { setDispo(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Disposition" /></SelectTrigger>
              <SelectContent>
                {DISPO_OPTIONS.map((d) => (
                  <SelectItem key={d} value={d}>{d === 'all' ? 'All dispositions' : d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
              placeholder="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
              placeholder="To"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 w-4"></th>
                  <th className="p-3">Lead</th>
                  <th className="p-3">Unit</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Disposition</th>
                  <th className="p-3">Last contact</th>
                  <th className="p-3 text-center">Attempts</th>
                  <th className="p-3">Stage</th>
                </tr>
              </thead>
              <tbody>
                {(authLoading || isLoading) && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Loading leads…</td></tr>
                )}
                {!authLoading && (!user || !session) && !isLoading && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Sign in to view leads.</td></tr>
                )}
                {error && !authLoading && !isLoading && (
                  <tr><td colSpan={9} className="p-8 text-center text-red-500">Error: {(error as Error).message}</td></tr>
                )}
                {!authLoading && !isLoading && !error && user && session && rows.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No leads match these filters</td></tr>
                )}
                {rows.map((r) => (
                  <tr
                    key={`${r.source_table}-${r.lead_id}`}
                    className="border-b border-border/50 hover:bg-accent/50 cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <td className="p-3">
                      {r.compliance_hold && (
                        <span
                          title="Compliance hold"
                          className="inline-block h-2 w-2 rounded-full bg-red-500"
                        />
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{r.lead_name || <span className="text-muted-foreground">—</span>}</div>
                      {r.contact_name && r.contact_name !== r.lead_name && (
                        <div className="text-xs text-muted-foreground">{r.contact_name}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className={BU_BADGE[r.business_unit_key] || ''}>
                        {BU_LABEL[r.business_unit_key] || r.business_unit_key}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-xs">
                      {r.phone || <span className="text-muted-foreground">—</span>}
                      {r.phone_invalid && <span className="ml-1 text-red-500" title="Invalid phone">⚠</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {[r.city, r.state].filter(Boolean).join(', ') || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      {r.last_disposition ? (
                        <Badge variant="outline" className={DISPO_BADGE[r.last_disposition] || 'bg-muted text-muted-foreground'}>
                          {r.last_disposition}
                        </Badge>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {r.last_contacted_at
                        ? formatDistanceToNow(new Date(r.last_contacted_at), { addSuffix: true })
                        : <span className="text-muted-foreground">never</span>}
                    </td>
                    <td className="p-3 text-center">{r.call_attempts ?? 0}</td>
                    <td className="p-3 text-xs">{r.lifecycle_stage || <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between p-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              {total === 0 ? '0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)}`} of {total.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              ><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs">Page {page + 1} / {totalPages}</span>
              <Button
                variant="outline" size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              ><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LeadDetailPanel lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function LeadDetailPanel({ lead, onClose }: { lead: UnifiedLead | null; onClose: () => void }) {
  const enabled = !!lead;

  const { data: calls = [] } = useQuery({
    enabled,
    queryKey: ['dc-lead-calls', lead?.source_table, lead?.lead_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dc_call_logs')
        .select('*')
        .eq('source_table', lead!.source_table)
        .eq('source_id', lead!.lead_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: syncLog = [] } = useQuery({
    enabled,
    queryKey: ['dc-lead-sync-log', lead?.lead_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dc_lead_sync_log')
        .select('*')
        .eq('lead_id', lead!.lead_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const recordings = useMemo(
    () => (calls as any[]).filter((c) => c.recording_url),
    [calls]
  );

  return (
    <Sheet open={enabled} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {lead.lead_name || '—'}
                <Badge variant="outline" className={BU_BADGE[lead.business_unit_key]}>
                  {BU_LABEL[lead.business_unit_key] || lead.business_unit_key}
                </Badge>
                {lead.compliance_hold && (
                  <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/40">
                    Compliance hold
                  </Badge>
                )}
              </SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              {/* Lead fields */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Lead details</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <Row label="Contact" value={lead.contact_name} />
                  <Row label="Phone" value={lead.phone} mono />
                  <Row label="Email" value={lead.email} />
                  <Row label="Location" value={[lead.city, lead.state].filter(Boolean).join(', ') || null} />
                  <Row label="Disposition" value={lead.last_disposition} />
                  <Row label="Stage" value={lead.lifecycle_stage} />
                  <Row label="Attempts" value={String(lead.call_attempts ?? 0)} />
                  <Row label="Last contacted" value={lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleString() : null} />
                  <Row label="Source table" value={lead.source_table} mono />
                  <Row label="Lead ID" value={lead.lead_id} mono />
                  {lead.notes && (
                    <div className="pt-2">
                      <div className="text-xs text-muted-foreground mb-1">Notes</div>
                      <div className="text-xs whitespace-pre-wrap bg-muted/50 p-2 rounded">{lead.notes}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recordings shortcut */}
              {recordings.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Phone className="h-4 w-4" /> Recordings ({recordings.length})</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {recordings.map((c: any) => (
                      <a
                        key={c.id}
                        href={c.recording_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between text-xs p-2 rounded bg-muted/40 hover:bg-muted"
                      >
                        <span>{new Date(c.created_at).toLocaleString()} — {c.duration_seconds ?? '?'}s</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Call history */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Call history ({calls.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {calls.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground">No calls logged for this lead</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-2">When</th>
                          <th className="p-2">Direction</th>
                          <th className="p-2">Outcome</th>
                          <th className="p-2">Dur</th>
                          <th className="p-2">Agent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(calls as any[]).map((c) => (
                          <tr key={c.id} className="border-b border-border/50">
                            <td className="p-2">{new Date(c.created_at).toLocaleString()}</td>
                            <td className="p-2">{c.direction || '—'}</td>
                            <td className="p-2">{c.outcome || c.status || '—'}</td>
                            <td className="p-2">{c.duration_seconds ?? '—'}</td>
                            <td className="p-2">{c.agent_name || c.agent_id || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>

              {/* Sync log */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Sync log ({syncLog.length})</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {syncLog.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground">No sync log entries</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-2">When</th>
                          <th className="p-2">Source</th>
                          <th className="p-2">Before → After</th>
                          <th className="p-2">OK</th>
                          <th className="p-2">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(syncLog as any[]).map((s) => (
                          <tr key={s.id} className="border-b border-border/50">
                            <td className="p-2">{new Date(s.created_at).toLocaleString()}</td>
                            <td className="p-2 font-mono text-[10px]">{s.sync_source}</td>
                            <td className="p-2">
                              <span className="text-muted-foreground">{s.status_before || '∅'}</span>
                              {' → '}
                              <span>{s.status_after || '∅'}</span>
                            </td>
                            <td className="p-2">
                              {s.success ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-red-500">✗</span>
                              )}
                            </td>
                            <td className="p-2 max-w-[260px] truncate" title={s.error_message || ''}>
                              {s.error_message || <span className="text-muted-foreground">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-right ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-muted-foreground">—</span>}
      </span>
    </div>
  );
}
