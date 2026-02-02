// Floor 9 - AI Operations Results (Authoritative Outcomes Ledger)
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
              Learning Feedback
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

export default Floor9Results;
