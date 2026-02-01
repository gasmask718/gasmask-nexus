/**
 * WORKER PERFORMANCE TAB
 * 
 * Displays skill profiles for workers with:
 * - Speed/Quality/Reliability scores
 * - Trend indicators
 * - Rolling metrics (7/30/90 day)
 * - Performance comparison
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useWorkerSkillProfiles, 
  useProductionWorkers,
  WorkerSkillProfile 
} from '@/hooks/useWorkerPerformance';
import { 
  User, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Zap,
  Shield,
  Clock,
  Target,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkerPerformanceProps {
  officeId: string;
}

const TREND_ICONS = {
  improving: <TrendingUp className="h-3 w-3 text-emerald-500" />,
  stable: <Minus className="h-3 w-3 text-muted-foreground" />,
  declining: <TrendingDown className="h-3 w-3 text-red-500" />,
};

const SCORE_COLORS = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-red-500',
};

function getScoreColor(score: number): string {
  if (score >= 70) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Average';
  if (score >= 20) return 'Needs Work';
  return 'Critical';
}

interface WorkerCardProps {
  profile: WorkerSkillProfile;
  workerName: string;
}

function WorkerCard({ profile, workerName }: WorkerCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">{workerName}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Overall: {getScoreLabel(profile.overall_score || 50)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm font-semibold">
            <span className={cn(
              "text-lg",
              (profile.overall_score || 50) >= 60 ? "text-emerald-600" : 
              (profile.overall_score || 50) >= 40 ? "text-amber-600" : "text-red-600"
            )}>
              {profile.overall_score || 50}
            </span>
            <span className="text-muted-foreground text-xs">/100</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Skill Bars */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-xs w-16">Speed</span>
            <Progress 
              value={profile.speed_score || 50} 
              className="flex-1 h-2"
            />
            <span className="text-xs w-8 text-right">{profile.speed_score || 50}</span>
            {TREND_ICONS[profile.trend_speed || 'stable']}
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-3 w-3 text-blue-500" />
            <span className="text-xs w-16">Quality</span>
            <Progress 
              value={profile.quality_score || 50} 
              className="flex-1 h-2"
            />
            <span className="text-xs w-8 text-right">{profile.quality_score || 50}</span>
            {TREND_ICONS[profile.trend_quality || 'stable']}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-purple-500" />
            <span className="text-xs w-16">Reliability</span>
            <Progress 
              value={profile.reliability_score || 50} 
              className="flex-1 h-2"
            />
            <span className="text-xs w-8 text-right">{profile.reliability_score || 50}</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Boxes/Hr</p>
            <p className="text-sm font-medium">
              {profile.boxes_per_hour?.toFixed(1) || '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Defect Rate</p>
            <p className="text-sm font-medium">
              {profile.defect_rate_per_thousand != null 
                ? `${profile.defect_rate_per_thousand.toFixed(1)}‰` 
                : '—'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">7d Boxes</p>
            <p className="text-sm font-medium">
              {profile.rolling_7_day_boxes || 0}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceLeaderboard({ profiles, workers }: { 
  profiles: WorkerSkillProfile[]; 
  workers: { id: string; full_name: string }[] 
}) {
  const workerMap = new Map(workers.map(w => [w.id, w.full_name]));
  const sorted = [...profiles].sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  const top = sorted.slice(0, 3);
  const needsAttention = sorted.filter(p => (p.overall_score || 50) < 40);

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
          {needsAttention.length === 0 ? (
            <p className="text-sm text-muted-foreground">All workers performing well</p>
          ) : (
            <div className="space-y-2">
              {needsAttention.map(profile => (
                <div key={profile.id} className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">
                    {workerMap.get(profile.worker_id) || 'Unknown'}
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    {profile.overall_score || 50}
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

export function WorkerPerformance({ officeId }: WorkerPerformanceProps) {
  const { data: profiles = [], isLoading: profilesLoading } = useWorkerSkillProfiles(officeId);
  const { data: workers = [], isLoading: workersLoading } = useProductionWorkers(officeId);

  const isLoading = profilesLoading || workersLoading;
  const workerMap = new Map(workers.map(w => [w.id, w.full_name]));

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Worker Performance
          </h2>
          <p className="text-sm text-muted-foreground">
            Skill profiles derived from production activity
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {profiles.length} workers tracked
        </Badge>
      </div>

      {/* Leaderboard Summary */}
      <PerformanceLeaderboard profiles={profiles} workers={workers} />

      {/* Worker Grid */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Workers</TabsTrigger>
          <TabsTrigger value="speed">By Speed</TabsTrigger>
          <TabsTrigger value="quality">By Quality</TabsTrigger>
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
                </CardContent>
              </Card>
            ) : (
              profiles.map(profile => (
                <WorkerCard 
                  key={profile.id} 
                  profile={profile}
                  workerName={workerMap.get(profile.worker_id) || 'Unknown Worker'}
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
                <WorkerCard 
                  key={profile.id} 
                  profile={profile}
                  workerName={workerMap.get(profile.worker_id) || 'Unknown Worker'}
                />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="quality">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...profiles]
              .sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0))
              .map(profile => (
                <WorkerCard 
                  key={profile.id} 
                  profile={profile}
                  workerName={workerMap.get(profile.worker_id) || 'Unknown Worker'}
                />
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
