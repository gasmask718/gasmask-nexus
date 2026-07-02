import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Plus, Calendar, AlertTriangle, DollarSign, Target, TrendingUp } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════
// UBEN Grant Tracker — pipeline of grant applications & awards
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';

type GrantStatus = 'researching' | 'applied' | 'pending' | 'awarded' | 'denied' | 'closed';
type FunderType = 'federal' | 'state' | 'corporate' | 'foundation' | 'other';

interface Grant {
  id: string;
  grant_name: string;
  funder_name: string;
  funder_type: FunderType | null;
  amount_requested: number | null;
  amount_awarded: number | null;
  status: GrantStatus;
  deadline: string | null;
  application_date: string | null;
  award_date: string | null;
  report_due: string | null;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  dynasty_business: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_STYLES: Record<GrantStatus, string> = {
  researching: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  applied: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  awarded: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  denied: 'bg-red-500/20 text-red-300 border-red-500/40',
  closed: 'bg-slate-700/40 text-slate-400 border-slate-600',
};

const FUNDER_STYLES: Record<FunderType, string> = {
  federal: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  state: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  corporate: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  foundation: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  other: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};

const STATUS_TABS: Array<{ value: 'all' | GrantStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'researching', label: 'Researching' },
  { value: 'applied', label: 'Applied' },
  { value: 'pending', label: 'Pending' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'denied', label: 'Denied' },
];

const EMPTY_FORM = {
  grant_name: '',
  funder_name: '',
  funder_type: 'foundation' as FunderType,
  amount_requested: '',
  amount_awarded: '',
  status: 'researching' as GrantStatus,
  deadline: '',
  application_date: '',
  award_date: '',
  report_due: '',
  contact_name: '',
  contact_email: '',
  notes: '',
  dynasty_business: '',
};

const fmtMoney = (n: number | null | undefined) =>
  n == null ? '—' : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const fmtDate = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'MMM d, yyyy') : '—';

export default function UbenGrantTracker() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'all' | GrantStatus>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Grant | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: grants = [], isLoading } = useQuery({
    queryKey: ['uben-grants'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_grant_applications' as any)
        .select('*')
        .order('deadline', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as unknown as Grant[];
    },
  });

  const filtered = useMemo(
    () => (tab === 'all' ? grants : grants.filter((g) => g.status === tab)),
    [tab, grants]
  );

  const stats = useMemo(() => {
    const total = grants.length;
    const applied = grants.filter((g) => g.status !== 'researching').length;
    const awarded = grants.filter((g) => g.status === 'awarded');
    const denied = grants.filter((g) => g.status === 'denied');
    const totalAwarded = awarded.reduce((s, g) => s + Number(g.amount_awarded || 0), 0);
    const decided = awarded.length + denied.length;
    const winRate = decided > 0 ? Math.round((awarded.length / decided) * 1000) / 10 : 0;
    return { total, applied, awardedCount: awarded.length, totalAwarded, winRate };
  }, [grants]);

  const addMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      const row = {
        grant_name: payload.grant_name.trim(),
        funder_name: payload.funder_name.trim(),
        funder_type: payload.funder_type,
        amount_requested: payload.amount_requested ? Number(payload.amount_requested) : null,
        amount_awarded: payload.amount_awarded ? Number(payload.amount_awarded) : null,
        status: payload.status,
        deadline: payload.deadline || null,
        application_date: payload.application_date || null,
        award_date: payload.award_date || null,
        report_due: payload.report_due || null,
        contact_name: payload.contact_name || null,
        contact_email: payload.contact_email || null,
        notes: payload.notes || null,
        dynasty_business: payload.dynasty_business || null,
      };
      const { error } = await supabase.from('uben_grant_applications' as any).insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Grant added');
      qc.invalidateQueries({ queryKey: ['uben-grants'] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to add grant'),
  });

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<Grant> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase
        .from('uben_grant_applications' as any)
        .update(rest)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success('Grant updated');
      qc.invalidateQueries({ queryKey: ['uben-grants'] });
      setDetail((prev) => (prev && prev.id === vars.id ? { ...prev, ...vars } : prev));
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update grant'),
  });

  const deadlineCell = (d: string | null) => {
    if (!d) return <span className="text-muted-foreground">—</span>;
    const days = differenceInDays(parseISO(d), new Date());
    const overdue = days < 0;
    const urgent = days >= 0 && days < 30;
    return (
      <span
        className={
          overdue
            ? 'text-red-400 font-semibold flex items-center gap-1'
            : urgent
            ? 'text-red-400 font-semibold'
            : ''
        }
      >
        {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
        {fmtDate(d)}
        {overdue && <span className="text-xs ml-1">({Math.abs(days)}d late)</span>}
        {urgent && !overdue && <span className="text-xs ml-1">({days}d)</span>}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${GOLD}22` }}>
            <Trophy className="h-6 w-6" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: GOLD }}>Grant Tracker</h1>
            <p className="text-sm text-muted-foreground">UBEN grant pipeline · deadlines · awards</p>
          </div>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Grant
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Applied" value={stats.applied.toString()} sub={`${stats.total} total`} />
        <StatCard icon={Trophy} label="Awarded" value={stats.awardedCount.toString()} sub="grants won" />
        <StatCard icon={DollarSign} label="Total $ Awarded" value={fmtMoney(stats.totalAwarded)} sub="lifetime" />
        <StatCard icon={TrendingUp} label="Win Rate" value={`${stats.winRate}%`} sub="of decided grants" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-card border border-border">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Grants ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No grants in this view yet.</p>
              <Button variant="link" onClick={() => setAddOpen(true)}>Add your first grant</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grant</TableHead>
                    <TableHead>Funder</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    <TableHead className="text-right">Awarded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Report Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => (
                    <TableRow
                      key={g.id}
                      className="cursor-pointer hover:bg-accent/40"
                      onClick={() => setDetail(g)}
                    >
                      <TableCell className="font-medium">{g.grant_name}</TableCell>
                      <TableCell>{g.funder_name}</TableCell>
                      <TableCell>
                        {g.funder_type ? (
                          <Badge variant="outline" className={FUNDER_STYLES[g.funder_type]}>{g.funder_type}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(g.amount_requested)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold" style={{ color: g.amount_awarded ? GOLD : undefined }}>
                        {fmtMoney(g.amount_awarded)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_STYLES[g.status]}>{g.status}</Badge>
                      </TableCell>
                      <TableCell>{deadlineCell(g.deadline)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(g.report_due)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Grant Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Grant Application</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Grant name *" className="col-span-2">
              <Input value={form.grant_name} onChange={(e) => setForm({ ...form, grant_name: e.target.value })} />
            </Field>
            <Field label="Funder name *">
              <Input value={form.funder_name} onChange={(e) => setForm({ ...form, funder_name: e.target.value })} />
            </Field>
            <Field label="Funder type">
              <Select value={form.funder_type} onValueChange={(v) => setForm({ ...form, funder_type: v as FunderType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['federal','state','corporate','foundation','other'] as FunderType[]).map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount requested">
              <Input type="number" value={form.amount_requested} onChange={(e) => setForm({ ...form, amount_requested: e.target.value })} />
            </Field>
            <Field label="Amount awarded">
              <Input type="number" value={form.amount_awarded} onChange={(e) => setForm({ ...form, amount_awarded: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as GrantStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['researching','applied','pending','awarded','denied','closed'] as GrantStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Dynasty business (optional)">
              <Input value={form.dynasty_business} onChange={(e) => setForm({ ...form, dynasty_business: e.target.value })} />
            </Field>
            <Field label="Deadline">
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
            <Field label="Application date">
              <Input type="date" value={form.application_date} onChange={(e) => setForm({ ...form, application_date: e.target.value })} />
            </Field>
            <Field label="Award date">
              <Input type="date" value={form.award_date} onChange={(e) => setForm({ ...form, award_date: e.target.value })} />
            </Field>
            <Field label="Report due">
              <Input type="date" value={form.report_due} onChange={(e) => setForm({ ...form, report_due: e.target.value })} />
            </Field>
            <Field label="Contact name">
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </Field>
            <Field label="Contact email">
              <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </Field>
            <Field label="Notes" className="col-span-2">
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.grant_name.trim() || !form.funder_name.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate(form)}
            >
              {addMutation.isPending ? 'Saving…' : 'Save Grant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Slide-over */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{detail.grant_name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{detail.funder_name}</p>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="flex gap-2">
                  <Badge variant="outline" className={STATUS_STYLES[detail.status]}>{detail.status}</Badge>
                  {detail.funder_type && (
                    <Badge variant="outline" className={FUNDER_STYLES[detail.funder_type]}>{detail.funder_type}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DetailKV label="Requested" value={fmtMoney(detail.amount_requested)} />
                  <DetailKV label="Awarded" value={fmtMoney(detail.amount_awarded)} accent={!!detail.amount_awarded} />
                  <DetailKV label="Deadline" value={fmtDate(detail.deadline)} />
                  <DetailKV label="Applied" value={fmtDate(detail.application_date)} />
                  <DetailKV label="Awarded on" value={fmtDate(detail.award_date)} />
                  <DetailKV label="Report due" value={fmtDate(detail.report_due)} />
                  <DetailKV label="Contact" value={detail.contact_name || '—'} />
                  <DetailKV label="Email" value={detail.contact_email || '—'} />
                  {detail.dynasty_business && (
                    <DetailKV label="Dynasty business" value={detail.dynasty_business} className="col-span-2" />
                  )}
                </div>

                {detail.notes && (
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground tracking-wide">Notes</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-foreground/90">{detail.notes}</p>
                  </div>
                )}

                {/* Quick edit */}
                <div className="border-t border-border pt-4 space-y-3">
                  <Label className="text-xs uppercase text-muted-foreground tracking-wide">Update</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={detail.status}
                        onValueChange={(v) => updateMutation.mutate({ id: detail.id, status: v as GrantStatus })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(['researching','applied','pending','awarded','denied','closed'] as GrantStatus[]).map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Amount awarded</Label>
                      <Input
                        type="number"
                        defaultValue={detail.amount_awarded ?? ''}
                        onBlur={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          if (val !== detail.amount_awarded) {
                            updateMutation.mutate({ id: detail.id, amount_awarded: val });
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Created {fmtDate(detail.created_at)} · Updated {fmtDate(detail.updated_at)}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: GOLD }}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className="h-8 w-8 opacity-30" style={{ color: GOLD }} />
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs mb-1 block">{label}</Label>
      {children}
    </div>
  );
}

function DetailKV({ label, value, accent, className = '' }: { label: string; value: string; accent?: boolean; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm mt-0.5 ${accent ? 'font-bold' : 'font-medium'}`} style={accent ? { color: GOLD } : {}}>
        {value}
      </p>
    </div>
  );
}
