/**
 * CROSS-OFFICE SUPERVISOR COMPARISON PAGE
 * Admin-only view for comparing supervisor performance across all offices.
 */

import { useSupervisorScorecards, useSupervisorSnapshots, type SupervisorTier } from '@/hooks/useSupervisorPerformance';
import { useProductionOffices } from '@/hooks/useProductionPortal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Award, TrendingUp, Medal, ArrowUpDown, Shield, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type SortKey = 'composite_index' | 'goal_completion_rate' | 'avg_boxes_per_worker';

function getScoreColor(score: number): string {
  if (score >= 95) return 'text-emerald-600';
  if (score >= 85) return 'text-amber-600';
  return 'text-red-600';
}

export default function SupervisorComparisonPage() {
  const { data: scorecards = [], isLoading } = useSupervisorScorecards();
  const { data: offices = [] } = useProductionOffices();
  const { data: snapshots = [] } = useSupervisorSnapshots();
  const [sortKey, setSortKey] = useState<SortKey>('composite_index');

  const officeMap = useMemo(() => {
    const m = new Map<string, string>();
    offices.forEach(o => m.set(o.id, o.name));
    return m;
  }, [offices]);

  const sorted = useMemo(() => {
    return [...scorecards].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return (bv as number) - (av as number);
    });
  }, [scorecards, sortKey]);

  // Determine top performer and most improved
  const topPerformer = sorted[0];
  const mostImproved = useMemo(() => {
    let best: { id: string; improvement: number } | null = null;
    scorecards.forEach(sc => {
      const prev = snapshots.find(
        s => s.supervisor_user_id === sc.supervisor_user_id && s.office_id === sc.office_id
      );
      if (prev) {
        const improvement = sc.composite_index - prev.composite_index;
        if (!best || improvement > best.improvement) {
          best = { id: `${sc.office_id}-${sc.supervisor_user_id}`, improvement };
        }
      }
    });
    return best;
  }, [scorecards, snapshots]);

  const SortButton = ({ label, field }: { label: string; field: SortKey }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground"
      onClick={() => setSortKey(field)}
    >
      {label}
      {sortKey === field && <ArrowUpDown className="h-3 w-3 ml-1" />}
    </Button>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6" />
            Supervisor Comparison — All Offices
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rolling 30-day performance. Display only — no incentive impact.
          </p>
        </div>
        <Badge variant="outline">Performance v1</Badge>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>
      ) : !sorted.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No supervisor data available yet.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Office</TableHead>
                  <TableHead>Supervisor</TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Index" field="composite_index" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Goal %" field="goal_completion_rate" />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton label="Boxes/Worker" field="avg_boxes_per_worker" />
                  </TableHead>
                  <TableHead className="text-right">Reopen %</TableHead>
                  <TableHead className="text-right">Material Δ</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Stability σ</TableHead>
                  <TableHead>Badges</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((sc, i) => {
                  const key = `${sc.office_id}-${sc.supervisor_user_id}`;
                  const isTop = topPerformer && sc === topPerformer;
                  const isImproved = mostImproved && key === mostImproved.id && mostImproved.improvement > 0;

                  return (
                    <TableRow key={`${key}-${i}`}>
                      <TableCell className="font-medium">
                        {officeMap.get(sc.office_id) || sc.office_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        {sc.supervisor_name || sc.supervisor_user_id?.slice(0, 8) || '—'}
                      </TableCell>
                      <TableCell className={cn('text-right font-bold', getScoreColor(sc.composite_index))}>
                        {sc.composite_index}
                      </TableCell>
                      <TableCell className="text-right">{(sc.goal_completion_rate || 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{(sc.avg_boxes_per_worker || 0).toFixed(1)}</TableCell>
                      <TableCell className="text-right">{(sc.reopen_rate || 0).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">
                        {((sc.material_efficiency_delta || 0) * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />{sc.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {sc.stability_score !== null ? sc.stability_score : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {isTop && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">
                              <Medal className="h-3 w-3 mr-1" />Top
                            </Badge>
                          )}
                          {isImproved && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
                              <TrendingUp className="h-3 w-3 mr-1" />Improved
                            </Badge>
                          )}
                          {sc.expansion_ready && (
                            <Badge className="bg-violet-100 text-violet-800 border-violet-200 text-xs">
                              <Rocket className="h-3 w-3 mr-1" />Expansion Ready
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
