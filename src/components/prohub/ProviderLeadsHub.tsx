import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { verifiedInsert, verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle, Loader2, Search, Inbox, MessageSquarePlus, CalendarPlus, CheckCircle2,
} from 'lucide-react';
import {
  PROVIDER_STATUSES, STATUS_BADGE, INTERACTION_TYPES,
  type ProviderHubConfig, type ProviderLead,
} from './providerHubConfig';

interface Props {
  config: ProviderHubConfig;
}

export default function ProviderLeadsHub({ config }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [geoFilter, setGeoFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'lead_score' | 'created_at'>('lead_score');
  const [openLead, setOpenLead] = useState<ProviderLead | null>(null);

  // ── LIVE READ of giy_leads / svc_leads ───────────────────────────────────
  const leadsQuery = useQuery({
    queryKey: [config.key, 'leads', statusFilter, sortBy],
    queryFn: async (): Promise<ProviderLead[]> => {
      let q = supabase
        .from(config.leadsTable)
        .select('*')
        .order(sortBy, { ascending: false, nullsFirst: false })
        .limit(500);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as ProviderLead[];
    },
    refetchInterval: 30000,
  });

  const leads = leadsQuery.data ?? [];

  const tagsOf = (l: ProviderLead): string[] =>
    ((l as Record<string, unknown>)[config.tagsColumn] as string[] | null) ?? [];
  const geoOf = (l: ProviderLead): string =>
    ((l as Record<string, unknown>)[config.geoColumn] as string | null) ?? '';

  const tagOptions = useMemo(
    () => Array.from(new Set(leads.flatMap(tagsOf).filter(Boolean))).sort(),
    [leads],
  );
  const geoOptions = useMemo(
    () => Array.from(new Set(leads.map(geoOf).filter(Boolean))).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (tagFilter !== 'all' && !tagsOf(l).includes(tagFilter)) return false;
      if (geoFilter !== 'all' && geoOf(l) !== geoFilter) return false;
      if (!s) return true;
      return (
        (l.full_name || '').toLowerCase().includes(s) ||
        (l.email || '').toLowerCase().includes(s) ||
        (l.phone || '').includes(s)
      );
    });
  }, [leads, search, tagFilter, geoFilter]);

  // ── Stats bar, computed live ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const total = leads.length;
    const newThisWeek = leads.filter((l) => new Date(l.created_at).getTime() >= weekAgo).length;
    const converted = leads.filter((l) => l.status === 'converted').length;
    const inProgress = leads.filter(
      (l) => !['new', 'converted', 'lost'].includes(l.status),
    ).length;
    return {
      total,
      newThisWeek,
      inProgress,
      converted,
      rate: total ? Math.round((converted / total) * 100) : 0,
    };
  }, [leads]);

  return (
    <div className="p-4 md:p-6 space-y-5">
      <header className={`rounded-xl p-5 ${config.accentHeader}`}>
        <h1 className={`text-2xl font-bold ${config.accentText}`}>{config.brand} Hub</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Provider signup pipeline — vetted professionals applying to join.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total leads', value: stats.total },
          { label: 'New this week', value: stats.newThisWeek },
          { label: 'In progress', value: stats.inProgress },
          { label: 'Converted', value: stats.converted },
          { label: 'Conversion rate', value: `${stats.rate}%` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={`text-2xl font-bold ${config.accentText}`}>
                {leadsQuery.isLoading ? '—' : s.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Leads Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search name, phone or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PROVIDER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {config.tagsLabel.toLowerCase()}s</SelectItem>
                {tagOptions.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={geoFilter} onValueChange={setGeoFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All {config.geoLabel.toLowerCase()}s</SelectItem>
                {geoOptions.map((g) => (<SelectItem key={g} value={g}>{g}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lead_score">Top score</SelectItem>
                <SelectItem value="created_at">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* States: error / loading / empty / data */}
          {leadsQuery.isError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-3">
                <span>Couldn't load leads: {(leadsQuery.error as Error).message}</span>
                <Button size="sm" variant="outline" onClick={() => leadsQuery.refetch()}>Retry</Button>
              </AlertDescription>
            </Alert>
          ) : leadsQuery.isLoading ? (
            <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Loading leads…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-muted-foreground">
              <Inbox className="h-8 w-8" />
              <span className="text-sm">
                {leads.length === 0
                  ? 'No applications yet — this pipeline is ready for ingestion.'
                  : 'No leads match these filters.'}
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>{config.geoLabel}</TableHead>
                    <TableHead>{config.tagsLabel}</TableHead>
                    <TableHead>Exp.</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow
                      key={l.id}
                      className="cursor-pointer"
                      onClick={() => setOpenLead(l)}
                    >
                      <TableCell className="font-medium">
                        {l.full_name || [l.first_name, l.last_name].filter(Boolean).join(' ') || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{l.phone || '—'}</div>
                        <div>{l.email || ''}</div>
                      </TableCell>
                      <TableCell>{[geoOf(l), l.state].filter(Boolean).join(', ') || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {tagsOf(l).slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{l.years_experience ?? '—'}</TableCell>
                      <TableCell>{l.lead_score ?? 0}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[l.status] || ''}>
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <LeadDetailSheet
        config={config}
        lead={openLead}
        onClose={() => setOpenLead(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: [config.key, 'leads'] });
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEAD DETAIL
// ═══════════════════════════════════════════════════════════════════════════
function LeadDetailSheet({
  config, lead, onClose, onSaved,
}: {
  config: ProviderHubConfig;
  lead: ProviderLead | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [noteText, setNoteText] = useState('');
  const [logType, setLogType] = useState<string>('note');
  const [followupDate, setFollowupDate] = useState('');
  const [followupChannel, setFollowupChannel] = useState('call');
  const [profileUrl, setProfileUrl] = useState('');

  const leadId = lead?.id ?? null;
  const field = (col: string) =>
    (draft[col] !== undefined
      ? draft[col]
      : ((lead as unknown as Record<string, unknown>)?.[col] ?? '')) as string;

  const interactions = useQuery({
    queryKey: [config.key, 'interactions', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(config.interactionsTable)
        .select('*')
        .eq('lead_id', leadId!)
        .order('occurred_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const followups = useQuery({
    queryKey: [config.key, 'followups', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(config.followupsTable)
        .select('*')
        .eq('lead_id', leadId!)
        .order('due_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: [config.key, 'interactions', leadId] });
    qc.invalidateQueries({ queryKey: [config.key, 'followups', leadId] });
    onSaved();
  };

  const saveFields = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      await verifiedUpdate(`update ${config.brand} lead`, () =>
        supabase.from(config.leadsTable).update(patch).eq('id', leadId!),
      );
    },
    onSuccess: () => { toast.success('Saved'); setDraft({}); refreshAll(); },
    onError: (e) => toast.error(mutationErrorMessage(e)),
  });

  const logInteraction = useMutation({
    mutationFn: async (payload: { interaction_type: string; content: string }) => {
      await verifiedInsert(`log ${config.brand} interaction`, () =>
        supabase.from(config.interactionsTable).insert({
          lead_id: leadId!,
          interaction_type: payload.interaction_type,
          actor: 'staff',
          content: payload.content,
        }),
      );
    },
    onSuccess: () => { toast.success('Logged'); setNoteText(''); refreshAll(); },
    onError: (e) => toast.error(mutationErrorMessage(e)),
  });

  const scheduleFollowup = useMutation({
    mutationFn: async () => {
      await verifiedInsert(`schedule ${config.brand} follow-up`, () =>
        supabase.from(config.followupsTable).insert({
          lead_id: leadId!,
          due_at: new Date(followupDate).toISOString(),
          channel: followupChannel,
          status: 'pending',
        }),
      );
    },
    onSuccess: () => { toast.success('Follow-up scheduled'); setFollowupDate(''); refreshAll(); },
    onError: (e) => toast.error(mutationErrorMessage(e)),
  });

  const changeStatus = useMutation({
    mutationFn: async (status: string) => {
      await verifiedUpdate(`change ${config.brand} lead status`, () =>
        supabase.from(config.leadsTable).update({ status }).eq('id', leadId!),
      );
      await verifiedInsert('log status change', () =>
        supabase.from(config.interactionsTable).insert({
          lead_id: leadId!,
          interaction_type: 'status_change',
          actor: 'staff',
          content: `Status set to ${status}`,
        }),
      );
    },
    onSuccess: () => { toast.success('Status updated'); refreshAll(); },
    onError: (e) => toast.error(mutationErrorMessage(e)),
  });

  const markConverted = useMutation({
    mutationFn: async () => {
      const url = profileUrl.trim();
      if (!url) throw new Error(`${config.profileUrlLabel} is required before converting.`);
      await verifiedUpdate(`mark ${config.brand} lead converted`, () =>
        supabase
          .from(config.leadsTable)
          .update({ status: 'converted', [config.profileUrlColumn]: url })
          .eq('id', leadId!),
      );
      await verifiedInsert('log conversion', () =>
        supabase.from(config.interactionsTable).insert({
          lead_id: leadId!,
          interaction_type: 'status_change',
          actor: 'staff',
          content: `Converted — profile: ${url}`,
        }),
      );
    },
    onSuccess: () => { toast.success('Marked converted'); setProfileUrl(''); refreshAll(); },
    onError: (e) => toast.error(mutationErrorMessage(e)),
  });

  const editable: { col: string; label: string }[] = [
    { col: 'full_name', label: 'Full name' },
    { col: 'phone', label: 'Phone' },
    { col: 'email', label: 'Email' },
    { col: config.geoColumn, label: config.geoLabel },
    { col: 'state', label: 'State' },
    { col: 'years_experience', label: 'Years experience' },
    { col: 'lead_score', label: 'Lead score' },
    { col: 'lead_source', label: 'Lead source' },
    ...(config.extraField ? [{ col: config.extraField.column, label: config.extraField.label }] : []),
    ...(config.key === 'giy' ? [{ col: 'portfolio_url', label: 'Portfolio / socials' }] : []),
    { col: config.profileUrlColumn, label: config.profileUrlLabel },
  ];

  return (
    <Sheet open={!!lead} onOpenChange={(o) => { if (!o) { setDraft({}); onClose(); } }}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle className={config.accentText}>
                {lead.full_name || 'Unnamed applicant'}
              </SheetTitle>
            </SheetHeader>

            <div className="space-y-6 mt-5">
              {/* Status */}
              <div className="flex items-center gap-2">
                <Select value={lead.status} onValueChange={(v) => changeStatus.mutate(v)}>
                  <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDER_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
                {changeStatus.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-3">
                {editable.map((f) => (
                  <div key={f.col} className={f.col.includes('url') ? 'col-span-2' : ''}>
                    <Label className="text-xs">{f.label}</Label>
                    <Input
                      value={String(field(f.col) ?? '')}
                      onChange={(e) => setDraft((d) => ({ ...d, [f.col]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={String(field('notes') ?? '')}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  />
                </div>
              </div>
              <Button
                disabled={Object.keys(draft).length === 0 || saveFields.isPending}
                onClick={() => {
                  const patch = { ...draft };
                  ['years_experience', 'lead_score'].forEach((n) => {
                    if (patch[n] !== undefined) {
                      const v = parseInt(String(patch[n]), 10);
                      patch[n] = Number.isFinite(v) ? v : null;
                    }
                  });
                  saveFields.mutate(patch);
                }}
              >
                {saveFields.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save changes
              </Button>

              {/* Mark converted */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Mark converted
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Paste the live {config.profileUrlLabel.toLowerCase()} — conversion won't save without it.
                  </p>
                  <Input
                    placeholder="https://…"
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!profileUrl.trim() || markConverted.isPending}
                    onClick={() => markConverted.mutate()}
                  >
                    {markConverted.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Mark converted
                  </Button>
                </CardContent>
              </Card>

              {/* Log interaction */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquarePlus className="h-4 w-4" /> Log interaction
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Select value={logType} onValueChange={setLogType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERACTION_TYPES.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="What happened?"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!noteText.trim() || logInteraction.isPending}
                    onClick={() => logInteraction.mutate({ interaction_type: logType, content: noteText.trim() })}
                  >
                    {logInteraction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Add to timeline
                  </Button>
                </CardContent>
              </Card>

              {/* Follow-up scheduler */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarPlus className="h-4 w-4" /> Schedule follow-up
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Input
                    type="datetime-local"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                  />
                  <Select value={followupChannel} onValueChange={setFollowupChannel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Call</SelectItem>
                      <SelectItem value="sms">Text</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!followupDate || scheduleFollowup.isPending}
                    onClick={() => scheduleFollowup.mutate()}
                  >
                    {scheduleFollowup.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Schedule
                  </Button>
                  {followups.isError ? (
                    <p className="text-xs text-destructive">Couldn't load follow-ups.</p>
                  ) : followups.isLoading ? (
                    <p className="text-xs text-muted-foreground">Loading follow-ups…</p>
                  ) : (followups.data || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No follow-ups scheduled.</p>
                  ) : (
                    <ul className="text-xs space-y-1">
                      {(followups.data || []).map((f: Record<string, unknown>) => (
                        <li key={String(f.id)} className="flex justify-between">
                          <span>{new Date(String(f.due_at)).toLocaleString()} · {String(f.channel ?? '')}</span>
                          <Badge variant="outline">{String(f.status)}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              {/* Timeline */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Interaction timeline</h3>
                {interactions.isError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Couldn't load the timeline.</AlertDescription>
                  </Alert>
                ) : interactions.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                  </div>
                ) : (interactions.data || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {(interactions.data || []).map((i: Record<string, unknown>) => (
                      <li key={String(i.id)} className="border-l-2 border-border pl-3 py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {String(i.interaction_type)}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(String(i.occurred_at)), { addSuffix: true })}
                            {i.actor ? ` · ${String(i.actor)}` : ''}
                          </span>
                        </div>
                        {i.content ? <p className="text-sm mt-1">{String(i.content)}</p> : null}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
