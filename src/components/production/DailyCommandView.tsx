import { useTranslation } from "@/hooks/useTranslation";
import { BilingualLabel } from "@/components/portal/BilingualLabel";
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
 * - Soft alerts with manager prompts
 * - Today's Worker Grid (clickable, opens profile dialog)
 * - Scenario Planning (what-if simulation)
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  AlertTriangle,
  Award,
  Activity,
  CheckCircle2,
  AlertCircle,
  Gauge,
  Package,
  Shield,
  ChevronRight,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useWorkerSkillProfiles, 
  useProductionWorkers,
  useCycleBenchmarks,
  WorkerSkillProfile 
} from '@/hooks/useWorkerPerformance';
import { useWorkerAttendance, useProductionBatches, useProductionCommunications } from '@/hooks/useProductionPortal';
import { format, differenceInDays } from 'date-fns';
import { WorkerProfileDialog } from './performance/WorkerProfileDialog';
import { ProductionWorker } from '@/hooks/useProductionPortal';
import { generateSoftAlerts, SoftAlertPanel } from './alerts';
import {
  useScenarioSimulation,
  ScenarioToggle,
  ScenarioBanner,
  ScenarioControlsPanel,
  ScenarioOutputPanel,
  WorkerImpactPanel,
  ScenarioComparison,
} from './scenario';

interface DailyCommandViewProps {
  officeId: string;
  targetBoxes?: number;
}

interface EnrichedWorker {
  profile: WorkerSkillProfile;
  worker: ProductionWorker;
  predictability: number;
  contributionPct: number;
  isAtRisk: boolean;
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

const TREND_ICONS = {
  improving: <TrendingUp className="h-3 w-3 text-emerald-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  declining: <TrendingDown className="h-3 w-3 text-red-500" />,
};

export function DailyCommandView({ officeId, targetBoxes = 100 }: DailyCommandViewProps) {
  const { t } = useTranslation();
  const today = new Date();
  const { data: profiles = [], isLoading: profilesLoading } = useWorkerSkillProfiles(officeId);
  const { data: workers = [], isLoading: workersLoading } = useProductionWorkers(officeId);
  const { data: attendance = [] } = useWorkerAttendance(officeId, today);
  const { data: batches = [] } = useProductionBatches(officeId, today);
  const { data: benchmarks = [] } = useCycleBenchmarks(officeId);
  const { data: allCommunications = [] } = useProductionCommunications(officeId, 500);

  // Profile Dialog State
  const [selectedWorker, setSelectedWorker] = useState<{
    profile: WorkerSkillProfile;
    worker: ProductionWorker;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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

  // Enriched workers with all metrics
  const enrichedWorkers = useMemo<EnrichedWorker[]>(() => {
    return presentProfiles.map(profile => {
      const worker = workerMap.get(profile.worker_id);
      const predictability = calculatePredictability(profile);
      const contributionPct = throughputMetrics.totalCapacity > 0 
        ? Math.round(((profile.boxes_per_hour || defaultBoxesPerHour) / throughputMetrics.totalCapacity) * 100)
        : 0;
      const isAtRisk = predictability < 50 || 
        profile.trend_speed === 'declining' || 
        profile.trend_quality === 'declining';

      return {
        profile,
        worker: worker || { id: profile.worker_id, full_name: 'Unknown' } as ProductionWorker,
        predictability,
        contributionPct,
        isAtRisk,
      };
    }).sort((a, b) => (b.profile.boxes_per_hour || 0) - (a.profile.boxes_per_hour || 0));
  }, [presentProfiles, workerMap, throughputMetrics.totalCapacity, defaultBoxesPerHour]);

  // At-risk workers
  const atRiskWorkers = useMemo(() => 
    enrichedWorkers.filter(w => w.isAtRisk),
    [enrichedWorkers]
  );

  // Top contributors
  const topContributors = useMemo(() => 
    enrichedWorkers.slice(0, 3),
    [enrichedWorkers]
  );

  // Communication stats for soft alerts
  const communicationStats = useMemo(() => {
    const stats = new Map<string, {
      daysSinceContact: number | null;
      last7Days: number;
      hasDecliningTrend: boolean;
      isImproving: boolean;
    }>();

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    presentWorkerIds.forEach(workerId => {
      const workerComms = allCommunications.filter((c: any) => c.worker_id === workerId);
      const profile = presentProfiles.find(p => p.worker_id === workerId);
      
      if (workerComms.length === 0) {
        stats.set(workerId, {
          daysSinceContact: null,
          last7Days: 0,
          hasDecliningTrend: profile?.trend_speed === 'declining' || profile?.trend_quality === 'declining',
          isImproving: profile?.trend_speed === 'improving' || profile?.trend_quality === 'improving',
        });
      } else {
        const sorted = [...workerComms].sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const lastContact = new Date(sorted[0].created_at);
        const last7Days = workerComms.filter((c: any) => new Date(c.created_at) >= sevenDaysAgo).length;

        stats.set(workerId, {
          daysSinceContact: differenceInDays(now, lastContact),
          last7Days,
          hasDecliningTrend: profile?.trend_speed === 'declining' || profile?.trend_quality === 'declining',
          isImproving: profile?.trend_speed === 'improving' || profile?.trend_quality === 'improving',
        });
      }
    });

    return stats;
  }, [allCommunications, presentWorkerIds, presentProfiles]);

  // Soft alerts with manager prompts
  const softAlerts = useMemo(() => {
    return generateSoftAlerts({
      profiles,
      presentWorkerIds,
      communicationStats,
      targetCapacity: targetBoxes,
      currentCapacity: throughputMetrics.totalCapacity * 8, // 8-hour day estimate
    });
  }, [profiles, presentWorkerIds, communicationStats, targetBoxes, throughputMetrics.totalCapacity]);

  // Scenario Planning Simulation Hook
  const scenario = useScenarioSimulation({
    profiles,
    workers,
    presentWorkerIds,
    targetBoxes,
    boxesCompleted: throughputMetrics.totalBoxesToday,
    defaultBoxesPerHour,
  });

  const handleWorkerClick = (enriched: EnrichedWorker) => {
    setSelectedWorker({ profile: enriched.profile, worker: enriched.worker });
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const confidenceColors = {
    high: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30',
    medium: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
    low: 'text-red-600 bg-red-100 dark:bg-red-900/30',
  };

  const getPredictabilityBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{score}</Badge>;
    if (score >= 50) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">{score}</Badge>;
    return <Badge variant="destructive">{score}</Badge>;
  };

  const getHealthColor = (isAtRisk: boolean) => 
    isAtRisk ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* <BilingualLabel tKey="production.scenario_mode" en="Scenario Mode" inline /> Banner */}
        {scenario.isScenarioMode && (
          <ScenarioBanner onExit={scenario.exitScenarioMode} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <BilingualLabel tKey="production.command" en="Daily Production Command" />
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Clock className="h-4 w-4" />
              {format(today, 'EEEE, MMMM d, yyyy')}
              {!scenario.isScenarioMode && (
                <Badge variant="outline" className="ml-2 text-xs">
                  <Info className="h-3 w-3 mr-1" />
                  <BilingualLabel tKey="production.live_view" en="Live View" inline />
                </Badge>
              )}
            </p>
          </div>
          <ScenarioToggle
            isActive={scenario.isScenarioMode}
            onEnter={scenario.enterScenarioMode}
            onExit={scenario.exitScenarioMode}
          />
        </div>

        {/* Data Governance Notice (hide in scenario mode) */}
        {!scenario.isScenarioMode && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("production.metrics_notice")}
          </div>
        )}

        {/* Soft Alert Panel with Manager Prompts (hide in scenario mode) */}
        {!scenario.isScenarioMode && (
          <SoftAlertPanel 
            alerts={softAlerts} 
            maxVisible={3} 
          />
        )}

        {/* Scenario Planning Layout */}
        {scenario.isScenarioMode ? (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column: Controls */}
            <div className="space-y-4">
              <ScenarioControlsPanel
                workers={scenario.simulationWorkers}
                inputs={scenario.inputs}
                onUpdateWorkerPresence={scenario.updateWorkerPresence}
                onUpdateWorkerRate={scenario.updateWorkerRate}
                onUpdateGlobalModifiers={scenario.updateGlobalModifiers}
                onUpdateTimeConstraints={scenario.updateTimeConstraints}
                onReset={scenario.exitScenarioMode}
              />
              <ScenarioComparison
                savedScenarios={scenario.savedScenarios}
                baseline={scenario.baseline}
                currentSimulated={scenario.simulatedOutput}
                onSave={scenario.saveScenario}
                onDelete={scenario.deleteScenario}
                onLoad={scenario.loadScenario}
              />
            </div>

            {/* Right Column: Output & Impacts */}
            <div className="lg:col-span-2 space-y-4">
              <ScenarioOutputPanel
                baseline={scenario.baseline}
                simulated={scenario.simulatedOutput}
                targetBoxes={targetBoxes}
                boxesCompleted={throughputMetrics.totalBoxesToday}
                isScenarioMode={true}
              />
              <WorkerImpactPanel impacts={scenario.workerImpacts} />
            </div>
          </div>
        ) : (
          <>
            {/* Main Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4">
          {/* <BilingualLabel tKey="production.workers_present" en="Workers Present" /> */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold">{presentWorkerIds.length}</p>
                  <p className="text-sm text-muted-foreground"><BilingualLabel tKey="production.workers_present" en="Workers Present" /></p>
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
                  <p className="text-sm text-muted-foreground"><BilingualLabel tKey="production.boxes_per_hour" en="Boxes/Hour Capacity" /></p>
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
                  <p className="text-sm text-muted-foreground"><BilingualLabel tKey="production.boxes_today" en="Boxes Today" /></p>
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
                    {t("production.to_complete_{t("production.remaining")}", { count: targetBoxes - throughputMetrics.totalBoxesToday })}
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
                <span className="font-medium"><BilingualLabel tKey="production.daily_target_progress" en="Daily Target Progress" /></span>
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
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className={confidenceColors[throughputMetrics.confidenceLevel]}>
                      <Gauge className="h-3 w-3 mr-1" />
                      {throughputMetrics.confidenceLevel} confidence
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Based on team predictability scores ({throughputMetrics.avgPredictability}% avg)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Worker Grid */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              Today's Workers
              <Badge variant="secondary" className="ml-2">{enrichedWorkers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {enrichedWorkers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No workers with performance data present today</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Worker</TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Speed</TooltipTrigger>
                          <TooltipContent>7-day rolling speed score</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Quality</TooltipTrigger>
                          <TooltipContent>7-day rolling quality score</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Predictability</TooltipTrigger>
                          <TooltipContent>Reliability + consistency + trend stability</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead className="text-center">Trends</TableHead>
                      <TableHead className="text-right">Boxes/hr</TableHead>
                      <TableHead className="text-right">Defects‰</TableHead>
                      <TableHead className="text-right">
                        <Tooltip>
                          <TooltipTrigger className="cursor-help">Contrib%</TooltipTrigger>
                          <TooltipContent>Contribution to total team capacity</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {enrichedWorkers.map((enriched, idx) => (
                      <TableRow 
                        key={enriched.profile.id}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50",
                          enriched.isAtRisk && "bg-red-50/50 dark:bg-red-950/10"
                        )}
                        onClick={() => handleWorkerClick(enriched)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {idx < 3 && (
                              <div className={cn(
                                "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0",
                                idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : "bg-amber-700"
                              )}>
                                {idx + 1}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{enriched.worker.full_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{enriched.worker.role}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("font-medium", getHealthColor(enriched.profile.speed_score < 50))}>
                            {enriched.profile.speed_score || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn("font-medium", getHealthColor(enriched.profile.quality_score < 50))}>
                            {enriched.profile.quality_score || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {getPredictabilityBadge(enriched.predictability)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Tooltip>
                              <TooltipTrigger>{TREND_ICONS[enriched.profile.trend_speed] || TREND_ICONS.stable}</TooltipTrigger>
                              <TooltipContent>Speed: {enriched.profile.trend_speed}</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger>{TREND_ICONS[enriched.profile.trend_quality] || TREND_ICONS.stable}</TooltipTrigger>
                              <TooltipContent>Quality: {enriched.profile.trend_quality}</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {enriched.profile.boxes_per_hour?.toFixed(1) || '—'}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-mono",
                          (enriched.profile.defect_rate_per_thousand || 0) > 15 && "text-red-600"
                        )}>
                          {enriched.profile.defect_rate_per_thousand?.toFixed(1) || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-xs">{enriched.contributionPct}%</Badge>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
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
                  {topContributors.map((enriched, idx) => (
                    <div 
                      key={enriched.profile.id} 
                      className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                      onClick={() => handleWorkerClick(enriched)}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold text-white",
                        idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : "bg-amber-700"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{enriched.worker.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {enriched.profile.boxes_per_hour?.toFixed(1) || '—'} boxes/hr • {enriched.contributionPct}% of capacity
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {TREND_ICONS[enriched.profile.trend_speed] || TREND_ICONS.stable}
                        {getPredictabilityBadge(enriched.predictability)}
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
                {atRiskWorkers.length > 0 && (
                  <Badge variant="destructive" className="ml-2">{atRiskWorkers.length}</Badge>
                )}
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
                  {atRiskWorkers.map(enriched => (
                    <div 
                      key={enriched.profile.id} 
                      className="flex items-center gap-3 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-950/30 transition-colors"
                      onClick={() => handleWorkerClick(enriched)}
                    >
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{enriched.worker.full_name}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                          {enriched.profile.trend_speed === 'declining' && (
                            <span className="text-red-600 flex items-center gap-0.5">
                              <TrendingDown className="h-3 w-3" /> Speed
                            </span>
                          )}
                          {enriched.profile.trend_quality === 'declining' && (
                            <span className="text-red-600 flex items-center gap-0.5">
                              <TrendingDown className="h-3 w-3" /> Quality
                            </span>
                          )}
                          {enriched.predictability < 50 && (
                            <span className="text-amber-600">
                              Predictability: {enriched.predictability}
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
          </>
        )}

        {/* Worker Profile Dialog */}
        <WorkerProfileDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          profile={selectedWorker?.profile || null}
          worker={selectedWorker?.worker || null}
          benchmark={globalBenchmark}
          officeId={officeId}
        />
      </div>
    </TooltipProvider>
  );
}