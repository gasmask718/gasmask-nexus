/**
 * TIME TO COMPLETE ESTIMATOR
 * 
 * Batch/daily planning view showing:
 * - Expected completion time based on assigned workers
 * - Reasons if behind (staffing, slow task, defects, absence)
 * - Worker capacity breakdown
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Users, 
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Timer,
  Package,
  Gauge,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkerSkillProfile, CycleBenchmark } from '@/hooks/useWorkerPerformance';
import { ProductionBatch } from '@/hooks/useProductionPortal';

interface TimeToCompleteEstimatorProps {
  batch?: ProductionBatch | null;
  targetBoxes: number;
  profiles: WorkerSkillProfile[];
  presentWorkerIds: string[];
  benchmark?: CycleBenchmark;
  hoursRemaining?: number;
}

interface EstimateResult {
  estimatedHours: number;
  estimatedMinutes: number;
  totalCapacityBoxesPerHour: number;
  avgWorkerBoxesPerHour: number;
  workerBreakdown: {
    workerId: string;
    boxesPerHour: number;
    predictability: number;
    contribution: number; // percentage of team output
  }[];
  isOnTrack: boolean;
  delayReasons: {
    reason: string;
    severity: 'low' | 'medium' | 'high';
    icon: React.ReactNode;
  }[];
  confidenceLevel: 'high' | 'medium' | 'low';
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

export function TimeToCompleteEstimator({
  batch,
  targetBoxes,
  profiles,
  presentWorkerIds,
  benchmark,
  hoursRemaining = 8,
}: TimeToCompleteEstimatorProps) {
  const estimate = useMemo<EstimateResult>(() => {
    const defaultBoxesPerHour = benchmark?.expected_boxes_per_hour || 10;
    
    // Get profiles for present workers
    const presentProfiles = profiles.filter(p => presentWorkerIds.includes(p.worker_id));
    
    if (presentProfiles.length === 0) {
      return {
        estimatedHours: 0,
        estimatedMinutes: 0,
        totalCapacityBoxesPerHour: 0,
        avgWorkerBoxesPerHour: 0,
        workerBreakdown: [],
        isOnTrack: false,
        delayReasons: [{
          reason: 'No workers assigned',
          severity: 'high',
          icon: <Users className="h-4 w-4" />,
        }],
        confidenceLevel: 'low',
      };
    }

    // Calculate capacity per worker
    const workerBreakdown = presentProfiles.map(profile => {
      const boxesPerHour = profile.boxes_per_hour || defaultBoxesPerHour;
      const predictability = calculatePredictability(profile);
      
      return {
        workerId: profile.worker_id,
        boxesPerHour,
        predictability,
        contribution: 0, // will calculate after
      };
    });

    // Total capacity
    const totalCapacityBoxesPerHour = workerBreakdown.reduce((sum, w) => sum + w.boxesPerHour, 0);
    const avgWorkerBoxesPerHour = totalCapacityBoxesPerHour / workerBreakdown.length;

    // Update contribution percentages
    workerBreakdown.forEach(w => {
      w.contribution = totalCapacityBoxesPerHour > 0 
        ? Math.round((w.boxesPerHour / totalCapacityBoxesPerHour) * 100) 
        : 0;
    });

    // Calculate estimated time
    const boxesRemaining = Math.max(0, targetBoxes - (batch?.boxes_produced || 0));
    const estimatedTotalMinutes = totalCapacityBoxesPerHour > 0 
      ? (boxesRemaining / totalCapacityBoxesPerHour) * 60 
      : 0;
    const estimatedHours = Math.floor(estimatedTotalMinutes / 60);
    const estimatedMinutes = Math.round(estimatedTotalMinutes % 60);

    // Is on track?
    const hoursNeeded = estimatedTotalMinutes / 60;
    const isOnTrack = hoursNeeded <= hoursRemaining;

    // Identify delay reasons
    const delayReasons: EstimateResult['delayReasons'] = [];

    if (presentProfiles.length < 3) {
      delayReasons.push({
        reason: `Low staffing (${presentProfiles.length} workers)`,
        severity: presentProfiles.length < 2 ? 'high' : 'medium',
        icon: <Users className="h-4 w-4" />,
      });
    }

    const slowWorkers = presentProfiles.filter(p => (p.speed_score || 50) < 40);
    if (slowWorkers.length > 0) {
      delayReasons.push({
        reason: `${slowWorkers.length} worker(s) below speed threshold`,
        severity: slowWorkers.length > 1 ? 'medium' : 'low',
        icon: <Timer className="h-4 w-4" />,
      });
    }

    const highDefectWorkers = presentProfiles.filter(p => (p.defect_rate_per_thousand || 0) > 15);
    if (highDefectWorkers.length > 0) {
      delayReasons.push({
        reason: `${highDefectWorkers.length} worker(s) with high defect rate`,
        severity: highDefectWorkers.length > 1 ? 'medium' : 'low',
        icon: <AlertTriangle className="h-4 w-4" />,
      });
    }

    const decliningWorkers = presentProfiles.filter(p => 
      p.trend_speed === 'declining' || p.trend_quality === 'declining'
    );
    if (decliningWorkers.length > presentProfiles.length / 2) {
      delayReasons.push({
        reason: 'Majority of workers showing declining trends',
        severity: 'medium',
        icon: <TrendingDown className="h-4 w-4" />,
      });
    }

    // Confidence level based on predictability
    const avgPredictability = workerBreakdown.reduce((sum, w) => sum + w.predictability, 0) / workerBreakdown.length;
    const confidenceLevel: EstimateResult['confidenceLevel'] = 
      avgPredictability >= 70 ? 'high' : avgPredictability >= 50 ? 'medium' : 'low';

    return {
      estimatedHours,
      estimatedMinutes,
      totalCapacityBoxesPerHour,
      avgWorkerBoxesPerHour,
      workerBreakdown: workerBreakdown.sort((a, b) => b.boxesPerHour - a.boxesPerHour),
      isOnTrack,
      delayReasons,
      confidenceLevel,
    };
  }, [batch, targetBoxes, profiles, presentWorkerIds, benchmark, hoursRemaining]);

  const confidenceColors = {
    high: 'text-emerald-600 bg-emerald-100',
    medium: 'text-amber-600 bg-amber-100',
    low: 'text-red-600 bg-red-100',
  };

  const boxesCompleted = batch?.boxes_produced || 0;
  const progressPercent = targetBoxes > 0 ? Math.min(100, (boxesCompleted / targetBoxes) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time to Complete
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn("text-xs", confidenceColors[estimate.confidenceLevel])}
          >
            <Gauge className="h-3 w-3 mr-1" />
            {estimate.confidenceLevel} confidence
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Main Estimate Display */}
        <div className="text-center py-4 rounded-lg bg-muted/50">
          {estimate.totalCapacityBoxesPerHour > 0 ? (
            <>
              <p className="text-4xl font-bold">
                {estimate.estimatedHours > 0 && `${estimate.estimatedHours}h `}
                {estimate.estimatedMinutes}m
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                to complete {targetBoxes - boxesCompleted} remaining boxes
              </p>
              <div className={cn(
                "inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-sm font-medium",
                estimate.isOnTrack 
                  ? "bg-emerald-100 text-emerald-700" 
                  : "bg-red-100 text-red-700"
              )}>
                {estimate.isOnTrack ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    On Track
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    Behind Schedule
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No workers assigned</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {boxesCompleted} / {targetBoxes} boxes
            </span>
            <span className="text-muted-foreground">{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Team Capacity */}
        {estimate.workerBreakdown.length > 0 && (
          <>
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Team Capacity
                </span>
                <span className="text-lg font-bold text-primary">
                  {estimate.totalCapacityBoxesPerHour.toFixed(1)} boxes/hr
                </span>
              </div>
              
              <div className="text-xs text-muted-foreground">
                {estimate.workerBreakdown.length} workers present • 
                Avg {estimate.avgWorkerBoxesPerHour.toFixed(1)} boxes/hr per worker
              </div>
            </div>
          </>
        )}

        {/* Delay Reasons */}
        {estimate.delayReasons.length > 0 && (
          <>
            <Separator />
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Potential Delays</p>
              {estimate.delayReasons.map((reason, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md text-sm",
                    reason.severity === 'high' && "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400",
                    reason.severity === 'medium' && "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
                    reason.severity === 'low' && "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400",
                  )}
                >
                  {reason.icon}
                  {reason.reason}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Top Contributors */}
        {estimate.workerBreakdown.length > 0 && (
          <>
            <Separator />
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Top Contributors</p>
              <div className="space-y-1.5">
                {estimate.workerBreakdown.slice(0, 3).map((worker, idx) => (
                  <div 
                    key={worker.workerId}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold text-white",
                        idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : "bg-amber-700"
                      )}>
                        {idx + 1}
                      </span>
                      <span className="font-medium truncate max-w-[120px]">
                        Worker
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold">{worker.boxesPerHour.toFixed(1)}/hr</span>
                      <Badge variant="outline" className="text-[10px]">
                        {worker.contribution}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
