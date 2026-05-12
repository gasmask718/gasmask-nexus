import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  UserPlus,
  Phone,
  Target,
  Search,
  Shuffle,
  Loader2,
  CheckSquare,
  Square,
  ArrowRightLeft,
  UserMinus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DataTablePagination } from '@/components/crud/DataTablePagination';
import { spanishOrFilter } from '@/lib/spanishLeadFilter';
import { isSpanishLead } from '@/lib/spanishLeadDetector';

interface VA {
  user_id: string;
  name: string;
  email: string;
  lead_count: number;
}

interface LeadRow {
  id: string;
  business_name: string;
  priority_tier: string | null;
  city: string | null;
  state: string | null;
  phone_number: string | null;
  priority_score: number | null;
  assigned_va: string | null;
}

const DEFAULT_PAGE_SIZE = 50;
const TRANSFER_PAGE_SIZE = 500;

export default function VARosterPage() {
  const { toast } = useToast();
  const [vas, setVas] = useState<VA[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [unassignedTotal, setUnassignedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [unassigning, setUnassigning] = useState(false);

  // Bulk-selection + filters
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkTargetVa, setBulkTargetVa] = useState<string>('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [languageFilter, setLanguageFilter] = useState<'all' | 'spanish'>('all');
  const [stateOptions, setStateOptions] = useState<string[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Transfer panel state
  const [transferSourceVa, setTransferSourceVa] = useState<string>('');
  const [transferTargetVa, setTransferTargetVa] = useState<string>(''); // '' = unassign
  const [transferLeads, setTransferLeads] = useState<LeadRow[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSelectedIds, setTransferSelectedIds] = useState<Set<string>>(new Set());
  const [transferSearch, setTransferSearch] = useState('');
  const [transferring, setTransferring] = useState(false);

  const vaMap = useMemo(() => {
    const m: Record<string, VA> = {};
    vas.forEach((v) => (m[v.user_id] = v));
    return m;
  }, [vas]);

  const fetchVAs = useCallback(async () => {
    const { data: vaRoles, error: roleErr } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'va' as any);

    if (roleErr) {
      toast({ title: 'Failed to load VAs', description: roleErr.message, variant: 'destructive' });
      return;
    }

    if (!vaRoles?.length) {
      setVas([]);
      return;
    }

    const vaIds = vaRoles.map((r) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', vaIds);

    const { data: leadCounts } = await supabase
      .from('brandaro_qualified_leads')
      .select('assigned_va')
      .in('assigned_va', vaIds);

    const countMap: Record<string, number> = {};
    leadCounts?.forEach((l) => {
      if (l.assigned_va) countMap[l.assigned_va] = (countMap[l.assigned_va] || 0) + 1;
    });

    setVas(
      (profiles || []).map((p) => ({
        user_id: p.id,
        name: p.name || p.email || 'Unknown VA',
        email: p.email || '',
        lead_count: countMap[p.id] || 0,
      })),
    );
  }, [toast]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = supabase
      .from('brandaro_qualified_leads')
      .select('id, business_name, priority_tier, city, state, phone_number, priority_score, assigned_va', { count: 'exact' })
      .order('priority_score', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (statusFilter === 'assigned') q = q.not('assigned_va', 'is', null);
    if (statusFilter === 'unassigned') q = q.is('assigned_va', null);
    if (tierFilter !== 'all') q = q.eq('priority_tier', tierFilter);
    if (stateFilter !== 'all') q = q.eq('state', stateFilter);
    if (languageFilter === 'spanish') q = q.or(spanishOrFilter());
    if (search.trim()) {
      const s = search.trim().replace(/%/g, '');
      q = q.or(`business_name.ilike.%${s}%,city.ilike.%${s}%,state.ilike.%${s}%`);
    }

    const { data, error, count } = await q;
    if (error) {
      toast({ title: 'Failed to load leads', description: error.message, variant: 'destructive' });
      setLeads([]);
      setTotalLeads(0);
    } else {
      setLeads((data as LeadRow[]) || []);
      setTotalLeads(count ?? 0);
    }
    setLoading(false);
  }, [page, pageSize, statusFilter, tierFilter, stateFilter, languageFilter, search, toast]);

  // Refresh unassigned total badge whenever leads change
  const fetchUnassignedTotal = useCallback(async () => {
    const { count } = await supabase
      .from('brandaro_qualified_leads')
      .select('id', { count: 'exact', head: true })
      .is('assigned_va', null);
    setUnassignedTotal(count ?? 0);
  }, []);

  // Distinct states (one-time)
  const fetchStateOptions = useCallback(async () => {
    const { data } = await supabase
      .from('brandaro_qualified_leads')
      .select('state')
      .not('state', 'is', null)
      .limit(2000);
    const set = new Set<string>();
    (data || []).forEach((r: any) => r.state && set.add(r.state));
    setStateOptions(Array.from(set).sort());
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchVAs(), fetchLeads(), fetchUnassignedTotal()]);
  }, [fetchVAs, fetchLeads, fetchUnassignedTotal]);

  useEffect(() => {
    fetchVAs();
    fetchUnassignedTotal();
    fetchStateOptions();
  }, [fetchVAs, fetchUnassignedTotal, fetchStateOptions]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, tierFilter, stateFilter, languageFilter, search, pageSize]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const allFilteredSelected =
    leads.length > 0 && leads.every((l) => selectedLeadIds.has(l.id));

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        leads.forEach((l) => next.delete(l.id));
      } else {
        leads.forEach((l) => next.add(l.id));
      }
      return next;
    });
  };


  const handleBulkAssign = async () => {
    if (!bulkTargetVa || selectedLeadIds.size === 0) return;
    setAssigning(true);
    const ids = Array.from(selectedLeadIds);
    const { error, count } = await supabase
      .from('brandaro_qualified_leads')
      .update({ assigned_va: bulkTargetVa } as any, { count: 'exact' })
      .in('id', ids);

    if (error) {
      toast({ title: 'Bulk assign failed', description: error.message, variant: 'destructive' });
    } else {
      const vaName = vas.find((v) => v.user_id === bulkTargetVa)?.name || 'VA';
      toast({
        title: 'Leads assigned',
        description: `${count ?? ids.length} lead(s) assigned to ${vaName}.`,
      });
      await refreshAll();
    }
    setAssigning(false);
  };

  const handleAutoDistribute = async () => {
    if (vas.length === 0 || selectedLeadIds.size === 0) return;
    setAssigning(true);
    const ids = Array.from(selectedLeadIds);

    // Round-robin across VAs (sorted by current load ascending so light VAs get more first)
    const sortedVas = [...vas].sort((a, b) => a.lead_count - b.lead_count);
    const buckets: Record<string, string[]> = {};
    sortedVas.forEach((v) => (buckets[v.user_id] = []));
    ids.forEach((id, i) => {
      const va = sortedVas[i % sortedVas.length];
      buckets[va.user_id].push(id);
    });

    let totalAssigned = 0;
    let failures: string[] = [];
    for (const [vaId, leadIds] of Object.entries(buckets)) {
      if (leadIds.length === 0) continue;
      const { error, count } = await supabase
        .from('brandaro_qualified_leads')
        .update({ assigned_va: vaId } as any, { count: 'exact' })
        .in('id', leadIds);
      if (error) failures.push(error.message);
      else totalAssigned += count ?? leadIds.length;
    }

    if (failures.length) {
      toast({
        title: 'Some assignments failed',
        description: failures.join(' · '),
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Auto-distributed',
        description: `${totalAssigned} lead(s) round-robined across ${sortedVas.length} VAs.`,
      });
    }
    await refreshAll();
    setAssigning(false);
  };

  const tierColor = (tier: string | null) => {
    if (tier === 'hot') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (tier === 'warm') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  const handleBulkUnassign = async () => {
    if (selectedLeadIds.size === 0) return;
    setUnassigning(true);
    const ids = Array.from(selectedLeadIds);
    const { error, count } = await supabase
      .from('brandaro_qualified_leads')
      .update({ assigned_va: null } as any, { count: 'exact' })
      .in('id', ids)
      .not('assigned_va', 'is', null);

    if (error) {
      toast({ title: 'Unassign failed', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Leads unassigned',
        description: `${count ?? ids.length} lead(s) released back to the unassigned pool.`,
      });
      setSelectedLeadIds(new Set());
      await refreshAll();
    }
    setUnassigning(false);
  };

  const handleUnassignOne = async (leadId: string) => {
    const { error } = await supabase
      .from('brandaro_qualified_leads')
      .update({ assigned_va: null } as any)
      .eq('id', leadId);
    if (error) {
      toast({ title: 'Unassign failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Lead unassigned' });
      await refreshAll();
    }
  };

  // ── Transfer: load leads assigned to source VA ──
  useEffect(() => {
    if (!transferSourceVa) {
      setTransferLeads([]);
      setTransferSelectedIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      setTransferLoading(true);
      const { data, error } = await supabase
        .from('brandaro_qualified_leads')
        .select('id, business_name, priority_tier, city, state, phone_number, priority_score')
        .eq('assigned_va', transferSourceVa)
        .order('priority_score', { ascending: false })
        .limit(TRANSFER_PAGE_SIZE);
      if (cancelled) return;
      if (error) {
        toast({ title: 'Failed to load VA leads', description: error.message, variant: 'destructive' });
        setTransferLeads([]);
      } else {
        setTransferLeads((data as LeadRow[]) || []);
      }
      setTransferSelectedIds(new Set());
      setTransferLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [transferSourceVa]);

  const filteredTransferLeads = useMemo(() => {
    const q = transferSearch.trim().toLowerCase();
    if (!q) return transferLeads;
    return transferLeads.filter(
      (l) =>
        (l.business_name || '').toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q) ||
        (l.state || '').toLowerCase().includes(q),
    );
  }, [transferLeads, transferSearch]);

  const allTransferSelected =
    filteredTransferLeads.length > 0 &&
    filteredTransferLeads.every((l) => transferSelectedIds.has(l.id));

  const toggleTransferLead = (id: string) => {
    setTransferSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllTransferFiltered = () => {
    setTransferSelectedIds((prev) => {
      const next = new Set(prev);
      if (allTransferSelected) filteredTransferLeads.forEach((l) => next.delete(l.id));
      else filteredTransferLeads.forEach((l) => next.add(l.id));
      return next;
    });
  };

  const handleTransfer = async () => {
    if (!transferSourceVa || transferSelectedIds.size === 0) return;
    if (transferTargetVa && transferTargetVa === transferSourceVa) {
      toast({ title: 'Pick a different target', variant: 'destructive' });
      return;
    }
    setTransferring(true);
    const ids = Array.from(transferSelectedIds);
    const newAssignee = transferTargetVa || null;
    const { error, count } = await supabase
      .from('brandaro_qualified_leads')
      .update({ assigned_va: newAssignee } as any, { count: 'exact' })
      .in('id', ids)
      .eq('assigned_va', transferSourceVa);

    if (error) {
      toast({ title: 'Transfer failed', description: error.message, variant: 'destructive' });
    } else {
      const sourceName = vas.find((v) => v.user_id === transferSourceVa)?.name || 'source';
      const targetName = newAssignee
        ? vas.find((v) => v.user_id === newAssignee)?.name || 'VA'
        : 'unassigned pool';
      toast({
        title: 'Leads transferred',
        description: `${count ?? ids.length} lead(s) moved from ${sourceName} → ${targetName}.`,
      });
      const { data: refreshed } = await supabase
        .from('brandaro_qualified_leads')
        .select('id, business_name, priority_tier, city, state, phone_number, priority_score')
        .eq('assigned_va', transferSourceVa)
        .order('priority_score', { ascending: false })
        .limit(TRANSFER_PAGE_SIZE);
      setTransferLeads((refreshed as LeadRow[]) || []);
      setTransferSelectedIds(new Set());
      await refreshAll();
    }
    setTransferring(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> VA Roster
          </h1>
          <p className="text-sm text-muted-foreground">
            Assign leads to VAs in bulk or auto-distribute by current load
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {vas.length} Active VAs · {unassignedTotal} Unassigned Leads
        </Badge>
      </div>

      {/* VA Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vas.map((va) => {
          const isTarget = bulkTargetVa === va.user_id;
          return (
            <Card
              key={va.user_id}
              className={`border-border/50 transition-all cursor-pointer ${
                isTarget ? 'ring-2 ring-primary border-primary/50' : 'hover:border-primary/30'
              }`}
              onClick={() => setBulkTargetVa(va.user_id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="truncate">{va.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {va.lead_count} leads
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground truncate">{va.email}</p>
              </CardHeader>
              <CardContent className="pt-2">
                <Button
                  size="sm"
                  variant={isTarget ? 'default' : 'outline'}
                  className="w-full gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBulkTargetVa(va.user_id);
                  }}
                >
                  <Target className="h-3.5 w-3.5" />
                  {isTarget ? 'Selected as target' : 'Set as target'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {vas.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground col-span-3 text-center py-8">
            No VAs found. Users need the "va" role to appear here.
          </p>
        )}
      </div>

      {/* Bulk Action Bar */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4 flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="text-sm">
            {selectedLeadIds.size} lead(s) selected
          </Badge>

          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <Select value={bulkTargetVa} onValueChange={setBulkTargetVa}>
              <SelectTrigger className="w-[240px]">
                <SelectValue placeholder="Choose target VA…" />
              </SelectTrigger>
              <SelectContent>
                {vas.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>
                    {v.name} ({v.lead_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleBulkAssign}
              disabled={!bulkTargetVa || selectedLeadIds.size === 0 || assigning}
              className="gap-2"
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Assign {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} ` : ''}to VA
            </Button>

            <Button
              variant="outline"
              onClick={handleAutoDistribute}
              disabled={vas.length === 0 || selectedLeadIds.size === 0 || assigning}
              className="gap-2"
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shuffle className="h-4 w-4" />
              )}
              Auto-Distribute
            </Button>

            <Button
              variant="outline"
              onClick={handleBulkUnassign}
              disabled={selectedLeadIds.size === 0 || unassigning}
              className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            >
              {unassigning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserMinus className="h-4 w-4" />
              )}
              Unassign {selectedLeadIds.size > 0 ? `${selectedLeadIds.size} ` : ''}lead(s)
            </Button>

            {selectedLeadIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLeadIds(new Set())}
                disabled={assigning || unassigning}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* All Leads Table */}
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Leads — showing {leads.length} of {totalLeads}
            <Badge variant="outline" className="ml-2 text-[10px]">
              {unassignedTotal} unassigned in pool
            </Badge>
          </CardTitle>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search business, city, state…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as 'all' | 'assigned' | 'unassigned')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tiers</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="new">New</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                {stateOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={toggleAllFiltered} className="gap-2">
              {allFilteredSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {allFilteredSelected ? 'Unselect page' : 'Select page'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-2 w-8">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleAllFiltered}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="pb-2 font-medium">Business</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Phone</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Loading leads…
                    </td>
                  </tr>
                )}
                {!loading && leads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No leads match the current filters.
                    </td>
                  </tr>
                )}
                {leads.map((lead) => {
                  const checked = selectedLeadIds.has(lead.id);
                  const assignedVa = lead.assigned_va ? vaMap[lead.assigned_va] : null;
                  return (
                    <tr
                      key={lead.id}
                      className={`border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer ${
                        checked ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => toggleLead(lead.id)}
                    >
                      <td className="py-2 pr-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleLead(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${lead.business_name}`}
                        />
                      </td>
                      <td className="py-2 font-medium">{lead.business_name}</td>
                      <td className="py-2">
                        {lead.assigned_va ? (
                          <Badge className="text-[10px] border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                            ASSIGNED{assignedVa ? ` · ${assignedVa.name}` : ''}
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] border bg-slate-500/15 text-slate-300 border-slate-500/30">
                            UNASSIGNED
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {lead.city}
                        {lead.city && lead.state ? ', ' : ''}
                        {lead.state}
                      </td>
                      <td className="py-2">
                        <Badge className={`text-[10px] border ${tierColor(lead.priority_tier)}`}>
                          {lead.priority_tier?.toUpperCase() || 'NEW'}
                        </Badge>
                      </td>
                      <td className="py-2 text-muted-foreground tabular-nums">
                        {lead.priority_score ?? '—'}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {lead.phone_number ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {lead.phone_number}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {lead.assigned_va && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-amber-400 hover:bg-amber-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignOne(lead.id);
                            }}
                          >
                            <UserMinus className="h-3.5 w-3.5 mr-1" />
                            Unassign
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <DataTablePagination
            currentPage={page}
            totalPages={Math.max(1, Math.ceil(totalLeads / pageSize))}
            pageSize={pageSize}
            totalItems={totalLeads}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[25, 50, 100, 250]}
          />
        </CardContent>
      </Card>

      {/* ─── Transfer Leads Between VAs ─── */}
      <Card className="border-amber-500/30">
        <CardHeader className="space-y-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-400" /> Transfer Leads Between VAs
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Move leads from one VA's pipeline to another (or release back to the unassigned pool).
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={transferSourceVa} onValueChange={setTransferSourceVa}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="From VA…" />
              </SelectTrigger>
              <SelectContent>
                {vas.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>
                    {v.name} ({v.lead_count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />

            <Select
              value={transferTargetVa || '__unassign__'}
              onValueChange={(v) => setTransferTargetVa(v === '__unassign__' ? '' : v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="To VA…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassign__">
                  <span className="inline-flex items-center gap-2">
                    <UserMinus className="h-3.5 w-3.5" /> Unassign (release pool)
                  </span>
                </SelectItem>
                {vas
                  .filter((v) => v.user_id !== transferSourceVa)
                  .map((v) => (
                    <SelectItem key={v.user_id} value={v.user_id}>
                      {v.name} ({v.lead_count})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleTransfer}
              disabled={!transferSourceVa || transferSelectedIds.size === 0 || transferring}
              className="gap-2"
            >
              {transferring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Transfer {transferSelectedIds.size > 0 ? `${transferSelectedIds.size} ` : ''}lead(s)
            </Button>
          </div>

          {transferSourceVa && (
            <div className="flex flex-wrap gap-2 pt-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search this VA's leads…"
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" onClick={toggleAllTransferFiltered} className="gap-2">
                {allTransferSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {allTransferSelected ? 'Unselect all' : 'Select all'}
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {!transferSourceVa ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Pick a source VA above to view their leads.
            </p>
          ) : (
            <div className="overflow-auto max-h-[450px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-2 w-8">
                      <Checkbox
                        checked={allTransferSelected}
                        onCheckedChange={toggleAllTransferFiltered}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="pb-2 font-medium">Business</th>
                    <th className="pb-2 font-medium">Location</th>
                    <th className="pb-2 font-medium">Priority</th>
                    <th className="pb-2 font-medium">Score</th>
                    <th className="pb-2 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {transferLoading && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                        Loading leads…
                      </td>
                    </tr>
                  )}
                  {!transferLoading && filteredTransferLeads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        This VA has no leads matching the search.
                      </td>
                    </tr>
                  )}
                  {filteredTransferLeads.map((lead) => {
                    const checked = transferSelectedIds.has(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer ${
                          checked ? 'bg-amber-500/5' : ''
                        }`}
                        onClick={() => toggleTransferLead(lead.id)}
                      >
                        <td className="py-2 pr-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleTransferLead(lead.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${lead.business_name}`}
                          />
                        </td>
                        <td className="py-2 font-medium">{lead.business_name}</td>
                        <td className="py-2 text-muted-foreground">
                          {lead.city}
                          {lead.city && lead.state ? ', ' : ''}
                          {lead.state}
                        </td>
                        <td className="py-2">
                          <Badge className={`text-[10px] border ${tierColor(lead.priority_tier)}`}>
                            {lead.priority_tier?.toUpperCase() || 'NEW'}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground tabular-nums">
                          {lead.priority_score ?? '—'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {lead.phone_number ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone_number}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
