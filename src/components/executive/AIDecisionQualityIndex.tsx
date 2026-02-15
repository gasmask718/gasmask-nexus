// ═══════════════════════════════════════════════════════════════════════════════
// DECISION QUALITY INDEX — Phase 12: Executive Scoring (Read-Only)
// ═══════════════════════════════════════════════════════════════════════════════
// Evaluates AI–Human decision quality across 5 dimensions without judging
// outcomes alone. Decision quality ≠ outcome quality.
// No writes. No recommendations. No automation. No feedback loops.

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Shield, ChevronDown, BarChart3, Brain, Clock, Layers, Target } from 'lucide-react';
import { useDecisionQualityIndex, type DQIGrade, type DecisionQualityAssessment } from '@/hooks/useDecisionQualityIndex';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColor(grade: DQIGrade): string {
  switch (grade) {
    case 'Excellent': return 'text-emerald-400';
    case 'Good': return 'text-blue-400';
    case 'Mixed': return 'text-amber-400';
    case 'Poor': return 'text-red-400';
  }
}

function gradeBadgeVariant(grade: DQIGrade): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (grade) {
    case 'Excellent': return 'default';
    case 'Good': return 'secondary';
    case 'Mixed': return 'outline';
    case 'Poor': return 'destructive';
  }
}

function dqiColor(dqi: number): string {
  if (dqi >= 90) return 'text-emerald-400';
  if (dqi >= 75) return 'text-blue-400';
  if (dqi >= 55) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AIDecisionQualityIndex() {
  const { analysis, isLoading } = useDecisionQualityIndex();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!analysis || analysis.totalAssessed === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground font-medium">No decisions to evaluate</p>
          <p className="text-sm text-muted-foreground mt-1">
            DQI scores will appear once AI dispatch feedback is available.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Governance Banner ─── */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-primary">Decision Quality Index — Evaluative Lens Only</p>
              <p className="text-muted-foreground">
                This is not a performance score. It does not drive automation, discipline, or system behavior.
                Decision quality is evaluated independently of outcome quality.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average DQI</p>
            <p className={`text-3xl font-bold ${dqiColor(analysis.kpis.avgDqi)}`}>
              {analysis.kpis.avgDqi}
            </p>
            <p className="text-xs text-muted-foreground mt-1">out of 100</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Excellent Decisions</p>
            <p className="text-3xl font-bold text-emerald-400">
              {analysis.kpis.excellentPercent}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">DQI ≥ 90</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Execution-Driven Outcomes</p>
            <p className="text-3xl font-bold text-blue-400">
              {analysis.kpis.poorOutcomeFromExecution}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">outcomes from execution, not decision</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Avg Timeliness</p>
            <p className="text-3xl font-bold">
              {analysis.kpis.avgTimelinessScore}
            </p>
            <p className="text-xs text-muted-foreground mt-1">out of 20</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Assessed</p>
            <p className="text-3xl font-bold">{analysis.kpis.totalAssessed}</p>
            <p className="text-xs text-muted-foreground mt-1">decisions evaluated</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Tabs ─── */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="dimensions" className="flex items-center gap-1">
            <Layers className="h-4 w-4" />
            Dimensions
          </TabsTrigger>
          <TabsTrigger value="cases" className="flex items-center gap-1">
            <Target className="h-4 w-4" />
            Cases
          </TabsTrigger>
          <TabsTrigger value="context" className="flex items-center gap-1">
            <Brain className="h-4 w-4" />
            Context
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grade Distribution</CardTitle>
              <CardDescription>Assessment of decision quality across all evaluated cases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {analysis.gradeDistribution.map(g => (
                  <div key={g.grade} className="text-center p-4 rounded-lg bg-muted/30">
                    <p className={`text-2xl font-bold ${gradeColor(g.grade)}`}>{g.count}</p>
                    <Badge variant={gradeBadgeVariant(g.grade)} className="mt-1">{g.grade}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{g.percent}%</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* DQI by Confidence Band */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">DQI by Confidence Band</CardTitle>
              <CardDescription>How decision quality varies across AI confidence levels</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Cases</TableHead>
                    <TableHead className="text-right">Avg DQI</TableHead>
                    <TableHead className="text-right">Excellent</TableHead>
                    <TableHead className="text-right">Good</TableHead>
                    <TableHead className="text-right">Mixed</TableHead>
                    <TableHead className="text-right">Poor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.byConfidenceBand.map(band => (
                    <TableRow key={band.range}>
                      <TableCell className="font-medium">{band.range}%</TableCell>
                      <TableCell className="text-right">{band.count}</TableCell>
                      <TableCell className={`text-right font-semibold ${dqiColor(band.avgDqi)}`}>
                        {band.avgDqi}
                      </TableCell>
                      <TableCell className="text-right text-emerald-400">{band.excellent}</TableCell>
                      <TableCell className="text-right text-blue-400">{band.good}</TableCell>
                      <TableCell className="text-right text-amber-400">{band.mixed}</TableCell>
                      <TableCell className="text-right text-red-400">{band.poor}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Dimensions Tab ── */}
        <TabsContent value="dimensions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dimension Averages</CardTitle>
              <CardDescription>
                Five weighted dimensions scored independently to separate decision quality from outcome quality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {analysis.dimensionAverages.map(dim => (
                <div key={dim.dimension} className="space-y-2">
                  <div className="flex justify-between items-baseline">
                    <div className="flex items-center gap-2">
                      {dim.dimension === 'information_alignment' && <Brain className="h-4 w-4 text-primary" />}
                      {dim.dimension === 'timeliness' && <Clock className="h-4 w-4 text-primary" />}
                      {dim.dimension === 'judgment' && <Target className="h-4 w-4 text-primary" />}
                      {dim.dimension === 'execution_separation' && <Layers className="h-4 w-4 text-primary" />}
                      {dim.dimension === 'outcome_consistency' && <BarChart3 className="h-4 w-4 text-primary" />}
                      <span className="font-medium">{dim.label}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {dim.avgScore} / {dim.maxScore} ({dim.avgPercent}%)
                    </span>
                  </div>
                  <Progress value={dim.avgPercent} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Dimension Explanations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dimension Definitions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Information Alignment (0–25)</p>
                <p className="text-muted-foreground">Was the decision aligned with available signals at the time?</p>
              </div>
              <div>
                <p className="font-medium">Timeliness (0–20)</p>
                <p className="text-muted-foreground">Was the decision made within a reasonable time window given urgency?</p>
              </div>
              <div>
                <p className="font-medium">Judgment (0–20)</p>
                <p className="text-muted-foreground">Did the human action make sense given uncertainty? Rewards reasonable caution.</p>
              </div>
              <div>
                <p className="font-medium">Execution Separation (0–15)</p>
                <p className="text-muted-foreground">Was outcome failure due to execution rather than the decision itself?</p>
              </div>
              <div>
                <p className="font-medium">Outcome Consistency (0–20)</p>
                <p className="text-muted-foreground">Did reality broadly align with expectations? Not outcome scoring — expectation coherence.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cases Tab ── */}
        <TabsContent value="cases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Individual Assessments</CardTitle>
              <CardDescription>
                Expand each case for dimension breakdown and summary
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {analysis.assessments.slice(0, 50).map((a, idx) => (
                <CaseRow key={`${a.store_id}-${idx}`} assessment={a} />
              ))}
              {analysis.assessments.length > 50 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Showing 50 of {analysis.assessments.length} assessments
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Context Tab ── */}
        <TabsContent value="context" className="space-y-4">
          {/* By Human Action */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">DQI by Human Action</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Avg DQI</TableHead>
                    <TableHead className="text-right">Avg Grade</TableHead>
                    <TableHead className="text-right">Execution %</TableHead>
                    <TableHead className="text-right">Decision %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.byHumanAction.map(slice => (
                    <TableRow key={slice.label}>
                      <TableCell className="font-medium">{slice.label}</TableCell>
                      <TableCell className="text-right">{slice.count}</TableCell>
                      <TableCell className={`text-right font-semibold ${dqiColor(slice.avgDqi)}`}>
                        {slice.avgDqi}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={gradeBadgeVariant(slice.avgGrade)}>{slice.avgGrade}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{slice.executionFailurePercent}%</TableCell>
                      <TableCell className="text-right">{slice.decisionFailurePercent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* By SLA Severity */}
          {analysis.bySlaSeverity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">DQI by SLA Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SLA</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Avg DQI</TableHead>
                      <TableHead className="text-right">Avg Grade</TableHead>
                      <TableHead className="text-right">Execution %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.bySlaSeverity.map(slice => (
                      <TableRow key={slice.label}>
                        <TableCell className="font-medium capitalize">{slice.label}</TableCell>
                        <TableCell className="text-right">{slice.count}</TableCell>
                        <TableCell className={`text-right font-semibold ${dqiColor(slice.avgDqi)}`}>
                          {slice.avgDqi}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={gradeBadgeVariant(slice.avgGrade)}>{slice.avgGrade}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{slice.executionFailurePercent}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* By Territory */}
          {analysis.byTerritory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">DQI by Territory</CardTitle>
                <CardDescription>Minimum 3 samples per territory</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Territory</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Avg DQI</TableHead>
                      <TableHead className="text-right">Avg Grade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.byTerritory.map(slice => (
                      <TableRow key={slice.label}>
                        <TableCell className="font-medium">{slice.label}</TableCell>
                        <TableCell className="text-right">{slice.count}</TableCell>
                        <TableCell className={`text-right font-semibold ${dqiColor(slice.avgDqi)}`}>
                          {slice.avgDqi}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={gradeBadgeVariant(slice.avgGrade)}>{slice.avgGrade}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Case Row Sub-Component ──────────────────────────────────────────────────

function CaseRow({ assessment: a }: { assessment: DecisionQualityAssessment }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${dqiColor(a.decision_quality_index)}`}>
              {a.decision_quality_index}
            </span>
            <Badge variant={gradeBadgeVariant(a.grade)}>{a.grade}</Badge>
            <span className="text-sm text-muted-foreground">
              {a.store_name || a.store_id.slice(0, 8)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{a.context.human_action}</Badge>
            <Badge variant="outline" className="text-xs">{a.context.confidence_raw}%</Badge>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-4 space-y-4">
          {/* Summary */}
          <p className="text-sm text-muted-foreground italic">{a.summary}</p>

          {/* Dimension Breakdown */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Info Align', score: a.dimension_scores.information_alignment, max: 25 },
              { label: 'Timeliness', score: a.dimension_scores.timeliness, max: 20 },
              { label: 'Judgment', score: a.dimension_scores.judgment, max: 20 },
              { label: 'Exec Sep', score: a.dimension_scores.execution_separation, max: 15 },
              { label: 'Outcome', score: a.dimension_scores.outcome_consistency, max: 20 },
            ].map(dim => (
              <div key={dim.label} className="text-center">
                <p className="text-xs text-muted-foreground">{dim.label}</p>
                <p className="text-sm font-semibold">{dim.score}/{dim.max}</p>
                <Progress value={(dim.score / dim.max) * 100} className="h-1 mt-1" />
              </div>
            ))}
          </div>

          {/* Flags */}
          {a.flags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {a.flags.map((flag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {flag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
