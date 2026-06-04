import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, Target, MapPin, Clock, TrendingUp, Eye, ClipboardList } from 'lucide-react';
import { NeighborhoodScanButton } from '@/components/territory/NeighborhoodScanButton';

export default function TerritoryGapIntelligence() {
  const [planOpen, setPlanOpen] = useState(false);

  const { data: neighborhoods, isLoading: loadingKpis } = useQuery({
    queryKey: ['territory-gap-neighborhood-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_territory_neighborhood_kpis').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: domination, isLoading: loadingDom } = useQuery({
    queryKey: ['territory-gap-domination'],
    queryFn: async () => {
      const { data, error } = await supabase.from('v_territory_domination_score').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: staleCounts, isLoading: loadingStale } = useQuery({
    queryKey: ['territory-gap-stale'],
    queryFn: async () => {
      const now = new Date();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d60 = new Date(now.getTime() - 60 * 86400000).toISOString();
      const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();
      const [r30, r60, r90, total] = await Promise.all([
        supabase.from('territory_addresses').select('id', { count: 'exact', head: true }).not('last_checked_at', 'is', null).lt('last_checked_at', d30),
        supabase.from('territory_addresses').select('id', { count: 'exact', head: true }).not('last_checked_at', 'is', null).lt('last_checked_at', d60),
        supabase.from('territory_addresses').select('id', { count: 'exact', head: true }).not('last_checked_at', 'is', null).lt('last_checked_at', d90),
        supabase.from('territory_addresses').select('id', { count: 'exact', head: true }).is('last_checked_at', null),
      ]);
      return { stale30: r30.count || 0, stale60: r60.count || 0, stale90: r90.count || 0, neverChecked: total.count || 0 };
    },
  });

  const isLoading = loadingKpis || loadingDom || loadingStale;
  const totalAddresses = (neighborhoods || []).reduce((s: number, n: any) => s + (n.total_addresses || 0), 0);
  const totalUnknown = (neighborhoods || []).reduce((s: number, n: any) => s + (n.unknown_count || 0), 0);
  const coveragePct = totalAddresses > 0 ? Math.round(((totalAddresses - totalUnknown) / totalAddresses) * 100) : 0;
  const dominatedCount = (neighborhoods || []).filter((n: any) => n.domination_status === 'dominated').length;
  const totalNeighborhoods = (neighborhoods || []).length;
  const underTarget = (neighborhoods || []).filter((n: any) => n.target_store_count && n.verified_store_count < n.target_store_count);

  const sortedByGap = [...(neighborhoods || [])].sort(
    (a: any, b: any) => (Number(a.coverage_percentage) || 0) - (Number(b.coverage_percentage) || 0)
  );

  const rankedAreas = [...(domination || [])].sort(
    (a: any, b: any) => (Number(a.domination_score) || 0) - (Number(b.domination_score) || 0)
  );

  // Build execution plan preview from gap data
  const executionPlan = sortedByGap.slice(0, 10).map((n: any) => {
    const tasks: string[] = [];
    if ((n.unknown_count || 0) > 0) tasks.push(`Scout ${n.unknown_count} unknown addresses`);
    if ((n.candidate_count || 0) > 0) tasks.push(`Call ${n.candidate_count} candidates`);
    const gap = (n.target_store_count || 0) - (n.verified_store_count || 0);
    if (gap > 0) tasks.push(`Close ${gap}-store gap to target`);
    return { name: n.name, city: n.city, coverage: Number(n.coverage_percentage) || 0, tasks };
  }).filter(p => p.tasks.length > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Territory Gap Intelligence</h1>
          <p className="text-muted-foreground text-sm">
            Read-only awareness of coverage gaps, stale addresses, and priority areas.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPlanOpen(true)}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Create Execution Plan
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* KPI Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard icon={MapPin} label="Total Addresses" value={totalAddresses} color="text-primary" />
            <KpiCard icon={Target} label="Overall Coverage" value={`${coveragePct}%`} color="text-emerald-500" />
            <KpiCard icon={Eye} label="Unknown Addresses" value={totalUnknown} color="text-muted-foreground" />
            <KpiCard icon={TrendingUp} label="Dominated" value={`${dominatedCount}/${totalNeighborhoods}`} color="text-green-500" />
            <KpiCard icon={AlertTriangle} label="Under Target" value={underTarget.length} color="text-amber-500" />
            <KpiCard icon={Clock} label="Never Checked" value={staleCounts?.neverChecked || 0} color="text-destructive" />
          </div>

          {/* Stale Address Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Address Staleness
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StaleCard label="Never checked" count={staleCounts?.neverChecked || 0} severity="critical" />
                <StaleCard label="> 90 days" count={staleCounts?.stale90 || 0} severity="high" />
                <StaleCard label="> 60 days" count={staleCounts?.stale60 || 0} severity="medium" />
                <StaleCard label="> 30 days" count={staleCounts?.stale30 || 0} severity="low" />
              </div>
            </CardContent>
          </Card>

          {/* Coverage Gaps by Neighborhood */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Coverage Gaps by Neighborhood (Lowest First)</CardTitle></CardHeader>
            <CardContent>
              {sortedByGap.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 px-3">Neighborhood</th>
                        <th className="text-left py-2 px-3">City</th>
                        <th className="text-right py-2 px-3">Total</th>
                        <th className="text-right py-2 px-3">Unknown</th>
                        <th className="text-right py-2 px-3">Verified</th>
                        <th className="text-right py-2 px-3">Target</th>
                        <th className="py-2 px-3 w-36">Coverage</th>
                        <th className="text-center py-2 px-3">Status</th>
                        <th className="text-center py-2 px-3">Scan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedByGap.map((n: any) => {
                        const cov = Number(n.coverage_percentage) || 0;
                        const gap = (n.target_store_count || 0) - (n.verified_store_count || 0);
                        return (
                          <tr key={n.neighborhood_id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="py-2 px-3 font-medium">{n.name}</td>
                            <td className="py-2 px-3 text-muted-foreground">{n.city}, {n.state}</td>
                            <td className="py-2 px-3 text-right">{n.total_addresses}</td>
                            <td className="py-2 px-3 text-right text-muted-foreground">{n.unknown_count}</td>
                            <td className="py-2 px-3 text-right text-green-500">{n.verified_store_count}</td>
                            <td className="py-2 px-3 text-right">
                              {n.target_store_count ? (
                                <span className={gap > 0 ? 'text-amber-500' : 'text-green-500'}>
                                  {n.target_store_count} {gap > 0 && <span className="text-xs">(-{gap})</span>}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <Progress value={cov} className="h-2 flex-1" />
                                <span className="text-xs w-10 text-right">{cov}%</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <DominationBadge status={n.domination_status} />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <NeighborhoodScanButton
                                neighborhoodId={n.neighborhood_id}
                                neighborhoodName={n.name}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No neighborhoods defined yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Next Best Area */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Next Best Area — Ranked by Opportunity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rankedAreas.length > 0 ? (
                <div className="space-y-3">
                  {rankedAreas.map((area: any, idx: number) => (
                    <div key={area.neighborhood_id} className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-muted/30">
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm">{idx + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{area.name}</p>
                        <p className="text-xs text-muted-foreground">{area.city}, {area.state}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{Number(area.domination_score || 0).toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">domination</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{area.missing_addresses_count || 0}</p>
                        <p className="text-xs text-muted-foreground">missing</p>
                      </div>
                      <div className="text-right min-w-[120px]">
                        <p className="text-xs text-muted-foreground">{area.next_recommended_action || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No domination data available yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Execution Plan Preview Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Execution Plan Preview
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This is a <strong>read-only preview</strong> of recommended tasks based on current gaps. No tasks are created until you use "Generate Tasks" from the Control Center.
          </p>
          {executionPlan.length > 0 ? (
            <div className="space-y-4 mt-4">
              {executionPlan.map((plan, i) => (
                <div key={i} className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{plan.name}</p>
                    <Badge variant="outline">{plan.coverage}% coverage</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.city}</p>
                  <ul className="space-y-1">
                    {plan.tasks.map((t, j) => (
                      <li key={j} className="text-sm flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No actionable gaps detected.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StaleCard({ label, count, severity }: { label: string; count: number; severity: 'low' | 'medium' | 'high' | 'critical' }) {
  const colors = { low: 'border-amber-500/30 bg-amber-500/5', medium: 'border-amber-500/50 bg-amber-500/10', high: 'border-orange-500/50 bg-orange-500/10', critical: 'border-destructive/50 bg-destructive/10' };
  const textColors = { low: 'text-amber-500', medium: 'text-amber-600', high: 'text-orange-500', critical: 'text-destructive' };
  return (
    <div className={`rounded-lg border p-4 ${colors[severity]}`}>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${textColors[severity]}`}>{count}</p>
    </div>
  );
}

function DominationBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; label: string }> = {
    dominated: { bg: 'bg-green-500', label: 'Dominated' },
    in_progress: { bg: 'bg-amber-500', label: 'In Progress' },
    untouched: { bg: 'bg-muted-foreground', label: 'Untouched' },
  };
  const c = config[status] || { bg: 'bg-muted-foreground', label: status };
  return <Badge className={`${c.bg} text-white text-xs`}>{c.label}</Badge>;
}
