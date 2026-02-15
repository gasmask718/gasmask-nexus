// ═══════════════════════════════════════════════════════════════════════════════
// AI SLA BREACH POST-MORTEMS — Phase 10: Read-Only Forensic Analysis
// ═══════════════════════════════════════════════════════════════════════════════
// Narrative timelines explaining WHY SLAs failed.
// No automation. No writes. No learning hooks. Fully removable.

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Activity,
  MapPin,
  FileWarning,
  TrendingDown,
} from 'lucide-react';
import { useSlaBreachPostMortems, SlaPostMortem } from '@/hooks/useSlaBreachPostMortems';

// ─── Filter State ───────────────────────────────────────────────────────────

interface Filters {
  confidenceBand: string;
  slaSeverity: string;
  humanAction: string;
  territory: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function BreachCaseRow({ pm }: { pm: SlaPostMortem }) {
  const [open, setOpen] = useState(false);

  const breachBadgeColor: Record<string, string> = {
    late_arrival: 'bg-amber-500/15 text-amber-600 border-amber-300',
    missed_visit: 'bg-red-500/15 text-red-600 border-red-300',
    capacity_delay: 'bg-orange-500/15 text-orange-600 border-orange-300',
    unknown: 'bg-muted text-muted-foreground',
  };

  const causeLabel: Record<string, string> = {
    routing: 'Routing',
    capacity: 'Capacity',
    store_closed: 'Store Closed',
    human_delay: 'Human Delay',
    external: 'External',
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </TableCell>
          <TableCell className="font-medium">{pm.store_name || pm.store_id.slice(0, 8)}</TableCell>
          <TableCell>
            <Badge variant="outline" className={breachBadgeColor[pm.breach_analysis.breach_type]}>
              {pm.breach_analysis.breach_type.replace('_', ' ')}
            </Badge>
          </TableCell>
          <TableCell>{pm.ai_context.confidence_raw}%</TableCell>
          <TableCell>
            <Badge variant="outline" className="capitalize">{pm.ai_context.human_action}</Badge>
          </TableCell>
          <TableCell>{causeLabel[pm.breach_analysis.primary_cause]}</TableCell>
          <TableCell>
            {pm.delta_analysis.expected_vs_actual_hours !== null
              ? `+${pm.delta_analysis.expected_vs_actual_hours}h`
              : '—'}
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <tr>
          <td colSpan={7} className="p-0">
            <div className="px-6 py-4 bg-muted/30 border-b space-y-4">
              {/* Narrative */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Narrative</p>
                <p className="text-sm leading-relaxed">{pm.narrative}</p>
              </div>

              {/* Timeline */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Decision</p>
                  <p className="text-sm font-mono">{formatTime(pm.actual_timeline.decision_time)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Route Assigned</p>
                  <p className="text-sm font-mono">{formatTime(pm.actual_timeline.route_assigned_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Arrival</p>
                  <p className="text-sm font-mono">{formatTime(pm.actual_timeline.arrival_time)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delivery Completed</p>
                  <p className="text-sm font-mono">{formatTime(pm.actual_timeline.delivery_completed_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Order Placed</p>
                  <p className="text-sm font-mono">{formatTime(pm.actual_timeline.order_placed_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Follow-up Created</p>
                  <p className="text-sm font-mono">{formatTime(pm.actual_timeline.follow_up_created_at)}</p>
                </div>
              </div>

              {/* Contributing Factors */}
              {pm.breach_analysis.contributing_factors.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contributing Factors</p>
                  <div className="flex flex-wrap gap-1">
                    {pm.breach_analysis.contributing_factors.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Break Point */}
              <div className="flex gap-4 text-sm">
                <span className="text-muted-foreground">Break point:</span>
                <Badge variant="secondary" className="capitalize">
                  {pm.delta_analysis.where_it_broke.replace(/_/g, ' ')}
                </Badge>
                {pm.ai_context.confidence_corrected && (
                  <span className="text-muted-foreground">
                    Displayed: {pm.ai_context.confidence_displayed}% (corrected)
                  </span>
                )}
              </div>
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AISLABreachPostMortems() {
  const { analysis, isLoading } = useSlaBreachPostMortems();
  const [activeTab, setActiveTab] = useState('cases');
  const [filters, setFilters] = useState<Filters>({
    confidenceBand: 'all',
    slaSeverity: 'all',
    humanAction: 'all',
    territory: 'all',
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Loading breach post-mortem analysis…</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No data available for post-mortem analysis.</p>
        </CardContent>
      </Card>
    );
  }

  // Apply filters
  const filteredCases = analysis.cases.filter(c => {
    if (filters.confidenceBand !== 'all') {
      const [min, max] = filters.confidenceBand.split('-').map(Number);
      if (c.ai_context.confidence_raw < min || c.ai_context.confidence_raw > max) return false;
    }
    if (filters.slaSeverity !== 'all' && (c.expectation.sla_severity || 'Unknown') !== filters.slaSeverity) return false;
    if (filters.humanAction !== 'all' && c.ai_context.human_action !== filters.humanAction) return false;
    return true;
  });

  // Unique values for filters
  const slaSeverities = [...new Set(analysis.cases.map(c => c.expectation.sla_severity || 'Unknown'))];

  return (
    <div className="space-y-6">
      {/* Governance Banner */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-blue-500 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Read-only forensic analysis.</strong> No automation. No system changes.
              This phase explains breach patterns — it does not prescribe or execute corrective actions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Breaches Analyzed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{analysis.kpis.totalAnalyzed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>High-Confidence Breaches</CardDescription>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-3xl font-bold text-destructive">
                    {analysis.kpis.highConfidenceBreachPercent}%
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Breaches where AI confidence was ≥70%</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg Delay</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {analysis.kpis.avgDelayHours > 0 ? `+${analysis.kpis.avgDelayHours}h` : '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Root Cause</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{analysis.kpis.topRootCause}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="cases" className="flex items-center gap-1">
            <FileWarning className="h-4 w-4" />
            Breach Cases ({filteredCases.length})
          </TabsTrigger>
          <TabsTrigger value="root-causes" className="flex items-center gap-1">
            <TrendingDown className="h-4 w-4" />
            Root Causes
          </TabsTrigger>
          <TabsTrigger value="confidence" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            By Confidence
          </TabsTrigger>
          <TabsTrigger value="false-trust" className="flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            False Trust ({analysis.falseTrustSignals.length})
          </TabsTrigger>
          <TabsTrigger value="context" className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            Contextual
          </TabsTrigger>
        </TabsList>

        {/* ─── Breach Cases Tab ─── */}
        <TabsContent value="cases" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="py-3">
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-sm text-muted-foreground font-medium">View filters:</span>
                <Select value={filters.confidenceBand} onValueChange={v => setFilters(f => ({ ...f, confidenceBand: v }))}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="Confidence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bands</SelectItem>
                    <SelectItem value="0-30">0–30%</SelectItem>
                    <SelectItem value="31-50">31–50%</SelectItem>
                    <SelectItem value="51-65">51–65%</SelectItem>
                    <SelectItem value="66-75">66–75%</SelectItem>
                    <SelectItem value="76-85">76–85%</SelectItem>
                    <SelectItem value="86-100">86–100%</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filters.slaSeverity} onValueChange={v => setFilters(f => ({ ...f, slaSeverity: v }))}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="SLA Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    {slaSeverities.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.humanAction} onValueChange={v => setFilters(f => ({ ...f, humanAction: v }))}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="applied">Applied</SelectItem>
                    <SelectItem value="dismissed">Dismissed</SelectItem>
                    <SelectItem value="ignored">Ignored</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cases Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Store</TableHead>
                  <TableHead>Breach Type</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Root Cause</TableHead>
                  <TableHead>Delay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No breach cases match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCases.slice(0, 50).map((pm, i) => (
                    <BreachCaseRow key={`${pm.store_id}-${pm.created_at}-${i}`} pm={pm} />
                  ))
                )}
              </TableBody>
            </Table>
            {filteredCases.length > 50 && (
              <CardContent className="py-2 text-center text-sm text-muted-foreground">
                Showing 50 of {filteredCases.length} cases
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* ─── Root Causes Tab ─── */}
        <TabsContent value="root-causes">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Root Cause Breakdown</CardTitle>
              <CardDescription>Aggregate distribution of breach causes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cause</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.rootCauses.map(rc => (
                    <TableRow key={rc.cause}>
                      <TableCell className="font-medium">{rc.label}</TableCell>
                      <TableCell className="text-right">{rc.count}</TableCell>
                      <TableCell className="text-right">{rc.percentage}%</TableCell>
                    </TableRow>
                  ))}
                  {analysis.rootCauses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No root cause data available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Delay Stats */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-lg">Expectation vs Reality Gap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Average Delay</p>
                  <p className="text-2xl font-bold">{analysis.delayStats.avgHours}h</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Median Delay</p>
                  <p className="text-2xl font-bold">{analysis.delayStats.medianHours}h</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Worst 10% (P90)</p>
                  <p className="text-2xl font-bold text-destructive">{analysis.delayStats.p90Hours}h</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── By Confidence Tab ─── */}
        <TabsContent value="confidence">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Breaches by Confidence Band</CardTitle>
              <CardDescription>How breach distribution maps to AI certainty</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confidence Band</TableHead>
                    <TableHead className="text-right">Total Breaches</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    <TableHead className="text-right">Dismissed</TableHead>
                    <TableHead className="text-right">Avg Delay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.byConfidenceBand.map(band => (
                    <TableRow key={band.range}>
                      <TableCell className="font-mono">{band.range}%</TableCell>
                      <TableCell className="text-right">{band.total}</TableCell>
                      <TableCell className="text-right">{band.applied}</TableCell>
                      <TableCell className="text-right">{band.dismissed}</TableCell>
                      <TableCell className="text-right">
                        {band.avgDelayHours > 0 ? `+${band.avgDelayHours}h` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── False Trust Tab ─── */}
        <TabsContent value="false-trust">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                High-Confidence Execution Failures
              </CardTitle>
              <CardDescription>
                Cases where confidence was ≥70%, the human applied the suggestion, but the SLA was still breached.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.falseTrustSignals.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No false trust signals detected — high-confidence applied suggestions did not breach SLAs.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Breach Type</TableHead>
                      <TableHead>Root Cause</TableHead>
                      <TableHead>Delay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.falseTrustSignals.slice(0, 30).map((pm, i) => (
                      <TableRow key={`ft-${pm.store_id}-${i}`}>
                        <TableCell className="font-medium">
                          {pm.store_name || pm.store_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">{pm.ai_context.confidence_raw}%</span>
                          {pm.ai_context.confidence_corrected && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (disp: {pm.ai_context.confidence_displayed}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {pm.breach_analysis.breach_type.replace('_', ' ')}
                        </TableCell>
                        <TableCell>
                          {({
                            routing: 'Routing',
                            capacity: 'Capacity',
                            store_closed: 'Store Closed',
                            human_delay: 'Human Delay',
                            external: 'External',
                          } as Record<string, string>)[pm.breach_analysis.primary_cause]}
                        </TableCell>
                        <TableCell>
                          {pm.delta_analysis.expected_vs_actual_hours !== null
                            ? `+${pm.delta_analysis.expected_vs_actual_hours}h`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Contextual Tab ─── */}
        <TabsContent value="context" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By SLA Severity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By SLA Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead className="text-right">Breaches</TableHead>
                      <TableHead className="text-right">Avg Delay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.bySlaSeverity.map(s => (
                      <TableRow key={s.label}>
                        <TableCell className="font-medium capitalize">{s.label}</TableCell>
                        <TableCell className="text-right">{s.count}</TableCell>
                        <TableCell className="text-right">
                          {s.avgDelay > 0 ? `+${s.avgDelay}h` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* By Human Action */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">By Human Action</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead className="text-right">Breaches</TableHead>
                      <TableHead className="text-right">Avg Delay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.byHumanAction.map(a => (
                      <TableRow key={a.label}>
                        <TableCell className="font-medium capitalize">{a.label}</TableCell>
                        <TableCell className="text-right">{a.count}</TableCell>
                        <TableCell className="text-right">
                          {a.avgDelay > 0 ? `+${a.avgDelay}h` : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* By Territory */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">By Territory</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Territory</TableHead>
                    <TableHead className="text-right">Breaches</TableHead>
                    <TableHead className="text-right">Avg Delay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.byTerritory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                        No territory data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    analysis.byTerritory.map(t => (
                      <TableRow key={t.label}>
                        <TableCell className="font-medium">{t.label}</TableCell>
                        <TableCell className="text-right">{t.count}</TableCell>
                        <TableCell className="text-right">
                          {t.avgDelay > 0 ? `+${t.avgDelay}h` : '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
