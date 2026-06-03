import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, MapPin, AlertTriangle, CheckCircle2, Users, Route as RouteIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RouteAssignmentDialog } from '@/components/delivery/RouteAssignmentDialog';
import { SendToRouteBoardButton } from '@/components/delivery/SendToRouteBoardButton';
import { toast } from 'sonner';

type Row = {
  neighborhood: string;
  total_stores: number;
  worked_stores: number;
  prospect_stores: number;
  coverage_pct: number | null;
  source_verified: number;
  source_zip_lookup: number;
  source_other: number;
};

type Summary = {
  total_live: number;
  tagged: number;
  needs_manual: number;
  untagged_blank: number;
};

export default function NeighborhoodCoverage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchStoreIds, setDispatchStoreIds] = useState<string[]>([]);
  const [dispatchNeighborhood, setDispatchNeighborhood] = useState<string>('');
  const [isLoadingDispatch, setIsLoadingDispatch] = useState(false);

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ['v_neighborhood_coverage'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_neighborhood_coverage')
        .select('*')
        .order('total_stores', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ['neighborhood-coverage-summary'],
    queryFn: async () => {
      const total = await supabase.from('stores').select('id', { count: 'exact', head: true }).is('deleted_at', null);
      const tagged = await supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .not('neighborhood', 'is', null);
      const manual = await supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .eq('neighborhood_source', 'needs_manual');
      const blank = await supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .is('deleted_at', null)
        .is('neighborhood', null)
        .is('neighborhood_source', null);
      return {
        total_live: total.count ?? 0,
        tagged: tagged.count ?? 0,
        needs_manual: manual.count ?? 0,
        untagged_blank: blank.count ?? 0,
      };
    },
  });

  const filtered = rows.filter((r) => r.neighborhood.toLowerCase().includes(search.toLowerCase()));
  const totalNeighborhoods = rows.length;
  const needsTagging = (summary?.needs_manual ?? 0) + (summary?.untagged_blank ?? 0);

  const handleDispatchNeighborhood = async (neighborhood: string) => {
    setIsLoadingDispatch(true);
    setDispatchNeighborhood(neighborhood);
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id')
        .is('deleted_at', null)
        .eq('approval_status', 'approved')
        .eq('neighborhood', neighborhood)
        .limit(500);
      if (error) throw error;
      const ids = (data || []).map((s: any) => s.id);
      if (ids.length === 0) {
        toast.warning(`No approved stores found in ${neighborhood}`);
        setIsLoadingDispatch(false);
        return;
      }
      setDispatchStoreIds(ids);
      setDispatchOpen(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load stores');
    } finally {
      setIsLoadingDispatch(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <MapPin className="h-7 w-7 text-primary" />
          Neighborhood Coverage
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          The coverage map — how many stores exist in each neighborhood, who we've spoken to, and who's still on the go-speak-with list.
        </p>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Neighborhoods Covered</div>
            <div className="text-3xl font-bold mt-1">{totalNeighborhoods}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Stores Tagged</div>
            <div className="text-3xl font-bold mt-1 text-green-600">
              {summary?.tagged ?? '…'}
              <span className="text-base text-muted-foreground font-normal"> / {summary?.total_live ?? '…'}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary ? Math.round((100 * summary.tagged) / Math.max(summary.total_live, 1)) : 0}% of live universe
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Needs Manual Tagging</div>
            <div className="text-3xl font-bold mt-1 text-amber-600">{summary?.needs_manual ?? '…'}</div>
            <div className="text-xs text-muted-foreground mt-1">Split-zip stores awaiting human label</div>
          </CardContent>
        </Card>
        <Card className="border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="text-xs text-amber-700 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Backlog
            </div>
            <div className="text-3xl font-bold mt-1 text-amber-700 dark:text-amber-300">{needsTagging}</div>
            <div className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1">
              Stores not yet placed in a neighborhood
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Filter neighborhoods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          Showing {filtered.length} of {totalNeighborhoods}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Neighborhoods (by total stores)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="divide-y">
              {/* Header */}
              <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide bg-muted/40">
                <div className="col-span-4">Neighborhood</div>
                <div className="col-span-1 text-right">Total</div>
                <div className="col-span-1 text-right">Worked</div>
                <div className="col-span-1 text-right">Prospect</div>
                <div className="col-span-3">Coverage</div>
                <div className="col-span-2">Provenance</div>
              </div>

              {filtered.map((r) => {
                const isOpen = expanded === r.neighborhood;
                const pct = r.coverage_pct ?? 0;
                const trustLow = r.source_zip_lookup > r.source_verified;
                return (
                  <div key={r.neighborhood}>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : r.neighborhood)}
                      className="w-full grid grid-cols-12 gap-3 px-4 py-3 items-center text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="col-span-4 flex items-center gap-2 min-w-0">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium truncate">{r.neighborhood}</span>
                        {trustLow && (
                          <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700">
                            approx
                          </Badge>
                        )}
                      </div>
                      <div className="col-span-1 text-right font-semibold tabular-nums">{r.total_stores}</div>
                      <div className="col-span-1 text-right tabular-nums text-green-600">{r.worked_stores}</div>
                      <div className="col-span-1 text-right tabular-nums text-amber-600">{r.prospect_stores}</div>
                      <div className="col-span-3 flex items-center gap-2">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                      <div className="col-span-2 flex items-center gap-1 flex-wrap">
                        {r.source_verified > 0 && (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            {r.source_verified} v
                          </Badge>
                        )}
                        {r.source_zip_lookup > 0 && (
                          <Badge variant="outline" className="text-[10px]">
                            {r.source_zip_lookup} zip
                          </Badge>
                        )}
                        {r.source_other > 0 && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            {r.source_other} ?
                          </Badge>
                        )}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-12 py-4 bg-muted/20 border-t text-sm space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <div className="text-muted-foreground uppercase tracking-wide">Worked stores</div>
                            <div className="text-lg font-semibold text-green-600">{r.worked_stores}</div>
                            <div className="text-muted-foreground">Has at least one invoice</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground uppercase tracking-wide">Prospect stores</div>
                            <div className="text-lg font-semibold text-amber-600">{r.prospect_stores}</div>
                            <div className="text-muted-foreground">No orders yet — go speak with them</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground uppercase tracking-wide">Verified labels</div>
                            <div className="text-lg font-semibold">{r.source_verified}</div>
                            <div className="text-muted-foreground">Zip-confirmed</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground uppercase tracking-wide">Zip-derived</div>
                            <div className="text-lg font-semibold">{r.source_zip_lookup}</div>
                            <div className="text-muted-foreground">Backfilled from lookup</div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 flex-wrap">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/stores?neighborhood=${encodeURIComponent(r.neighborhood)}`}>
                              <Users className="h-3.5 w-3.5 mr-1" /> View stores (#13)
                            </Link>
                          </Button>
                          <CoverageSendToRouteBoard neighborhood={r.neighborhood} />
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleDispatchNeighborhood(r.neighborhood)}
                            disabled={isLoadingDispatch}
                          >
                            <RouteIcon className="h-3.5 w-3.5 mr-1" />
                            {isLoadingDispatch && dispatchNeighborhood === r.neighborhood ? 'Loading…' : `Dispatch ${r.neighborhood}`}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No neighborhoods match.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <RouteAssignmentDialog
        open={dispatchOpen}
        onOpenChange={(open) => {
          setDispatchOpen(open);
          if (!open) {
            setDispatchStoreIds([]);
            setDispatchNeighborhood('');
          }
        }}
        assigneeId=""
        assigneeName=""
        assigneeType="driver"
        assigneeUserId={null}
        bulkMode={dispatchStoreIds.length > 1}
        preselectedStores={dispatchStoreIds}
        prefilledTerritory={dispatchNeighborhood}
      />
    </div>
  );
}

// Coverage-gap funnel writer: loads prospect stores in the neighborhood on demand,
// then writes them to pending_route_stops via the universal RPC (Task 19b).
function CoverageSendToRouteBoard({ neighborhood }: { neighborhood: string }) {
  const [stores, setStores] = useState<Array<{ storeId: string; reason: string; priority: number }>>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('id')
        .is('deleted_at', null)
        .eq('approval_status', 'approved')
        .eq('neighborhood', neighborhood)
        .eq('status', 'prospect')
        .limit(500);
      if (error) throw error;
      const next = (data || []).map((s: any) => ({
        storeId: s.id,
        reason: `Coverage gap — prospect in ${neighborhood}`,
        priority: 3,
      }));
      setStores(next);
      if (next.length === 0) toast.warning(`No prospect stores in ${neighborhood}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load coverage gap stores');
    } finally {
      setLoading(false);
    }
  };

  if (stores.length === 0) {
    return (
      <Button size="sm" variant="outline" onClick={load} disabled={loading}>
        <RouteIcon className="h-3.5 w-3.5 mr-1" />
        {loading ? 'Loading…' : 'Send Coverage Gap to Route Board'}
      </Button>
    );
  }

  return (
    <SendToRouteBoardButton
      signalSource="coverage_gap"
      defaultReason={`Coverage gap — ${neighborhood}`}
      stores={stores}
      size="sm"
    />
  );
}
