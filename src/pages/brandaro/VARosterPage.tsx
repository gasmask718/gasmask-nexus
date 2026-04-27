import { useEffect, useMemo, useState } from 'react';
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

interface VA {
  user_id: string;
  name: string;
  email: string;
  lead_count: number;
}

interface UnassignedLead {
  id: string;
  business_name: string;
  priority_tier: string | null;
  city: string | null;
  state: string | null;
  phone_number: string | null;
  priority_score: number | null;
}

const PAGE_SIZE = 500;

export default function VARosterPage() {
  const { toast } = useToast();
  const [vas, setVas] = useState<VA[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState<UnassignedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);

  // Bulk-selection + filters
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkTargetVa, setBulkTargetVa] = useState<string>('');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');

  // Transfer panel state
  const [transferSourceVa, setTransferSourceVa] = useState<string>('');
  const [transferTargetVa, setTransferTargetVa] = useState<string>(''); // '' = unassign
  const [transferLeads, setTransferLeads] = useState<UnassignedLead[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSelectedIds, setTransferSelectedIds] = useState<Set<string>>(new Set());
  const [transferSearch, setTransferSearch] = useState('');
  const [transferring, setTransferring] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    const { data: vaRoles, error: roleErr } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'va' as any);

    if (roleErr) {
      toast({ title: 'Failed to load VAs', description: roleErr.message, variant: 'destructive' });
    }

    if (vaRoles?.length) {
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
    } else {
      setVas([]);
    }

    const { data: leads, error: leadErr } = await supabase
      .from('brandaro_qualified_leads')
      .select('id, business_name, priority_tier, city, state, phone_number, priority_score')
      .is('assigned_va', null)
      .order('priority_score', { ascending: false })
      .limit(PAGE_SIZE);

    if (leadErr) {
      toast({ title: 'Failed to load leads', description: leadErr.message, variant: 'destructive' });
    }

    setUnassignedLeads((leads as UnassignedLead[]) || []);
    setSelectedLeadIds(new Set());
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return unassignedLeads.filter((l) => {
      if (tierFilter !== 'all' && (l.priority_tier || 'new') !== tierFilter) return false;
      if (stateFilter !== 'all' && l.state !== stateFilter) return false;
      if (!q) return true;
      return (
        (l.business_name || '').toLowerCase().includes(q) ||
        (l.city || '').toLowerCase().includes(q) ||
        (l.state || '').toLowerCase().includes(q)
      );
    });
  }, [unassignedLeads, search, tierFilter, stateFilter]);

  const stateOptions = useMemo(() => {
    const s = new Set<string>();
    unassignedLeads.forEach((l) => l.state && s.add(l.state));
    return Array.from(s).sort();
  }, [unassignedLeads]);

  const allFilteredSelected =
    filteredLeads.length > 0 && filteredLeads.every((l) => selectedLeadIds.has(l.id));

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
        filteredLeads.forEach((l) => next.delete(l.id));
      } else {
        filteredLeads.forEach((l) => next.add(l.id));
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
      await fetchData();
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
    await fetchData();
    setAssigning(false);
  };

  const tierColor = (tier: string | null) => {
    if (tier === 'hot') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (tier === 'warm') return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
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
          {vas.length} Active VAs · {unassignedLeads.length} Unassigned Leads
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

            {selectedLeadIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedLeadIds(new Set())}
                disabled={assigning}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Unassigned Leads Table */}
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> Unassigned Leads ({filteredLeads.length}
            {filteredLeads.length !== unassignedLeads.length && ` of ${unassignedLeads.length}`})
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
              {allFilteredSelected ? 'Unselect all' : 'Select all filtered'}
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
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                      Loading leads…
                    </td>
                  </tr>
                )}
                {!loading && filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No unassigned leads match the current filters.
                    </td>
                  </tr>
                )}
                {filteredLeads.map((lead) => {
                  const checked = selectedLeadIds.has(lead.id);
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
        </CardContent>
      </Card>
    </div>
  );
}
