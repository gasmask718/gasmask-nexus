/**
 * Observation Dashboard - Phase 4.5 UI
 * Shows automation readiness, behavioral patterns, and task previews
 * 
 * This is the "instrumented learning" view where humans can see
 * what the system is learning without it taking autonomous action.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Eye, 
  Brain, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Zap,
  Activity,
  BarChart3,
  RefreshCw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  getObservationStats,
  getRecentObservations,
  getFloorAutomationReadiness,
  detectBehavioralPatterns,
  type AutomationReadinessScore,
  type TaskObservation,
} from '@/services/taskGovernance/observationService';
import type { FloorId } from '@/services/taskGovernance/types';

interface ObservationDashboardProps {
  floorId?: FloorId;
}

export function ObservationDashboard({ floorId }: ObservationDashboardProps) {
  const [selectedTab, setSelectedTab] = useState('overview');

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['observation-stats', floorId],
    queryFn: () => getObservationStats(floorId),
    refetchInterval: 30000,
  });

  const { data: observations, isLoading: obsLoading } = useQuery({
    queryKey: ['recent-observations', floorId],
    queryFn: () => getRecentObservations({ floorId, limit: 50 }),
    refetchInterval: 10000,
  });

  const { data: readinessScores } = useQuery({
    queryKey: ['automation-readiness', floorId],
    queryFn: () => floorId ? getFloorAutomationReadiness(floorId) : Promise.resolve([]),
    enabled: !!floorId,
  });

  const { data: patterns } = useQuery({
    queryKey: ['behavioral-patterns', floorId],
    queryFn: () => detectBehavioralPatterns(floorId),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Eye className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Observation Mode</h2>
            <p className="text-sm text-muted-foreground">
              Phase 4.5 — Learning from human decisions
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
          <Eye className="h-3 w-3 mr-1" />
          Shadow Mode Active
        </Badge>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Total Observations"
          value={stats?.totalObservations || 0}
          icon={Activity}
          loading={statsLoading}
        />
        <StatsCard
          title="Decisions Recorded"
          value={stats?.decisionsRecorded || 0}
          icon={CheckCircle2}
          loading={statsLoading}
        />
        <StatsCard
          title="Approval Rate"
          value={`${stats?.approvalRate || 0}%`}
          icon={TrendingUp}
          loading={statsLoading}
        />
        <StatsCard
          title="Avg Decision Time"
          value={formatLatency(stats?.averageLatencyMs || 0)}
          icon={Clock}
          loading={statsLoading}
        />
      </div>

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="readiness">Automation Readiness</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* What the system is learning */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  What the System is Learning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <LearningItem 
                  label="Task types observed"
                  value={stats?.taskTypesObserved || 0}
                />
                <LearningItem 
                  label="Human approval patterns"
                  value={`${stats?.approvalRate || 0}% approval rate`}
                />
                <LearningItem 
                  label="Decision confidence"
                  value={formatLatency(stats?.averageLatencyMs || 0) + ' avg decision time'}
                />
                <LearningItem 
                  label="Behavioral patterns"
                  value={`${patterns?.length || 0} patterns detected`}
                />
              </CardContent>
            </Card>

            {/* Safety Guarantees */}
            <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Safety Guarantees
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>No tasks are auto-executed</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>No approvals are skipped</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Full human authority retained</span>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All previews before action</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="readiness" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Automation Readiness Scores
              </CardTitle>
              <CardDescription>
                Based on observed human behavior, these scores indicate how safe
                it would be to automate each task type in the future.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {readinessScores && readinessScores.length > 0 ? (
                <div className="space-y-4">
                  {readinessScores.map((score) => (
                    <ReadinessScoreCard key={score.task_type} score={score} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No automation readiness data yet.</p>
                  <p className="text-sm">Continue using the system to build evidence.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Detected Behavioral Patterns
              </CardTitle>
              <CardDescription>
                Patterns identified from human task decisions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {patterns && patterns.length > 0 ? (
                <div className="space-y-4">
                  {patterns.map((pattern, idx) => (
                    <PatternCard key={idx} pattern={pattern} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No patterns detected yet.</p>
                  <p className="text-sm">More data is needed to identify patterns.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Observation Activity</CardTitle>
                <CardDescription>Recent task observations</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => refetchStats()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {obsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading observations...
                  </div>
                ) : observations && observations.length > 0 ? (
                  <div className="space-y-2">
                    {observations.map((obs) => (
                      <ObservationRow key={obs.id} observation={obs} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No observations recorded yet.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= SUB-COMPONENTS =============

function StatsCard({ 
  title, 
  value, 
  icon: Icon,
  loading 
}: { 
  title: string; 
  value: string | number;
  icon: React.ElementType;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {loading ? '...' : value}
            </p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  );
}

function LearningItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ReadinessScoreCard({ score }: { score: AutomationReadinessScore }) {
  const levelColors = {
    'not_ready': 'bg-red-100 text-red-700',
    'low': 'bg-orange-100 text-orange-700',
    'medium': 'bg-yellow-100 text-yellow-700',
    'high': 'bg-blue-100 text-blue-700',
    'ready': 'bg-green-100 text-green-700',
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{score.task_type}</p>
          <p className="text-xs text-muted-foreground">{score.floor_id}</p>
        </div>
        <Badge className={levelColors[score.readiness_level]}>
          {score.readiness_level.replace('_', ' ')}
        </Badge>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Readiness Score</span>
          <span>{score.readiness_score}/100</span>
        </div>
        <Progress value={score.readiness_score} className="h-2" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-muted-foreground">Approval Rate:</span>{' '}
          <span className="font-medium">{score.approval_rate}%</span>
        </div>
        <div>
          <span className="text-muted-foreground">Dry-Run Pass:</span>{' '}
          <span className="font-medium">{score.dry_run_pass_rate}%</span>
        </div>
        <div>
          <span className="text-muted-foreground">Observations:</span>{' '}
          <span className="font-medium">{score.total_observations}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Override Rate:</span>{' '}
          <span className="font-medium">{score.human_override_rate}%</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        {score.recommendation}
      </p>
    </div>
  );
}

function PatternCard({ pattern }: { pattern: { 
  pattern_type: string; 
  description: string; 
  frequency: number; 
  task_types: string[] 
}}) {
  const patternIcons: Record<string, React.ElementType> = {
    'always_approved': CheckCircle2,
    'high_cancellation': XCircle,
    'default': AlertTriangle,
  };

  const Icon = patternIcons[pattern.pattern_type] || patternIcons.default;

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
        <div className="flex-1">
          <p className="font-medium">{pattern.pattern_type.replace(/_/g, ' ')}</p>
          <p className="text-sm text-muted-foreground">{pattern.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {pattern.task_types.slice(0, 5).map(type => (
              <Badge key={type} variant="secondary" className="text-xs">
                {type}
              </Badge>
            ))}
            {pattern.task_types.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{pattern.task_types.length - 5} more
              </Badge>
            )}
          </div>
        </div>
        <Badge variant="outline">{pattern.frequency}x</Badge>
      </div>
    </div>
  );
}

function ObservationRow({ observation }: { observation: TaskObservation }) {
  const typeIcons: Record<string, React.ElementType> = {
    'task_created': Activity,
    'task_started': Zap,
    'decision_made': CheckCircle2,
    'task_completed': CheckCircle2,
    'task_cancelled': XCircle,
    'task_failed': AlertTriangle,
    'default': Eye,
  };

  const Icon = typeIcons[observation.observation_type] || typeIcons.default;

  return (
    <div className="flex items-center gap-3 py-2 border-b last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{observation.task_type}</p>
        <p className="text-xs text-muted-foreground">{observation.observation_type}</p>
      </div>
      {observation.decision && (
        <Badge variant="outline" className="text-xs">
          {observation.decision}
        </Badge>
      )}
      <span className="text-xs text-muted-foreground">
        {formatTimeAgo(observation.created_at)}
      </span>
    </div>
  );
}

// ============= HELPERS =============

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}
