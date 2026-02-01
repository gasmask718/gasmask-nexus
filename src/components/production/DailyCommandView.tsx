/**
 * DAILY PRODUCTION COMMAND VIEW
 * 
 * Live decision support for managers answering: "Are we winning today?"
 * Shows:
 * - Workers present today
 * - Current throughput (boxes/hr)
 * - Time-to-complete estimate
 * - At-risk workers (low predictability or declining)
 * - Top contributors today
 * - Visual alerts for operational warnings
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Award,
  Target,
  Activity,
  CheckCircle2,
  AlertCircle,
  Gauge,
  Package,
  Shield,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useWorkerSkillProfiles, 
  useProductionWorkers,
  useCycleBenchmarks,
  WorkerSkillProfile 
} from '@/hooks/useWorkerPerformance';
import { useWorkerAttendance, useProductionBatches } from '@/hooks/useProductionPortal';
import { format } from 'date-fns';

interface DailyCommandViewProps {
  officeId: string;
  targetBoxes?: number;
}

interface OperationalAlert {
  id: string;
  severity: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  icon: React.ReactNode;
}

function calculatePredictability(profile: WorkerSkillProfile): number {
  const consistencyVariance = profile.rolling_7_day_boxes > 0 
    ? Math.abs((profile.rolling_7_day_defects || 0) / profile.rolling_7_day_boxes) 
    : 0.25;
  
  return Math.round(
    (profile.reliability_score * 0.4) +
    ((1 - Math.min(consistencyVariance, 1)) * 100 * 0.3) +
    ((profile.trend_speed === 'stable' ? 75 : profile.trend_speed === 'improving' ? 100 : 50) * 0.15) +
    ((profile.trend_quality === 'stable' ? 75 : profile.trend_quality === 'improving' ? 100 : 50) * 0.15)
  );
}

export function DailyCommandView({ officeId, targetBoxes = 100 }: DailyCommandViewProps) {
  const today = new Date();
  const { data: profiles = [], isLoading: profilesLoading } = useWorkerSkillProfiles(officeId);
  const { data: workers = [], isLoading: workersLoading } = useProductionWorkers(officeId);
  const { data: attendance = [] } = useWorkerAttendance(officeId, today);
  const { data: batches = [] } = useProductionBatches(officeId, today);
  const { data: benchmarks = [] } = useCycleBenchmarks(officeId);

  const isLoading = profilesLoading || workersLoading;
  const workerMap = new Map(workers.map(w => [w.id, w]));
  const profileMap = new Map(profiles.map(p => [p.worker_id, p]));
  const globalBenchmark = benchmarks.find(b => b.scope_type === 'global');
  const defaultBoxesPerHour = globalBenchmark?.expected_boxes_per_hour || 10;

  // Present workers today
  const presentWorkerIds = useMemo(() => 
    attendance.map(a => a.worker_id),
    [attendance]
  );

  // Get profiles for present workers
  const presentProfiles = useMemo(() => 
    profiles.filter(p => presentWorkerIds.includes(p.worker_id)),
    [profiles, presentWorkerIds]
  );

  // Current throughput calculation
  const throughputMetrics = useMemo(() => {
    const totalBoxesToday = batches.reduce((sum, b) => sum + (b.boxes_produced || 0), 0);
    const totalCapacity = presentProfiles.reduce(
      (sum, p) => sum + (p.boxes_per_hour || defaultBoxesPerHour), 
      0
    );
    const avgBoxesPerHour = presentProfiles.length > 0 
      ? totalCapacity / presentProfiles.length 
      : 0;
    
    // Time to complete
    const boxesRemaining = Math.max(0, targetBoxes - totalBoxesToday);
    const hoursToComplete = totalCapacity > 0 ? boxesRemaining / totalCapacity : 0;
    const minutesToComplete = Math.round(hoursToComplete * 60);
    
    // Average predictability
    const avgPredictability = presentProfiles.length > 0
      ? Math.round(presentProfiles.reduce((sum, p) => sum + calculatePredictability(p), 0) / presentProfiles.length)
      : 0;

    return {
      totalBoxesToday,
      totalCapacity,
      avgBoxesPerHour,
      hoursToComplete: Math.floor(hoursToComplete),
      minutesToComplete: minutesToComplete % 60,
      avgPredictability,
      isOnTrack: hoursToComplete <= 8,
      confidenceLevel: avgPredictability >= 70 ? 'high' : avgPredictability >= 50 ? 'medium' : 'low' as const,
    };
  }, [batches, presentProfiles, targetBoxes, defaultBoxesPerHour]);

  // At-risk workers
  const atRiskWorkers = useMemo(() => {
    return presentProfiles.filter(p => {
      const predictability = calculatePredictability(p);
      return predictability < 50 || p.trend_speed === 'declining' || p.trend_quality === 'declining';
    }).map(p => ({
      ...p,
      name: workerMap.get(p.worker_id)?.full_name || 'Unknown',
      predictability: calculatePredictability(p),
    }));
  }, [presentProfiles, workerMap]);

  // Top contributors
  const topContributors = useMemo(() => {
    return [...presentProfiles]
      .sort((a, b) => (b.boxes_per_hour || 0) - (a.boxes_per_hour || 0))
      .slice(0, 5)
      .map(p => ({
        ...p,
        name: workerMap.get(p.worker_id)?.full_name || 'Unknown',
        predictability: calculatePredictability(p),
      }));
  }, [presentProfiles, workerMap]);

  // Operational alerts
  const alerts = useMemo<OperationalAlert[]>(() => {
    const result: OperationalAlert[] = [];

    // Declining trend 3+ days
    const decliningWorkers = presentProfiles.filter(
      p => p.trend_speed === 'declining' || p.trend_quality === 'declining'
    );
    if (decliningWorkers.length > 0) {
      result.push({
        id: 'declining-trend',
        severity: decliningWorkers.length > 2 ? 'error' : 'warning',
        title: `${decliningWorkers.length} worker(s) with declining trends`,
        description: 'Performance declining compared to previous week.',
        icon: <TrendingDown className="h-4 w-4" />,
      });
    }

    // Low predictability on critical batch
    const lowPredictability = presentProfiles.filter(p => calculatePredictability(p) < 50);
    if (lowPredictability.length > presentProfiles.length / 2 && presentProfiles.length > 0) {
      result.push({
        id: 'low-predictability',
        severity: 'warning',
        title: 'Low team predictability',
        description: 'Majority of workers have predictability scores below 50.',
        icon: <Gauge className="h-4 w-4" />,
      });
    }

    // Defect spike
    const highDefects = presentProfiles.filter(p => (p.defect_rate_per_thousand || 0) > 15);
    if (highDefects.length > 0) {
      result.push({
        id: 'defect-spike',
        severity: highDefects.length > 2 ? 'error' : 'warning',
        title: `${highDefects.length} worker(s) with high defect rates`,
        description: 'Defect rate exceeds 15 per 1,000 units.',
        icon: <AlertTriangle className="h-4 w-4" />,
      });
    }

    // Staffing below threshold
    if (presentWorkerIds.length < 3) {
      result.push({
        id: 'understaffed',
        severity: presentWorkerIds.length < 2 ? 'error' : 'warning',
        title: 'Low staffing',
        description: `Only ${presentWorkerIds.length} worker(s) present today.`,
        icon: <Users className="h-4 w-4" />,
      });
    }

    return result;
  }, [presentProfiles, presentWorkerIds]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  const confidenceColors = {
    high: 'text-emerald-600 bg-emerald-100',
    medium: 'text-amber-600 bg-amber-100',
    low: 'text-red-600 bg-red-100',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Daily Production Command
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Clock className="h-4 w-4" />
            {format(today, 'EEEE, MMMM d, yyyy')}
            <Badge variant="outline" className="ml-2 text-xs">
              <Info className="h-3 w-3 mr-1" />
              Live View
            </Badge>
          </p>
        </div>
      </div>

      {/* Data Governance Notice */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Scores are rolling 7-day indicators, not disciplinary metrics.
      </div>

      {/* Operational Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map(alert => (
            <Alert 
              key={alert.id} 
              variant={alert.severity === 'error' ? 'destructive' : 'default'}
              className={cn(
                alert.severity === 'warning' && 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20',
                alert.severity === 'info' && 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20'
              )}
            >
              {alert.icon}
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.description}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Workers Present */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">{presentWorkerIds.length}</p>
                <p className="text-sm text-muted-foreground">Workers Present</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Throughput */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {throughputMetrics.totalCapacity.toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">Boxes/Hour Capacity</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Output */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-3xl font-bold">{throughputMetrics.totalBoxesToday}</p>
                <p className="text-sm text-muted-foreground">Boxes Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time to Complete */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center",
                throughputMetrics.isOnTrack 
                  ? "bg-emerald-100 dark:bg-emerald-900/30" 
                  : "bg-red-100 dark:bg-red-900/30"
              )}>
                {throughputMetrics.isOnTrack ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {throughputMetrics.hoursToComplete > 0 && `${throughputMetrics.hoursToComplete}h `}
                  {throughputMetrics.minutesToComplete}m
                </p>
                <p className="text-sm text-muted-foreground">
                  to complete {targetBoxes - throughputMetrics.totalBoxesToday} remaining
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Daily Target Progress</span>
              <span className="text-muted-foreground">
                {throughputMetrics.totalBoxesToday} / {targetBoxes} boxes
              </span>
            </div>
            <Progress 
              value={Math.min(100, (throughputMetrics.totalBoxesToday / targetBoxes) * 100)} 
              className="h-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{Math.round((throughputMetrics.totalBoxesToday / targetBoxes) * 100)}% complete</span>
              <Badge variant="outline" className={confidenceColors[throughputMetrics.confidenceLevel]}>
                <Gauge className="h-3 w-3 mr-1" />
                {throughputMetrics.confidenceLevel} confidence
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Contributors */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Top Contributors Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topContributors.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No workers with performance data present
              </p>
            ) : (
              <div className="space-y-3">
                {topContributors.map((worker, idx) => (
                  <div key={worker.id} className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white",
                      idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-amber-700" : "bg-muted text-muted-foreground"
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{worker.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {worker.boxes_per_hour?.toFixed(1) || '—'} boxes/hr
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {worker.trend_speed === 'improving' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                      {worker.trend_speed === 'declining' && <TrendingDown className="h-4 w-4 text-red-500" />}
                      <Badge variant="secondary" className="text-xs">
                        {worker.predictability}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* At-Risk Workers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              At-Risk Workers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {atRiskWorkers.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm text-muted-foreground">All workers performing well</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskWorkers.map(worker => (
                  <div key={worker.id} className="flex items-center gap-3 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{worker.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {worker.trend_speed === 'declining' && (
                          <span className="text-red-600 flex items-center gap-0.5">
                            <TrendingDown className="h-3 w-3" /> Speed
                          </span>
                        )}
                        {worker.trend_quality === 'declining' && (
                          <span className="text-red-600 flex items-center gap-0.5">
                            <TrendingDown className="h-3 w-3" /> Quality
                          </span>
                        )}
                        {worker.predictability < 50 && (
                          <span className="text-amber-600">
                            Predictability: {worker.predictability}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs shrink-0">
                      At Risk
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
