/**
 * WORKER PERFORMANCE TAB
 * 
 * Enhanced worker analytics with:
 * - Skill breakdown (speed, quality, reliability, consistency)
 * - Trend indicators (↑ ↓ →)
 * - Predictability scoring
 * - Worker intelligence table with filters
 * - Time-to-complete estimator
 * - Full profile dialog
 * 
 * IMPORTANT: This pulls ONLY from production_worker_skill_profiles (live profiles)
 * History view should use production_worker_performance_snapshots
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useWorkerSkillProfiles, 
  useProductionWorkers,
  useCycleBenchmarks,
  WorkerSkillProfile 
} from '@/hooks/useWorkerPerformance';
import { useWorkerAttendance, ProductionWorker } from '@/hooks/useProductionPortal';
import { 
  User, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Award,
  AlertTriangle,
  Info,
  Calendar,
  LayoutGrid,
  Table2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  WorkerProfileCard, 
  WorkerIntelligenceTable, 
  TimeToCompleteEstimator,
  WorkerProfileDialog 
} from './performance';

interface WorkerPerformanceProps {
  officeId: string;
  targetBoxes?: number;
}

const TREND_ICONS = {
  improving: <TrendingUp className="h-3 w-3 text-emerald-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  declining: <TrendingDown className="h-3 w-3 text-red-500" />,
};

function PerformanceLeaderboard({ profiles, workers }: { 
  profiles: WorkerSkillProfile[]; 
  workers: { id: string; full_name: string }[] 
}) {
  const workerMap = new Map(workers.map(w => [w.id, w.full_name]));
  const sorted = [...profiles].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  const top = sorted.slice(0, 3);
  const needsAttention = sorted.filter(p => (p.overall_score || 50) < 40);
  const declining = sorted.filter(p => p.trend_speed === 'declining' || p.trend_quality === 'declining');

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {/* Top Performers */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet</p>
          ) : (
            <div className="space-y-2">
              {top.map((profile, idx) => (
                <div key={profile.id} className="flex items-center gap-2">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                    idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : "bg-amber-700"
                  )}>
                    {idx + 1}
                  </div>
                  <span className="flex-1 text-sm font-medium truncate">
                    {workerMap.get(profile.worker_id) || 'Unknown'}
                  </span>
                  <div className="flex items-center gap-1">
                    {profile.trend_speed === 'improving' && TREND_ICONS.improving}
                    {profile.trend_quality === 'improving' && TREND_ICONS.improving}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {profile.overall_score || 50}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Needs Attention */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Needs Attention
          </CardTitle>
        </CardHeader>
        <CardContent>
          {needsAttention.length === 0 && declining.length === 0 ? (
            <p className="text-sm text-muted-foreground">All workers performing well</p>
          ) : (
            <div className="space-y-2">
              {needsAttention.slice(0, 3).map(profile => (
                <div key={profile.id} className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">
                    {workerMap.get(profile.worker_id) || 'Unknown'}
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    Score: {profile.overall_score || 50}
                  </Badge>
                </div>
              ))}
              {declining.slice(0, 2).map(profile => (
                <div key={`decline-${profile.id}`} className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="flex-1 text-sm truncate">
                    {workerMap.get(profile.worker_id) || 'Unknown'}
                  </span>
                  <Badge variant="outline" className="text-xs text-red-600">
                    Declining
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function WorkerPerformance({ officeId, targetBoxes = 100 }: WorkerPerformanceProps) {
  const { data: profiles = [], isLoading: profilesLoading } = useWorkerSkillProfiles(officeId);
  const { data: workers = [], isLoading: workersLoading } = useProductionWorkers(officeId);
  const { data: attendance = [] } = useWorkerAttendance(officeId);
  const { data: benchmarks = [] } = useCycleBenchmarks(officeId);
  
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const isLoading = profilesLoading || workersLoading;
  const workerMap = new Map(workers.map(w => [w.id, w]));

  // Get present worker IDs from today's attendance
  const presentWorkerIds = useMemo(() => 
    attendance.map(a => a.worker_id),
    [attendance]
  );

  // Calculate office-wide benchmarks
  const officeBenchmarks = useMemo(() => {
    if (profiles.length === 0) return undefined;
    
    const avgTubeFillSeconds = profiles.reduce((sum, p) => sum + (p.avg_tube_fill_seconds || 0), 0) / profiles.length;
    const avgStickerApplySeconds = profiles.reduce((sum, p) => sum + (p.avg_sticker_apply_seconds || 0), 0) / profiles.length;
    const avgBoxesPerHour = profiles.reduce((sum, p) => sum + (p.boxes_per_hour || 0), 0) / profiles.length;
    const avgDefectRate = profiles.reduce((sum, p) => sum + (p.defect_rate_per_thousand || 0), 0) / profiles.length;
    
    return { avgTubeFillSeconds, avgStickerApplySeconds, avgBoxesPerHour, avgDefectRate };
  }, [profiles]);

  const globalBenchmark = benchmarks.find(b => b.scope_type === 'global');
  const selectedProfile = profiles.find(p => p.worker_id === selectedWorkerId);
  const selectedWorker = selectedWorkerId ? workerMap.get(selectedWorkerId) : null;

  const handleWorkerClick = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setProfileDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Data Source Label */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Worker Performance Intelligence
          </h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Last 7 Days (Rolling)
            <span className="text-xs ml-2">• Data from skill profiles</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <Info className="h-3 w-3" />
            {profiles.length} workers tracked
          </Badge>
          {/* View Toggle */}
          <div className="flex items-center border rounded-md p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                "p-1.5 rounded",
                viewMode === 'cards' && "bg-muted"
              )}
              title="Card View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded",
                viewMode === 'table' && "bg-muted"
              )}
              title="Table View"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Trend Legend */}
      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-muted-foreground font-medium">Trend Indicators:</span>
          <span className="flex items-center gap-1">
            {TREND_ICONS.improving} Improving (↑10%+)
          </span>
          <span className="flex items-center gap-1">
            {TREND_ICONS.stable} Stable
          </span>
          <span className="flex items-center gap-1">
            {TREND_ICONS.declining} Declining (↓10%+)
          </span>
        </div>
      </Card>

      {/* Time to Complete Estimator */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PerformanceLeaderboard profiles={profiles} workers={workers} />
        </div>
        <TimeToCompleteEstimator
          targetBoxes={targetBoxes}
          profiles={profiles}
          presentWorkerIds={presentWorkerIds}
          benchmark={globalBenchmark}
        />
      </div>

      {/* Main Content - Cards or Table View */}
      {viewMode === 'table' ? (
        <WorkerIntelligenceTable
          profiles={profiles}
          workers={workers.map(w => ({ id: w.id, full_name: w.full_name, role: w.role, status: w.status }))}
          onWorkerClick={handleWorkerClick}
        />
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Workers</TabsTrigger>
            <TabsTrigger value="speed">By Speed</TabsTrigger>
            <TabsTrigger value="quality">By Quality</TabsTrigger>
            <TabsTrigger value="improving">Improving</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center">
                    <User className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      No skill profiles yet. Worker metrics will appear after production activity.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Profiles are calculated automatically from output recordings with worker attribution.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                profiles.map(profile => (
                  <WorkerProfileCard 
                    key={profile.id} 
                    profile={profile}
                    workerName={workerMap.get(profile.worker_id)?.full_name || 'Unknown Worker'}
                    workerRole={workerMap.get(profile.worker_id)?.role}
                    officeBenchmarks={officeBenchmarks}
                    benchmark={globalBenchmark}
                    onViewDetails={() => handleWorkerClick(profile.worker_id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="speed">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...profiles]
                .sort((a, b) => (b.speed_score || 0) - (a.speed_score || 0))
                .map(profile => (
                  <WorkerProfileCard 
                    key={profile.id} 
                    profile={profile}
                    workerName={workerMap.get(profile.worker_id)?.full_name || 'Unknown Worker'}
                    workerRole={workerMap.get(profile.worker_id)?.role}
                    officeBenchmarks={officeBenchmarks}
                    benchmark={globalBenchmark}
                    onViewDetails={() => handleWorkerClick(profile.worker_id)}
                  />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="quality">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...profiles]
                .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
                .map(profile => (
                  <WorkerProfileCard 
                    key={profile.id} 
                    profile={profile}
                    workerName={workerMap.get(profile.worker_id)?.full_name || 'Unknown Worker'}
                    workerRole={workerMap.get(profile.worker_id)?.role}
                    officeBenchmarks={officeBenchmarks}
                    benchmark={globalBenchmark}
                    onViewDetails={() => handleWorkerClick(profile.worker_id)}
                  />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="improving">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {profiles.filter(p => 
                p.trend_speed === 'improving' || p.trend_quality === 'improving'
              ).length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="py-8 text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      No workers currently showing improvement trends.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Trends are calculated by comparing last 7 days vs previous 7 days.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                profiles
                  .filter(p => p.trend_speed === 'improving' || p.trend_quality === 'improving')
                  .map(profile => (
                    <WorkerProfileCard 
                      key={profile.id} 
                      profile={profile}
                      workerName={workerMap.get(profile.worker_id)?.full_name || 'Unknown Worker'}
                      workerRole={workerMap.get(profile.worker_id)?.role}
                      officeBenchmarks={officeBenchmarks}
                      benchmark={globalBenchmark}
                      onViewDetails={() => handleWorkerClick(profile.worker_id)}
                    />
                  ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Worker Profile Dialog */}
      <WorkerProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        profile={selectedProfile || null}
        worker={selectedWorker || null}
        benchmark={globalBenchmark}
        officeBenchmarks={officeBenchmarks}
        officeId={officeId}
      />
    </div>
  );
}