/**
 * CYCLE TIME PANEL
 * 
 * Expected vs Actual cycle time comparison for batches.
 * Shows variance from benchmarks with visual indicators.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  useCycleBenchmarks,
  CycleBenchmark,
} from '@/hooks/useWorkerPerformance';
import { ProductionBatch } from '@/hooks/useProductionPortal';
import { 
  Timer, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CycleTimePanelProps {
  batch?: ProductionBatch;
  officeId: string;
  compact?: boolean;
}

interface CycleMetric {
  label: string;
  expected: number;
  actual: number | null;
  unit: string;
  invertBetter?: boolean; // Lower is better (e.g., time)
}

function getVarianceStatus(
  expected: number, 
  actual: number | null, 
  threshold: number,
  invertBetter: boolean = false
): 'good' | 'warning' | 'bad' | 'unknown' {
  if (actual === null || actual === 0) return 'unknown';
  
  const variance = invertBetter 
    ? ((actual - expected) / expected) * 100
    : ((expected - actual) / expected) * 100;
  
  if (variance <= -threshold) return 'bad';
  if (variance <= 0) return 'warning';
  return 'good';
}

function VarianceIndicator({ 
  status, 
  variancePct 
}: { 
  status: 'good' | 'warning' | 'bad' | 'unknown';
  variancePct: number | null;
}) {
  if (status === 'unknown') {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  
  const icons = {
    good: <TrendingUp className="h-3 w-3" />,
    warning: <Minus className="h-3 w-3" />,
    bad: <TrendingDown className="h-3 w-3" />,
  };
  
  const colors = {
    good: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    bad: 'text-red-600 bg-red-50',
  };
  
  return (
    <Badge variant="outline" className={cn('text-xs gap-1', colors[status])}>
      {icons[status]}
      {variancePct !== null ? `${variancePct > 0 ? '+' : ''}${variancePct.toFixed(0)}%` : '—'}
    </Badge>
  );
}

function CycleMetricRow({ 
  metric, 
  threshold 
}: { 
  metric: CycleMetric; 
  threshold: number;
}) {
  const variancePct = metric.actual !== null && metric.expected > 0
    ? ((metric.actual - metric.expected) / metric.expected) * 100
    : null;
  
  const status = getVarianceStatus(
    metric.expected, 
    metric.actual, 
    threshold, 
    metric.invertBetter
  );
  
  const progressValue = metric.actual !== null && metric.expected > 0
    ? Math.min(100, (metric.actual / metric.expected) * 100)
    : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{metric.label}</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {metric.actual !== null ? `${metric.actual.toFixed(1)}${metric.unit}` : '—'}
          </span>
          <span className="text-xs text-muted-foreground">
            / {metric.expected}{metric.unit}
          </span>
          <VarianceIndicator status={status} variancePct={variancePct} />
        </div>
      </div>
      <Progress 
        value={progressValue} 
        className={cn(
          "h-1.5",
          status === 'good' && "[&>div]:bg-emerald-500",
          status === 'warning' && "[&>div]:bg-amber-500",
          status === 'bad' && "[&>div]:bg-red-500"
        )}
      />
    </div>
  );
}

export function CycleTimePanel({ batch, officeId, compact = false }: CycleTimePanelProps) {
  const { data: benchmarks = [] } = useCycleBenchmarks(officeId);
  
  // Get applicable benchmark (office-specific > global)
  const benchmark: CycleBenchmark | null = 
    benchmarks.find(b => b.scope_type === 'office' && b.scope_id === officeId) ||
    benchmarks.find(b => b.scope_type === 'global') ||
    null;

  if (!benchmark) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <Timer className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No benchmarks configured</p>
        </CardContent>
      </Card>
    );
  }

  const threshold = benchmark.variance_threshold_pct || 15;

  // Build metrics from batch data
  const metrics: CycleMetric[] = [
    {
      label: 'Tube Fill Time',
      expected: benchmark.expected_tube_fill_seconds,
      actual: batch?.avg_tube_fill_seconds ?? null,
      unit: 's',
      invertBetter: true,
    },
    {
      label: 'Sticker Application',
      expected: benchmark.expected_sticker_apply_seconds,
      actual: batch?.avg_sticker_apply_seconds ?? null,
      unit: 's',
      invertBetter: true,
    },
    {
      label: 'Batch Completion',
      expected: benchmark.expected_batch_completion_minutes,
      actual: batch?.actual_completion_minutes ?? null,
      unit: 'm',
      invertBetter: true,
    },
  ];

  // Calculate overall status
  const validMetrics = metrics.filter(m => m.actual !== null);
  const badCount = validMetrics.filter(m => 
    getVarianceStatus(m.expected, m.actual, threshold, m.invertBetter) === 'bad'
  ).length;
  const goodCount = validMetrics.filter(m => 
    getVarianceStatus(m.expected, m.actual, threshold, m.invertBetter) === 'good'
  ).length;

  const overallStatus = badCount > 0 ? 'bad' : goodCount === validMetrics.length ? 'good' : 'warning';

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {overallStatus === 'good' && (
          <Badge variant="outline" className="text-emerald-600 bg-emerald-50 gap-1">
            <CheckCircle className="h-3 w-3" />
            On Track
          </Badge>
        )}
        {overallStatus === 'warning' && (
          <Badge variant="outline" className="text-amber-600 bg-amber-50 gap-1">
            <Clock className="h-3 w-3" />
            Slightly Behind
          </Badge>
        )}
        {overallStatus === 'bad' && (
          <Badge variant="outline" className="text-red-600 bg-red-50 gap-1">
            <AlertTriangle className="h-3 w-3" />
            Behind Schedule
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Timer className="h-4 w-4" />
            Cycle Time Analysis
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs",
              overallStatus === 'good' && "text-emerald-600 bg-emerald-50",
              overallStatus === 'warning' && "text-amber-600 bg-amber-50",
              overallStatus === 'bad' && "text-red-600 bg-red-50"
            )}
          >
            ±{threshold}% threshold
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {metrics.map((metric, idx) => (
          <CycleMetricRow key={idx} metric={metric} threshold={threshold} />
        ))}
        
        {validMetrics.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Record timing data to see cycle analysis
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Summary component for daily view
export function DailyCycleTimeSummary({ 
  batches, 
  officeId 
}: { 
  batches: ProductionBatch[]; 
  officeId: string;
}) {
  const { data: benchmarks = [] } = useCycleBenchmarks(officeId);
  
  const benchmark = 
    benchmarks.find(b => b.scope_type === 'office' && b.scope_id === officeId) ||
    benchmarks.find(b => b.scope_type === 'global') ||
    null;

  if (!benchmark || batches.length === 0) return null;

  // Calculate averages across all batches
  const completedBatches = batches.filter(b => b.actual_completion_minutes != null);
  const avgCompletion = completedBatches.length > 0
    ? completedBatches.reduce((sum, b) => sum + (b.actual_completion_minutes || 0), 0) / completedBatches.length
    : null;

  const avgTubeFill = batches.filter(b => b.avg_tube_fill_seconds != null)
    .reduce((sum, b, _, arr) => sum + (b.avg_tube_fill_seconds || 0) / arr.length, 0) || null;

  const threshold = benchmark.variance_threshold_pct || 15;
  const completionVariance = avgCompletion !== null && benchmark.expected_batch_completion_minutes > 0
    ? ((avgCompletion - benchmark.expected_batch_completion_minutes) / benchmark.expected_batch_completion_minutes) * 100
    : null;

  const status = completionVariance === null ? 'unknown'
    : completionVariance > threshold ? 'bad'
    : completionVariance > 0 ? 'warning'
    : 'good';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Today's Cycle Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Avg Batch Time</p>
            <p className="text-lg font-semibold">
              {avgCompletion !== null ? `${avgCompletion.toFixed(0)}m` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Target: {benchmark.expected_batch_completion_minutes}m
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Tube Fill</p>
            <p className="text-lg font-semibold">
              {avgTubeFill !== null ? `${avgTubeFill.toFixed(1)}s` : '—'}
            </p>
            <p className="text-xs text-muted-foreground">
              Target: {benchmark.expected_tube_fill_seconds}s
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Variance</p>
            <Badge 
              variant="outline" 
              className={cn(
                "mt-1",
                status === 'good' && "text-emerald-600 bg-emerald-50",
                status === 'warning' && "text-amber-600 bg-amber-50",
                status === 'bad' && "text-red-600 bg-red-50"
              )}
            >
              {completionVariance !== null 
                ? `${completionVariance > 0 ? '+' : ''}${completionVariance.toFixed(0)}%` 
                : '—'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
