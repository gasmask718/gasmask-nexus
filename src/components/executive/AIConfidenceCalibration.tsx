// ═══════════════════════════════════════════════════════════════════════════════
// AI CONFIDENCE CALIBRATION — Phase 7D: Executive UI (Read-Only)
// ═══════════════════════════════════════════════════════════════════════════════
// No sliders. No inputs. No controls that affect dispatch.
// "Confidence calibration analysis does NOT modify AI behavior."

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  Info,
  XCircle,
  Activity,
  BarChart3,
  Layers,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { useConfidenceCalibration, type CalibrationBucket, type ContextSlice, type AdvisoryInsight } from '@/hooks/useConfidenceCalibration';

// ─── Sub-Components ──────────────────────────────────────────────────────────

function CalibrationStateIcon({ state }: { state: CalibrationBucket['state'] }) {
  switch (state) {
    case 'overconfident':
      return <TrendingDown className="h-4 w-4 text-destructive" />;
    case 'underconfident':
      return <TrendingUp className="h-4 w-4 text-blue-500" />;
    default:
      return <Minus className="h-4 w-4 text-green-500" />;
  }
}

function StateBadge({ state }: { state: CalibrationBucket['state'] }) {
  const variants: Record<string, { label: string; className: string }> = {
    well_calibrated: { label: 'Calibrated', className: 'bg-green-500/15 text-green-600 border-green-500/30' },
    overconfident: { label: 'Overconfident', className: 'bg-destructive/15 text-destructive border-destructive/30' },
    underconfident: { label: 'Underconfident', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
  };
  const v = variants[state] || variants.well_calibrated;
  return <Badge variant="outline" className={v.className}>{v.label}</Badge>;
}

function InsightIcon({ severity }: { severity: AdvisoryInsight['severity'] }) {
  switch (severity) {
    case 'critical': return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />;
    default: return <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

function CalibrationTable({ buckets }: { buckets: CalibrationBucket[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Confidence</TableHead>
          <TableHead className="text-right">Samples</TableHead>
          <TableHead className="text-right">Applied</TableHead>
          <TableHead className="text-right">Dismissed</TableHead>
          <TableHead className="text-right">Expected</TableHead>
          <TableHead className="text-right">Observed</TableHead>
          <TableHead className="text-right">Error</TableHead>
          <TableHead>State</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {buckets.map(b => (
          <TableRow key={b.range}>
            <TableCell className="font-medium">{b.range}%</TableCell>
            <TableCell className="text-right">{b.total}</TableCell>
            <TableCell className="text-right text-green-600">{b.applied}</TableCell>
            <TableCell className="text-right text-destructive">{b.dismissed}</TableCell>
            <TableCell className="text-right text-muted-foreground">{b.expectedRate}%</TableCell>
            <TableCell className="text-right font-semibold">{b.observedRate}%</TableCell>
            <TableCell className="text-right">
              <span className="inline-flex items-center gap-1">
                <CalibrationStateIcon state={b.state} />
                {b.calibrationError > 0 ? '+' : ''}{b.calibrationError}%
              </span>
            </TableCell>
            <TableCell><StateBadge state={b.state} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AIConfidenceCalibration() {
  const { analysis, isLoading } = useConfidenceCalibration();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!analysis || analysis.totalSamples === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No feedback data available for calibration analysis.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Calibration requires applied/dismissed feedback from AI dispatch suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { globalBuckets, globalECE, maxDeviation, worstBucket, contextSlices, advisoryInsights, timeWindows, totalSamples } = analysis;

  return (
    <div className="space-y-4">
      {/* Governance Banner — Phase 7E */}
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <ShieldAlert className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm text-blue-600">
          <strong>Read-Only Analysis</strong> — Confidence calibration analysis does NOT modify AI behavior.
          All outputs are advisory and require explicit human action to effect change.
        </AlertDescription>
      </Alert>

      {/* ECE Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expected Calibration Error</p>
            <p className={`text-3xl font-bold ${globalECE > 15 ? 'text-destructive' : globalECE > 8 ? 'text-yellow-500' : 'text-green-500'}`}>
              {globalECE}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Lower is better (0% = perfect)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Max Bucket Deviation</p>
            <p className="text-3xl font-bold">{maxDeviation}%</p>
            <p className="text-xs text-muted-foreground mt-1">Worst single bucket error</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Worst Drift Bucket</p>
            <p className="text-3xl font-bold">{worstBucket || '—'}%</p>
            <p className="text-xs text-muted-foreground mt-1">Highest miscalibration zone</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Samples</p>
            <p className="text-3xl font-bold">{totalSamples}</p>
            <p className="text-xs text-muted-foreground mt-1">Feedback entries analyzed</p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Tabs */}
      <Tabs defaultValue="curve" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="curve" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Calibration Curve
          </TabsTrigger>
          <TabsTrigger value="context" className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Context Breakdown
          </TabsTrigger>
          <TabsTrigger value="trend" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Time Trends
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Advisory Insights ({advisoryInsights.length})
          </TabsTrigger>
        </TabsList>

        {/* Calibration Curve Table */}
        <TabsContent value="curve">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Global Calibration Curve</CardTitle>
              <CardDescription>
                Platt-style binning: "Is {'{'}confidence{'}'}% really behaving like {'{'}confidence{'}'}%?"
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CalibrationTable buckets={globalBuckets} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Context Breakdown */}
        <TabsContent value="context">
          <div className="space-y-4">
            {contextSlices.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  Not enough data for contextual slicing (min 5 samples per slice).
                </CardContent>
              </Card>
            ) : (
              contextSlices.map(slice => (
                <Card key={slice.label}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{slice.label}</CardTitle>
                      <Badge variant="outline" className={slice.ece > 15 ? 'border-destructive/30 text-destructive' : ''}>
                        ECE: {slice.ece}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CalibrationTable buckets={slice.buckets} />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Time Trends */}
        <TabsContent value="trend">
          <div className="space-y-4">
            {timeWindows.map(tw => (
              <Card key={tw.label}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{tw.label}</CardTitle>
                    <Badge variant="outline" className={tw.ece > 15 ? 'border-destructive/30 text-destructive' : ''}>
                      ECE: {tw.ece}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CalibrationTable buckets={tw.buckets} />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Advisory Insights */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Advisory Recommendations</CardTitle>
              <CardDescription>
                Non-binding observations derived from calibration analysis. No action is taken automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {advisoryInsights.map((insight, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-md border ${
                    insight.severity === 'critical'
                      ? 'border-destructive/30 bg-destructive/5'
                      : insight.severity === 'warning'
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-blue-500/30 bg-blue-500/5'
                  }`}
                >
                  <InsightIcon severity={insight.severity} />
                  <p className="text-sm">{insight.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
