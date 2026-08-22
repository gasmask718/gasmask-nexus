import { useMemo, useState } from 'react';
import { useRouteCandidates, type CandidateType, type RouteCandidate } from '@/hooks/useRouteCandidates';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { RouteTemplateBuilder } from '@/components/delivery/RouteTemplateBuilder';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2, MapPin, AlertTriangle, Package, DollarSign, Phone, Sparkles, X, Route as RouteIcon,
  Gift, RotateCcw, TrendingDown, Zap,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TYPE_META: Record<CandidateType, { label: string; icon: any; color: string }> = {
  reorder: { label: 'Reorder', icon: Package, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  owner_order: { label: 'Owner Order', icon: Sparkles, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  collect_payment: { label: 'Collect $', icon: DollarSign, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  follow_up: { label: 'Follow-up', icon: Phone, color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  prospect: { label: 'Prospect', icon: MapPin, color: 'bg-muted text-muted-foreground border-border' },
  bring_samples: { label: 'Bring Samples', icon: Gift, color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  win_back: { label: 'Win-back', icon: RotateCcw, color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  at_risk: { label: 'At-risk', icon: TrendingDown, color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

const ALL_TYPES: CandidateType[] = ['reorder', 'owner_order', 'collect_payment', 'follow_up', 'prospect', 'bring_samples', 'win_back', 'at_risk'];

type DueFilter = 'today_overdue' | 'week' | 'all';

export default function RouteCommandCenter() {
  const { data: candidates = [], isLoading } = useRouteCandidates();
  const [search, setSearch] = useState('');
  const [neighborhood, setNeighborhood] = useState<string>('all');
  const [city, setCity] = useState<string>('all');
  const [activeTypes, setActiveTypes] = useState<Set<CandidateType>>(new Set(ALL_TYPES));
  const [dueFilter, setDueFilter] = useState<DueFilter>('today_overdue');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedPreview, setOptimizedPreview] = useState<null | { proposals: any[]; total_stores: number }>(null);

  // T3 M1: standalone Route Optimizer killed — Optimize action lives here.
  async function optimizeSelected() {
    const store_ids = Array.from(selected);
    if (store_ids.length === 0) {
      toast.error('Select at least one stop to optimize.');
      return;
    }
    setOptimizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('optimize-routes', {
        body: { store_ids },
      });
      if (error) throw error;
      const proposals = data?.proposals ?? data?.routes ?? [];
      setOptimizedPreview({ proposals, total_stores: store_ids.length });
      toast.success(`Optimized ${store_ids.length} stops into ${proposals.length} proposal(s).`);
    } catch (e: any) {
      toast.error(`Optimize failed: ${e.message ?? e}`);
      console.error('[RouteCommandCenter] optimize-routes error', e);
    } finally {
      setOptimizing(false);
    }
  }

  // Distinct filter values
  const { neighborhoods, cities } = useMemo(() => {
    const n = new Set<string>(), c = new Set<string>();
    candidates.forEach(r => { if (r.neighborhood) n.add(r.neighborhood); if (r.city) c.add(r.city); });
    return { neighborhoods: Array.from(n).sort(), cities: Array.from(c).sort() };
  }, [candidates]);

  // Deduped by store_id with merged reasons
  const merged = useMemo(() => {
    const map = new Map<string, RouteCandidate & { types: CandidateType[]; reasons: string[] }>();
    for (const r of candidates) {
      const existing = map.get(r.store_id);
      if (existing) {
        if (!existing.types.includes(r.candidate_type)) existing.types.push(r.candidate_type);
        existing.reasons.push(r.why);
        existing.priority = Math.max(existing.priority, r.priority);
        existing.value += r.value || 0;
        // Keep earliest due_date across signals (most urgent).
        if (r.due_date && (!existing.due_date || new Date(r.due_date) < new Date(existing.due_date))) {
          existing.due_date = r.due_date;
        }
        if (r.opportunity_id && !existing.opportunity_id) existing.opportunity_id = r.opportunity_id;
      } else {
        map.set(r.store_id, { ...r, types: [r.candidate_type], reasons: [r.why] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.priority - a.priority);
  }, [candidates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekOut = new Date(today);
    weekOut.setDate(weekOut.getDate() + 7);

    return merged.filter(r => {
      if (!r.types.some(t => activeTypes.has(t))) return false;
      if (neighborhood !== 'all' && r.neighborhood !== neighborhood) return false;
      if (city !== 'all' && r.city !== city) return false;
      if (q && !(r.store_name?.toLowerCase().includes(q) || r.address?.toLowerCase().includes(q))) return false;
      // Due-date filter only constrains rows that HAVE a due_date (route-flag opportunities).
      if (r.due_date && dueFilter !== 'all') {
        const d = new Date(r.due_date);
        d.setHours(0, 0, 0, 0);
        if (dueFilter === 'today_overdue' && d.getTime() > today.getTime()) return false;
        if (dueFilter === 'week' && d.getTime() > weekOut.getTime()) return false;
      }
      return true;
    });
  }, [merged, search, neighborhood, city, activeTypes, dueFilter]);

  const toggleType = (t: CandidateType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next.size === 0 ? new Set(ALL_TYPES) : next;
    });
  };

  const toggleOne = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectAllFiltered = () =>
    setSelected(prev => { const n = new Set(prev); filtered.forEach(r => n.add(r.store_id)); return n; });

  const clearSelection = () => setSelected(new Set());
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.store_id));

  const totalValue = useMemo(
    () => filtered.filter(r => selected.has(r.store_id)).reduce((s, r) => s + (r.value || 0), 0),
    [filtered, selected]
  );

  const selectedStoreIds = Array.from(selected);

  // Type counts (for filter chips)
  const typeCounts = useMemo(() => {
    const c: Record<CandidateType, number> = {
      reorder: 0, owner_order: 0, collect_payment: 0, follow_up: 0, prospect: 0,
      bring_samples: 0, win_back: 0, at_risk: 0,
    };
    merged.forEach(r => r.types.forEach(t => { c[t]++; }));
    return c;
  }, [merged]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Route Command Center</h1>
          <p className="text-muted-foreground mt-1">
            All dispatchable candidates · pick stops · assemble &amp; assign in one flow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={clearSelection} disabled={selected.size === 0}>
            <X className="h-4 w-4 mr-1" /> Clear ({selected.size})
          </Button>
          <Button
            variant="secondary"
            disabled={selected.size === 0 || optimizing}
            onClick={optimizeSelected}
          >
            {optimizing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
            Optimize Selected ({selected.size})
          </Button>
          <Button
            size="lg"
            disabled={selected.size === 0}
            onClick={() => setAssignOpen(true)}
          >
            <RouteIcon className="h-4 w-4 mr-2" />
            Assemble &amp; Assign Route ({selected.size})
          </Button>
        </div>
      </div>

      {optimizedPreview && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Optimized {optimizedPreview.total_stores} stop(s) → {optimizedPreview.proposals.length} route proposal(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
            {optimizedPreview.proposals.slice(0, 5).map((p: any, i: number) => (
              <div key={p.id ?? i} className="flex justify-between">
                <span>{p.driver ?? p.driver_id ?? `Proposal ${i + 1}`} · {p.stops ?? p.stores?.length ?? 0} stops</span>
                <span>{Math.round(p.distance ?? 0)} km{p.profit ? ` · $${Math.round(p.profit)}` : ''}</span>
              </div>
            ))}
            {optimizedPreview.proposals.length === 0 && <div>No viable driver assignment found for this selection.</div>}
          </CardContent>
        </Card>
      )}


      {/* Route Templates — saved coverage maps (borough / corridor / special) */}
      <RouteTemplateBuilder />

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Total candidates</p>
          <p className="text-2xl font-bold">{merged.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Showing</p>
          <p className="text-2xl font-bold">{filtered.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Selected for route</p>
          <p className="text-2xl font-bold text-primary">{selected.size}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Selected $ value</p>
          <p className="text-2xl font-bold">${totalValue.toFixed(0)}</p>
        </CardContent></Card>
      </div>

      {/* Type filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {ALL_TYPES.map(t => {
          const M = TYPE_META[t]; const Icon = M.icon; const active = activeTypes.has(t);
          return (
            <Button key={t} size="sm" variant={active ? 'default' : 'outline'}
              onClick={() => toggleType(t)} className="gap-2">
              <Icon className="h-3.5 w-3.5" />
              {M.label}
              <Badge variant="secondary" className="ml-1 h-5">{typeCounts[t]}</Badge>
            </Button>
          );
        })}
      </div>

      {/* Filters row */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3 flex-wrap">
          <Input
            placeholder="Search store or address…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={neighborhood} onValueChange={setNeighborhood}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Neighborhood" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All neighborhoods</SelectItem>
              {neighborhoods.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="City" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dueFilter} onValueChange={(v) => setDueFilter(v as DueFilter)}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Follow-ups due" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today_overdue">Follow-ups: today &amp; overdue</SelectItem>
              <SelectItem value="week">Follow-ups: next 7 days</SelectItem>
              <SelectItem value="all">Follow-ups: all upcoming</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={selectAllFiltered}>
            Select all filtered ({filtered.length})
          </Button>
        </CardContent>
      </Card>

      {/* Candidate table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Candidate Pool</CardTitle>
          <p className="text-xs text-muted-foreground">
            Pick stops → click "Assemble &amp; Assign Route"
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No candidates match the current filters.
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allFilteredSelected}
                        onCheckedChange={(c) => c ? selectAllFiltered() : clearSelection()}
                      />
                    </TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Why</TableHead>
                    <TableHead>Neighborhood</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Last visit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 500).map(r => {
                    const checked = selected.has(r.store_id);
                    const dueDate = r.due_date ? new Date(r.due_date) : null;
                    const today0 = new Date(); today0.setHours(0,0,0,0);
                    const dueLabel = dueDate
                      ? (() => {
                          const d0 = new Date(dueDate); d0.setHours(0,0,0,0);
                          const diff = Math.round((d0.getTime() - today0.getTime()) / 86400000);
                          if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-rose-400' };
                          if (diff === 0) return { text: 'Today', cls: 'text-amber-400 font-medium' };
                          if (diff === 1) return { text: 'Tomorrow', cls: 'text-foreground' };
                          return { text: dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), cls: 'text-muted-foreground' };
                        })()
                      : null;
                    return (
                      <TableRow
                        key={r.store_id}
                        className={checked ? 'bg-primary/5' : ''}
                        onClick={() => toggleOne(r.store_id)}
                      >
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleOne(r.store_id)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.store_name}</div>
                          {r.address && <div className="text-xs text-muted-foreground">{r.address}</div>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 mb-1">
                            {r.types.map(t => {
                              const M = TYPE_META[t]; const I = M.icon;
                              return (
                                <Badge key={t} variant="outline" className={`${M.color} text-[10px] gap-1`}>
                                  <I className="h-3 w-3" />{M.label}
                                </Badge>
                              );
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {r.reasons.slice(0, 2).join(' · ')}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.neighborhood || '—'}</TableCell>
                        <TableCell className="text-sm">{r.city || '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.value ? `$${r.value.toFixed(0)}` : '—'}
                        </TableCell>
                        <TableCell className={`text-xs ${dueLabel?.cls ?? 'text-muted-foreground'}`}>
                          {dueLabel?.text ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.last_visit_date ? new Date(r.last_visit_date).toLocaleDateString() : 'never'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filtered.length > 500 && (
                <p className="text-xs text-center text-muted-foreground py-3">
                  Showing first 500 of {filtered.length} — refine filters to see more.
                </p>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Assignment dialog — reuses existing wired component */}
      <RouteAssignmentDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        assigneeId=""
        assigneeName=""
        assigneeType="driver"
        preselectedStores={selectedStoreIds}
        onAssigned={() => { clearSelection(); }}
      />
    </div>
  );
}
