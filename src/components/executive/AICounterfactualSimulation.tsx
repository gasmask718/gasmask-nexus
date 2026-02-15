// ═══════════════════════════════════════════════════════════════════════════════
// AI COUNTERFACTUAL SIMULATION — Phase 11: Read-Only Hypothetical Analysis
// ═══════════════════════════════════════════════════════════════════════════════
// Simulates single-variable "what if" scenarios for past AI dispatch decisions.
// No writes. No automation. No feedback loops. No recommendations.
// Fully removable without side effects.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  AlertTriangle,
  ChevronDown,
  FlaskConical,
  GitBranch,
  Loader2,
  HelpCircle,
  BarChart3,
  Target,
} from 'lucide-react';
import {
  useCounterfactualSimulation,
  type CounterfactualCase,
  type CounterfactualScenario,
  type Likelihood,
  type ExpectedOutcome,
} from '@/hooks/useCounterfactualSimulation';

// ─── Sub-components ──────────────────────────────────────────────────────────

function GovernanceBanner() {
  return (
    <div className="bg-muted/60 border border-border rounded-lg px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Counterfactual simulation — hypothetical analysis only.</span>{' '}
        No system behavior is modified. Results are explanatory, not prescriptive.
        No learning hooks. No automation.
      </div>
    </div>
  );
}

function LikelihoodBadge({ likelihood }: { likelihood: Likelihood }) {
  const variants: Record<Likelihood, { className: string; label: string }> = {
    high: { className: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30', label: 'High' },
    medium: { className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30', label: 'Medium' },
    low: { className: 'bg-muted text-muted-foreground border-border', label: 'Low' },
  };
  const v = variants[likelihood];
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function OutcomeBadge({ outcome }: { outcome: ExpectedOutcome }) {
  const map: Record<ExpectedOutcome, { className: string; label: string }> = {
    on_time_delivery: { className: 'bg-green-500/15 text-green-700 dark:text-green-400', label: 'On-Time' },
    reduced_delay: { className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', label: 'Reduced Delay' },
    no_change: { className: 'bg-muted text-muted-foreground', label: 'No Change' },
    worse_outcome: { className: 'bg-red-500/15 text-red-700 dark:text-red-400', label: 'Worse' },
  };
  const v = map[outcome];
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function ScenarioCard({ scenario }: { scenario: CounterfactualScenario }) {
  return (
    <div className="border border-border rounded-md p-3 space-y-2 bg-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{scenario.scenario_label}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <OutcomeBadge outcome={scenario.expected_outcome} />
          <LikelihoodBadge likelihood={scenario.likelihood} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">Original:</span>
          <p className="mt-0.5">{scenario.original_state}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Simulated:</span>
          <p className="mt-0.5">{scenario.simulated_state}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground italic">{scenario.rationale}</p>
    </div>
  );
}

function CaseRow({ caseData }: { caseData: CounterfactualCase }) {
  const [open, setOpen] = useState(false);
  const bestScenario = caseData.scenarios.reduce((best, s) => {
    const order: Record<Likelihood, number> = { high: 3, medium: 2, low: 1 };
    return order[s.likelihood] > order[best.likelihood] ? s : best;
  }, caseData.scenarios[0]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-medium">{caseData.store_name || caseData.store_id.slice(0, 8)}</TableCell>
          <TableCell>
            <span className="text-sm">
              {caseData.confidence_corrected
                ? `${caseData.confidence_displayed}% (adj)`
                : `${caseData.confidence_raw}%`}
            </span>
          </TableCell>
          <TableCell>
            <Badge variant="outline" className="capitalize text-xs">{caseData.human_action}</Badge>
          </TableCell>
          <TableCell className="text-sm">{caseData.breach_type?.replace('_', ' ') || '—'}</TableCell>
          <TableCell>{caseData.scenarios.length}</TableCell>
          <TableCell>
            <OutcomeBadge outcome={bestScenario.expected_outcome} />
          </TableCell>
          <TableCell>
            <LikelihoodBadge likelihood={bestScenario.likelihood} />
          </TableCell>
          <TableCell>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent asChild>
        <tr>
          <td colSpan={8} className="p-0">
            <div className="p-4 bg-muted/30 space-y-3 border-t border-border">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Decision Latency:</span>
                  <p>{caseData.decision_latency_seconds ? `${Math.round(caseData.decision_latency_seconds / 60)}min` : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Route Assignment Lag:</span>
                  <p>{caseData.route_assignment_lag_hours ? `${caseData.route_assignment_lag_hours.toFixed(1)}h` : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Arrival Delay:</span>
                  <p>{caseData.arrival_delay_hours ? `${caseData.arrival_delay_hours.toFixed(1)}h` : '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Counterfactual Scenarios</p>
                {caseData.scenarios.map((s, i) => (
                  <ScenarioCard key={i} scenario={s} />
                ))}
              </div>
            </div>
          </td>
        </tr>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AICounterfactualSimulation() {
  const { analysis, isLoading } = useCounterfactualSimulation();
  const [activeTab, setActiveTab] = useState('cases');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analysis || analysis.totalCases === 0) {
    return (
      <div className="space-y-4">
        <GovernanceBanner />
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No breach cases available for counterfactual analysis</p>
            <p className="text-sm text-muted-foreground mt-1">
              Counterfactuals are generated from SLA breach events in ai_dispatch_feedback
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { kpis, aggregates, byConfidenceBand } = analysis;

  return (
    <div className="space-y-6">
      <GovernanceBanner />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Breaches Analyzed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{kpis.totalBreachesAnalyzed}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-green-500" />
              Likely Preventable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {kpis.likelyPreventablePercent}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">of breaches with at least one scenario</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Top Leverage Point
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{kpis.topLeveragePoint}</p>
            <p className="text-xs text-muted-foreground mt-1">most frequently impactful variable</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Indeterminate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-muted-foreground">{kpis.indeterminatePercent}%</p>
            <p className="text-xs text-muted-foreground mt-1">no clear leverage identified</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cases">Breach Cases</TabsTrigger>
          <TabsTrigger value="leverage">Leverage Points</TabsTrigger>
          <TabsTrigger value="sensitivity">Confidence Sensitivity</TabsTrigger>
        </TabsList>

        {/* Cases Tab */}
        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Counterfactual Case Analysis</CardTitle>
              <CardDescription>
                Each breach case includes up to 3 single-variable hypothetical scenarios. Expand rows to view.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Store</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Breach Type</TableHead>
                    <TableHead>Scenarios</TableHead>
                    <TableHead>Best Outcome</TableHead>
                    <TableHead>Likelihood</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.cases.slice(0, 50).map((c, i) => (
                    <CaseRow key={i} caseData={c} />
                  ))}
                </TableBody>
              </Table>
              {analysis.cases.length > 50 && (
                <p className="text-xs text-muted-foreground text-center mt-3">
                  Showing 50 of {analysis.cases.length} cases
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Leverage Points Tab */}
        <TabsContent value="leverage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Leverage Point Analysis</CardTitle>
              <CardDescription>
                Aggregate view of which single-variable changes most frequently could have altered outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variable</TableHead>
                    <TableHead className="text-right">Total Scenarios</TableHead>
                    <TableHead className="text-right">Likely Preventable</TableHead>
                    <TableHead className="text-right">Likely Unchanged</TableHead>
                    <TableHead className="text-right">Indeterminate</TableHead>
                    <TableHead className="text-right">Preventable %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aggregates.map(a => (
                    <TableRow key={a.variable}>
                      <TableCell className="font-medium">{a.label}</TableCell>
                      <TableCell className="text-right">{a.total}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                        {a.likelyPreventable}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.likelyUnchanged}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{a.indeterminate}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={
                            a.preventablePercent > 50
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                              : a.preventablePercent > 25
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {a.preventablePercent}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Confidence Sensitivity Tab */}
        <TabsContent value="sensitivity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Confidence Band Sensitivity</CardTitle>
              <CardDescription>
                Which confidence bands show the highest counterfactual sensitivity — where small changes most often could have altered outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confidence Band</TableHead>
                    <TableHead className="text-right">Total Breaches</TableHead>
                    <TableHead className="text-right">Likely Preventable</TableHead>
                    <TableHead className="text-right">Sensitivity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byConfidenceBand.map(b => (
                    <TableRow key={b.range}>
                      <TableCell className="font-medium">{b.range}%</TableCell>
                      <TableCell className="text-right">{b.total}</TableCell>
                      <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                        {b.preventable}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.total > 0 ? (
                          <Badge
                            variant="outline"
                            className={
                              b.sensitivity > 60
                                ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                                : b.sensitivity > 30
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                : 'bg-muted text-muted-foreground'
                            }
                          >
                            {b.sensitivity}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
