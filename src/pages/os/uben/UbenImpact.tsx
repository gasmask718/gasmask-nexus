import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  Plus,
  Users,
  Sparkles,
  Trophy,
  DollarSign,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

// ═══════════════════════════════════════════════════════════════════════
// UBEN Impact — outcome tracking & reporting
// ═══════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C';

const CATEGORY_OPTIONS = [
  'workforce_training',
  'business_development',
  'technology_access',
  'community_outreach',
  'grant_milestone',
  'other',
] as const;
type Category = (typeof CATEGORY_OPTIONS)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  workforce_training: 'Workforce Training',
  business_development: 'Business Development',
  technology_access: 'Technology Access',
  community_outreach: 'Community Outreach',
  grant_milestone: 'Grant Milestone',
  other: 'Other',
};

const CATEGORY_BADGE: Record<Category, string> = {
  workforce_training: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  business_development: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  technology_access: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  community_outreach: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  grant_milestone: '', // inline gold style
  other: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30',
};

function categoryBadge(cat: string | null) {
  const key = ((cat ?? 'other') as Category);
  const label = CATEGORY_LABEL[key] ?? cat ?? 'Other';
  if (key === 'grant_milestone') {
    return (
      <Badge
        variant="outline"
        style={{ backgroundColor: `${GOLD}22`, borderColor: `${GOLD}66`, color: GOLD }}
      >
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={CATEGORY_BADGE[key] ?? CATEGORY_BADGE.other}>
      {label}
    </Badge>
  );
}

interface ImpactEntry {
  id: string;
  program_id: string;
  date: string;
  participants: number;
  outcome_notes: string | null;
  logged_by: string | null;
  created_at: string;
  category: string | null;
  description: string | null;
  dynasty_business: string | null;
}

interface ImpactRow extends ImpactEntry {
  program_name: string | null;
}

interface ProgramLite {
  id: string;
  name: string;
}

interface Stats {
  peopleServed: number;
  activePrograms: number;
  grantsAwarded: number;
  fundingSecured: number;
}

function currency(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function UbenImpact() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    program_id: '',
    category: 'community_outreach' as Category,
    description: '',
    participants: 0,
    dynasty_business: '',
    logged_by: '',
  });

  // ── Stats (parallel) ─────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['uben_impact_stats'],
    queryFn: async () => {
      const [peopleRes, activeRes, grantsRes, fundingRes] = await Promise.all([
        supabase.from('uben_programs').select('participant_count'),
        supabase
          .from('uben_programs')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('uben_grant_applications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'awarded'),
        supabase
          .from('uben_grant_applications')
          .select('amount_awarded')
          .eq('status', 'awarded'),
      ]);

      if (peopleRes.error) throw peopleRes.error;
      if (activeRes.error) throw activeRes.error;
      if (grantsRes.error) throw grantsRes.error;
      if (fundingRes.error) throw fundingRes.error;

      return {
        peopleServed: (peopleRes.data ?? []).reduce(
          (a, r) => a + (r.participant_count ?? 0),
          0
        ),
        activePrograms: activeRes.count ?? 0,
        grantsAwarded: grantsRes.count ?? 0,
        fundingSecured: (fundingRes.data ?? []).reduce(
          (a, r) => a + Number(r.amount_awarded ?? 0),
          0
        ),
      };
    },
  });

  // ── Quarterly breakdown ──────────────────────────────────────────────
  const { data: quarterly = [0, 0, 0, 0], isLoading: qLoading } = useQuery<number[]>({
    queryKey: ['uben_beneficiaries_quarterly'],
    queryFn: async () => {
      const yearStart = new Date();
      yearStart.setMonth(0, 1);
      yearStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('uben_beneficiaries')
        .select('enrollment_date')
        .gte('enrollment_date', yearStart.toISOString().slice(0, 10))
        .not('enrollment_date', 'is', null);
      if (error) throw error;
      const buckets = [0, 0, 0, 0];
      (data ?? []).forEach((r) => {
        if (!r.enrollment_date) return;
        const m = parseISO(r.enrollment_date).getMonth();
        buckets[Math.floor(m / 3)]++;
      });
      return buckets;
    },
  });

  // ── Programs (for dropdown) ──────────────────────────────────────────
  const { data: programs = [] } = useQuery<ProgramLite[]>({
    queryKey: ['uben_programs_lite_active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_programs')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return (data ?? []) as ProgramLite[];
    },
  });

  const { data: allPrograms = [] } = useQuery<ProgramLite[]>({
    queryKey: ['uben_programs_lite_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_programs')
        .select('id, name');
      if (error) throw error;
      return (data ?? []) as ProgramLite[];
    },
  });

  const programMap = useMemo(() => {
    const m = new Map<string, string>();
    allPrograms.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [allPrograms]);

  // ── Impact log ───────────────────────────────────────────────────────
  const { data: entries = [], isLoading: entriesLoading } = useQuery<ImpactRow[]>({
    queryKey: ['uben_impact_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('uben_impact_log')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...(r as ImpactEntry),
        program_name: programMap.get((r as ImpactEntry).program_id) ?? null,
      }));
    },
    enabled: allPrograms.length >= 0,
  });

  // ── Add entry mutation ───────────────────────────────────────────────
  const addEntry = useMutation({
    mutationFn: async () => {
      if (!form.program_id) throw new Error('Program is required');
      if (!form.description.trim()) throw new Error('Description is required');
      const { error } = await supabase.from('uben_impact_log').insert({
        date: form.date,
        program_id: form.program_id,
        category: form.category,
        description: form.description.trim(),
        participants: Number(form.participants) || 0,
        dynasty_business: form.dynasty_business.trim() || null,
        logged_by: form.logged_by.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Impact entry added');
      qc.invalidateQueries({ queryKey: ['uben_impact_log'] });
      qc.invalidateQueries({ queryKey: ['uben_impact_stats'] });
      setAddOpen(false);
      setForm({
        date: new Date().toISOString().slice(0, 10),
        program_id: '',
        category: 'community_outreach',
        description: '',
        participants: 0,
        dynasty_business: '',
        logged_by: '',
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Export CSV ───────────────────────────────────────────────────────
  const handleExport = () => {
    const headers = [
      'date',
      'program_name',
      'category',
      'description',
      'participants',
      'dynasty_business',
      'logged_by',
      'created_at',
    ];
    const rows = entries.map((e) =>
      [
        e.date,
        e.program_name ?? '',
        e.category ?? '',
        e.description ?? '',
        e.participants,
        e.dynasty_business ?? '',
        e.logged_by ?? '',
        e.created_at,
      ]
        .map(csvEscape)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uben_impact_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${GOLD}22`, border: `1px solid ${GOLD}55` }}
          >
            <Heart className="h-5 w-5" style={{ color: GOLD }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">UBEN Impact</h1>
            <p className="text-sm text-neutral-400">
              Community outcomes, program reach, and funding secured.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="border-neutral-700"
            onClick={handleExport}
            disabled={entries.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => setAddOpen(true)}
            style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Impact Entry
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {statsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-neutral-800/60" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="People Served"
            value={stats?.peopleServed ?? 0}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Active Programs"
            value={stats?.activePrograms ?? 0}
            icon={<Sparkles className="h-4 w-4" />}
          />
          <StatCard
            label="Grants Awarded"
            value={stats?.grantsAwarded ?? 0}
            icon={<Trophy className="h-4 w-4" />}
          />
          <StatCard
            label="Funding Secured"
            value={currency(stats?.fundingSecured ?? 0)}
            icon={<DollarSign className="h-4 w-4" />}
          />
        </div>
      )}

      {/* Quarterly breakdown */}
      <Card className="bg-neutral-900/60 border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-neutral-300">
            Quarterly Enrollments — {new Date().getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {qLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 bg-neutral-800/60" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q, i) => {
                const count = quarterly[i] ?? 0;
                const empty = count === 0;
                return (
                  <div
                    key={q}
                    className={`rounded-lg border p-4 ${
                      empty
                        ? 'border-neutral-800 bg-neutral-900/40 text-neutral-500'
                        : 'border-neutral-800 bg-neutral-900/80'
                    }`}
                  >
                    <div className="text-xs uppercase tracking-wide text-neutral-500">
                      {q}
                    </div>
                    <div
                      className="text-2xl font-semibold mt-1"
                      style={{ color: empty ? undefined : GOLD }}
                    >
                      {count}
                    </div>
                    <div className="text-xs text-neutral-500 mt-1">enrolled</div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impact log table */}
      <Card className="bg-neutral-900/60 border-neutral-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-neutral-300">Impact Log</CardTitle>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-neutral-800/60" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-neutral-400">
              <Heart className="h-8 w-8 mx-auto mb-3 opacity-60" />
              <p className="font-medium">No impact entries yet.</p>
              <p className="text-sm mt-1 mb-4">
                Add your first entry to start tracking UBEN's community outcomes.
              </p>
              <Button
                onClick={() => setAddOpen(true)}
                style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Impact Entry
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800 hover:bg-transparent">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Participants</TableHead>
                    <TableHead>Dynasty Business</TableHead>
                    <TableHead>Logged By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => {
                    const isExpanded = expandedId === e.id;
                    const desc = e.description ?? e.outcome_notes ?? '';
                    const truncated = desc.length > 80 ? desc.slice(0, 80) + '…' : desc;
                    return (
                      <>
                        <TableRow
                          key={e.id}
                          className="border-neutral-800 cursor-pointer hover:bg-neutral-800/40"
                          onClick={() => setExpandedId(isExpanded ? null : e.id)}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-neutral-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-neutral-500" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(parseISO(e.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {e.program_name ?? (
                              <span className="text-neutral-500">—</span>
                            )}
                          </TableCell>
                          <TableCell>{categoryBadge(e.category)}</TableCell>
                          <TableCell className="text-sm max-w-xs">
                            {truncated || <span className="text-neutral-500">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {e.participants}
                          </TableCell>
                          <TableCell className="text-sm text-neutral-300">
                            {e.dynasty_business ?? (
                              <span className="text-neutral-500">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-neutral-400">
                            {e.logged_by ?? '—'}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${e.id}-exp`} className="border-neutral-800 bg-neutral-900/60">
                            <TableCell></TableCell>
                            <TableCell colSpan={7} className="text-sm text-neutral-300 py-4">
                              <div className="space-y-2">
                                {e.description && (
                                  <div>
                                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                                      Description
                                    </div>
                                    <div className="whitespace-pre-wrap">{e.description}</div>
                                  </div>
                                )}
                                {e.outcome_notes && (
                                  <div>
                                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                                      Outcome Notes
                                    </div>
                                    <div className="whitespace-pre-wrap">{e.outcome_notes}</div>
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

      {/* Add impact modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-neutral-950 border-neutral-800 text-neutral-100 max-w-lg">
          <DialogHeader>
            <DialogTitle>New Impact Entry</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Record a community outcome tied to an active program.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div>
                <Label>Program *</Label>
                <Select
                  value={form.program_id}
                  onValueChange={(v) => setForm({ ...form, program_id: v })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-800">
                    <SelectValue placeholder="Select program…" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-neutral-500">
                        No active programs
                      </div>
                    ) : (
                      programs.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as Category })}
              >
                <SelectTrigger className="bg-neutral-900 border-neutral-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What outcome or milestone are you recording?"
                className="bg-neutral-900 border-neutral-800 min-h-[90px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Participants</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.participants}
                  onChange={(e) =>
                    setForm({ ...form, participants: Number(e.target.value) })
                  }
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div>
                <Label>Dynasty Business</Label>
                <Input
                  value={form.dynasty_business}
                  onChange={(e) => setForm({ ...form, dynasty_business: e.target.value })}
                  placeholder="e.g. Brandaro, TopTier"
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
            </div>
            <div>
              <Label>Logged By</Label>
              <Input
                value={form.logged_by}
                onChange={(e) => setForm({ ...form, logged_by: e.target.value })}
                placeholder="Optional — your name or handle"
                className="bg-neutral-900 border-neutral-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              className="border-neutral-700"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addEntry.mutate()}
              disabled={
                addEntry.isPending || !form.program_id || !form.description.trim()
              }
              style={{ backgroundColor: GOLD, color: '#0a0a0a' }}
            >
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Small subcomponents ────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="bg-neutral-900/60 border-neutral-800">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-neutral-400">{label}</CardTitle>
        <span className="text-neutral-500">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold" style={{ color: GOLD }}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
