// Floor 9 - AI Operations Results (Authoritative Outcomes Ledger)
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Shield,
  CheckCircle,
  Brain,
  Users,
  ArrowUp,
  Activity,
  FileText,
  XCircle,
  AlertTriangle,
  Undo2,
  BarChart3,
  Trophy,
  MapPin,
  Loader2,
  Navigation,
  Newspaper,
  ExternalLink,
} from 'lucide-react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { subDays } from 'date-fns';
import { 
  useAIResults, 
  useResultsMetrics, 
  useTaskTypes, 
  useEntityTypes,
  AIResultFilters 
} from '@/hooks/useAIResults';
import { 
  ShadowModeBanner,
  ImmutableLogNotice,
  PersistedDriftMonitor,
  ResultDetailDrawer,
  ResultsFilters,
  ResultsTimeline,
  ResultsAnalytics,
  FeedbackAnalyticsPanel,
} from '@/components/floor9';
import { usePerformanceLeaderboard } from '@/hooks/usePerformanceLeaderboard';
import { useLatestBriefing, useAllBriefings, useGenerateBriefing } from '@/hooks/useWeeklyBriefing';
import { useRouteOptimizer, buildGoogleMapsUrl } from '@/hooks/useRouteOptimizer';
import { supabase } from '@/integrations/supabase/client';

const Floor9Results = () => {
  // Filters state with sensible defaults
  const [filters, setFilters] = useState<AIResultFilters>({
    dateRange: { from: subDays(new Date(), 30), to: new Date() },
    limit: 100,
  });
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');

  // Data queries
  const { data: results, isLoading: resultsLoading, refetch: refetchResults } = useAIResults(filters);
  const { data: metrics, isLoading: metricsLoading } = useResultsMetrics(30);
  const { data: taskTypes } = useTaskTypes();
  const { data: entityTypes } = useEntityTypes();

  const handleResultClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setDrawerOpen(true);
  }, []);

  const handleFiltersChange = useCallback((newFilters: AIResultFilters) => {
    setFilters(newFilters);
  }, []);

  const isLoading = resultsLoading || metricsLoading;

  // Calculate time saved display
  const timeSavedHours = metrics ? Math.floor(metrics.totalTimeSavedMinutes / 60) : 0;
  const timeSavedMins = metrics ? metrics.totalTimeSavedMinutes % 60 : 0;

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            AI Performance Results
          </h1>
          <p className="text-muted-foreground mt-1">
            What has the AI actually done, what changed, and was it worth it?
          </p>
        </div>

        {/* Shadow Mode Banner */}
        <ShadowModeBanner />

        {/* Governance Notice */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">If AI Cannot Prove Value, It Does Not Scale</p>
              <p className="text-sm text-muted-foreground">
                This ledger shows every finalized AI outcome — completions, failures, rollbacks, and human decisions.
                It is <strong>read-only, immutable, and audit-grade</strong>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Results Overview Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {isLoading ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <Card className="border-primary/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Total Tasks</p>
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold">{metrics?.totalTasks || 0}</p>
                </CardContent>
              </Card>

              <Card className="border-green-500/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold text-green-600">{metrics?.completedTasks || 0}</p>
                </CardContent>
              </Card>

              <Card className="border-red-500/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-red-600">{metrics?.failedTasks || 0}</p>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Awaiting Approval</p>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">{metrics?.awaitingApproval || 0}</p>
                </CardContent>
              </Card>

              <Card className="border-purple-500/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Rolled Back</p>
                    <Undo2 className="h-4 w-4 text-purple-500" />
                  </div>
                  <p className="text-2xl font-bold text-purple-600">{metrics?.rolledBackTasks || 0}</p>
                </CardContent>
              </Card>

              <Card className="border-blue-500/20">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">Artifacts</p>
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{metrics?.artifactsGenerated || 0}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {isLoading ? (
            [...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)
          ) : (
            <>
              <Card className="border-green-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Time Saved</p>
                    <Clock className="h-5 w-5 text-green-500" />
                  </div>
                  <p className="text-3xl font-bold">
                    {timeSavedHours}h {timeSavedMins}m
                  </p>
                  <p className="text-sm text-green-500 flex items-center mt-1">
                    <ArrowUp className="h-3 w-3 mr-1" />
                    vs. human baseline
                  </p>
                </CardContent>
              </Card>

              <Card className="border-blue-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Human Acceptance Rate</p>
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold">{metrics?.humanAcceptanceRate || 0}%</p>
                  <Progress value={metrics?.humanAcceptanceRate || 0} className="h-2 mt-2" />
                </CardContent>
              </Card>

              <Card className="border-red-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Human Rejection Rate</p>
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <p className="text-3xl font-bold">{metrics?.humanRejectionRate || 0}%</p>
                  <Progress value={metrics?.humanRejectionRate || 0} className="h-2 mt-2 [&>div]:bg-red-500" />
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Avg AI Confidence</p>
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-3xl font-bold">{metrics?.avgConfidence || 0}%</p>
                  <Progress value={metrics?.avgConfidence || 0} className="h-2 mt-2" />
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Confidence Drift Monitoring */}
        <div className="border-2 border-primary/30 rounded-lg p-1">
          <div className="bg-primary/5 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Confidence Drift Monitoring</h2>
              <Badge variant="outline" className="ml-2">Phase 9.1 — Safety Critical</Badge>
            </div>
            <PersistedDriftMonitor />
          </div>
        </div>

        {/* Filters */}
        <ResultsFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          taskTypes={taskTypes || []}
          entityTypes={entityTypes || []}
          isLoading={resultsLoading}
          onRefresh={() => refetchResults()}
        />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="learning" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Learning
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="briefing" className="flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              Briefing
            </TabsTrigger>
            <TabsTrigger value="routes" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Routes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" className="mt-4">
            <ResultsTimeline
              results={results || []}
              isLoading={resultsLoading}
              onResultClick={handleResultClick}
            />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <ResultsAnalytics
              results={results || []}
              metrics={metrics || null}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="learning" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FeedbackAnalyticsPanel days={30} />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    How Learning Works
                  </CardTitle>
                  <CardDescription>
                    The feedback loop that makes AI smarter
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <p className="font-medium">AI Makes Recommendation</p>
                      <p className="text-sm text-muted-foreground">With confidence score and reasoning</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <p className="font-medium">Human Reviews & Decides</p>
                      <p className="text-sm text-muted-foreground">Approve, reject, or modify with reasoning</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <p className="font-medium">Feedback Captured</p>
                      <p className="text-sm text-muted-foreground">Category, reasoning, confidence signals</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-bold text-green-600">4</div>
                    <div>
                      <p className="font-medium text-green-600">Patterns Aggregated</p>
                      <p className="text-sm text-muted-foreground">System learns what works and what doesn't</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-bold text-green-600">5</div>
                    <div>
                      <p className="font-medium text-green-600">Confidence Recalibrated</p>
                      <p className="text-sm text-muted-foreground">AI adjusts future confidence thresholds</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <TeamPerformanceTab />
          </TabsContent>

          <TabsContent value="briefing" className="mt-4">
            <WeeklyBriefingTab />
          </TabsContent>

          <TabsContent value="routes" className="mt-4">
            <RouteOptimizerTab />
          </TabsContent>
        </Tabs>

        {/* AI Value Proposition */}
        <Card>
          <CardHeader>
            <CardTitle>AI Value Proposition</CardTitle>
            <CardDescription>
              Can we say: "Run my business like my best operator — and show me everything you did"?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <h4 className="font-medium">Answer</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  AI can answer complex business questions
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <Shield className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                <h4 className="font-medium">Recommend</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  AI recommends — humans execute (Shadow Mode)
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <h4 className="font-medium">Audit</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Every action is logged and explainable
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                <h4 className="font-medium">Improve</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  AI learns from human feedback
                </p>
              </div>
            </div>
            <ImmutableLogNotice />
          </CardContent>
        </Card>

        {/* Result Detail Drawer */}
        <ResultDetailDrawer
          taskId={selectedTaskId}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      </div>
    </GrabbaLayout>
  );
};

// ─── Team Performance Tab ───
function TeamPerformanceTab() {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const { data: leaderboard, isLoading } = usePerformanceLeaderboard(range);

  const rankIcons = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Performance by Person Type
        </h3>
        <Select value={range} onValueChange={(v: any) => setRange(v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {leaderboard?.map((rep, index) => (
            <Card key={rep.person_type} className={index === 0 ? 'border-primary/30' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{rankIcons[index] || '🎯'}</span>
                    <div>
                      <h4 className="text-lg font-bold capitalize">{rep.person_type}</h4>
                      <p className="text-sm text-muted-foreground">Score: {rep.total_score}</p>
                    </div>
                  </div>
                  {index === 0 && (
                    <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                      <Trophy className="h-3 w-3 mr-1" /> Top Performer
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-4">
                  {[
                    { label: 'Stores', value: rep.stores_visited },
                    { label: 'Tubes', value: rep.tube_counts_recorded },
                    { label: 'Interested', value: rep.interested_signals },
                    { label: 'Tasks', value: rep.tasks_completed },
                    { label: 'Notes', value: rep.notes_written },
                  ].map(m => (
                    <div key={m.label} className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-xl font-bold">{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weekly Briefing Tab ───
function WeeklyBriefingTab() {
  const { data: latestBriefing } = useLatestBriefing();
  const { data: allBriefings } = useAllBriefings();
  const generateBriefing = useGenerateBriefing();
  const [selectedBriefingText, setSelectedBriefingText] = useState<string | null>(null);

  const displayBriefing = selectedBriefingText || latestBriefing?.briefing_text;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-primary" />
            Dynasty Weekly Intelligence Briefing
          </h3>
          {latestBriefing && (
            <p className="text-sm text-muted-foreground">
              Last generated: {new Date(latestBriefing.created_at).toLocaleDateString()}
            </p>
          )}
        </div>
        <Button
          onClick={() => generateBriefing.mutate()}
          disabled={generateBriefing.isPending}
        >
          {generateBriefing.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Newspaper className="h-4 w-4 mr-2" />}
          {generateBriefing.isPending ? 'Generating...' : 'Generate Now'}
        </Button>
      </div>

      {displayBriefing ? (
        <Card>
          <CardContent className="pt-6">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {displayBriefing}
            </pre>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Newspaper className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h4 className="font-medium">No briefing generated yet.</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Click "Generate Now" to create your first weekly intelligence briefing.
            </p>
          </CardContent>
        </Card>
      )}

      {allBriefings && allBriefings.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Previous Briefings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allBriefings.slice(1, 10).map((b: any) => (
                <Button
                  key={b.id}
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={async () => {
                    const { data } = await (supabase.from('weekly_briefings') as any).select('briefing_text').eq('id', b.id).single();
                    if (data) setSelectedBriefingText(data.briefing_text);
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Week of {b.week_start} — {new Date(b.created_at).toLocaleDateString()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Route Optimizer Tab ───
function RouteOptimizerTab() {
  const [personType, setPersonType] = useState<'drivers' | 'bikers' | 'ambassadors'>('drivers');
  const { data: route, isLoading } = useRouteOptimizer(personType);

  const mapsUrl = route?.length ? buildGoogleMapsUrl(route) : '';

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500/20 text-green-600">Healthy</Badge>;
    if (score >= 60) return <Badge className="bg-amber-500/20 text-amber-600">Attention</Badge>;
    if (score >= 40) return <Badge className="bg-orange-500/20 text-orange-600">At Risk</Badge>;
    return <Badge variant="destructive">Critical</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          Route Optimizer
        </h3>
        <Select value={personType} onValueChange={(v: any) => setPersonType(v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="drivers">Drivers</SelectItem>
            <SelectItem value="bikers">Bikers</SelectItem>
            <SelectItem value="ambassadors">Ambassadors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Stores ranked by urgency — lowest health scores first
      </p>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : !route?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            No stores need urgent visits right now.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {route.slice(0, 10).map((store, i) => (
              <Card key={store.id}>
                <CardContent className="py-3 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{store.store_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{store.full_address}</p>
                  </div>
                  {getHealthBadge(store.health_score)}
                </CardContent>
              </Card>
            ))}
          </div>
          {mapsUrl && (
            <Button className="w-full" onClick={() => window.open(mapsUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Route in Google Maps
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default Floor9Results;
