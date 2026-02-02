import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  Clock,
  DollarSign,
  Shield,
  CheckCircle,
  AlertTriangle,
  Brain,
  Users,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerformanceResults, useWorkforceStats } from '@/hooks/useFloor9';

const Floor9Results = () => {
  const { data: results, isLoading: resultsLoading } = usePerformanceResults({ days: 30 });
  const { data: stats, isLoading: statsLoading } = useWorkforceStats();

  // Aggregate metrics
  const totalAutoResolved = results?.reduce((sum, r) => sum + r.tasks_auto_resolved, 0) || 0;
  const totalEscalated = results?.reduce((sum, r) => sum + r.tasks_escalated, 0) || 0;
  const totalTimeSaved = results?.reduce((sum, r) => sum + r.time_saved_minutes, 0) || 0;
  const totalRevenueProtected = results?.reduce((sum, r) => sum + r.revenue_protected, 0) || 0;
  const totalRevenueGenerated = results?.reduce((sum, r) => sum + r.revenue_generated, 0) || 0;
  const avgTrustScore = results?.length
    ? results.reduce((sum, r) => sum + r.human_trust_score, 0) / results.length
    : 0;

  const autoResolveRate = totalAutoResolved + totalEscalated > 0
    ? Math.round((totalAutoResolved / (totalAutoResolved + totalEscalated)) * 100)
    : 0;

  const isLoading = resultsLoading || statsLoading;

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
            Measure whether AI is worth existing — ROI & Trust Metrics
          </p>
        </div>

        {/* Governance Notice */}
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-green-500 mt-0.5" />
            <div>
              <p className="font-medium">If AI Cannot Prove Value, It Does Not Scale</p>
              <p className="text-sm text-muted-foreground">
                These metrics track time saved vs human baseline, error reduction, revenue impact,
                and human trust indicators. Performance must be provable before expanding autonomy.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
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
                    {Math.round(totalTimeSaved / 60)}h {totalTimeSaved % 60}m
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
                    <p className="text-sm text-muted-foreground">Auto-Resolve Rate</p>
                    <CheckCircle className="h-5 w-5 text-blue-500" />
                  </div>
                  <p className="text-3xl font-bold">{autoResolveRate}%</p>
                  <Progress value={autoResolveRate} className="h-2 mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalAutoResolved} auto / {totalEscalated} escalated
                  </p>
                </CardContent>
              </Card>

              <Card className="border-yellow-500/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Revenue Protected</p>
                    <DollarSign className="h-5 w-5 text-yellow-500" />
                  </div>
                  <p className="text-3xl font-bold">${totalRevenueProtected.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    + ${totalRevenueGenerated.toLocaleString()} generated
                  </p>
                </CardContent>
              </Card>

              <Card className="border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-muted-foreground">Human Trust Score</p>
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-3xl font-bold">{Math.round(avgTrustScore)}%</p>
                  <Progress value={avgTrustScore} className="h-2 mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on feedback acceptance rate
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Workforce Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Workforce Summary
              </CardTitle>
              <CardDescription>Current AI worker status</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Workers</span>
                    <span className="font-bold">{stats?.total_workers || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Active
                    </span>
                    <span className="font-bold text-green-500">{stats?.active_workers || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      Busy
                    </span>
                    <span className="font-bold text-yellow-500">{stats?.busy_workers || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      Sleeping
                    </span>
                    <span className="font-bold">{stats?.sleeping_workers || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Error
                    </span>
                    <span className="font-bold text-red-500">{stats?.error_workers || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Task Summary
              </CardTitle>
              <CardDescription>All-time task statistics</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Tasks</span>
                    <span className="font-bold">{stats?.total_tasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      Completed
                    </span>
                    <span className="font-bold text-green-500">{stats?.completed_tasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      Pending
                    </span>
                    <span className="font-bold text-yellow-500">{stats?.pending_tasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      Processing
                    </span>
                    <span className="font-bold text-blue-500">{stats?.processing_tasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      Failed
                    </span>
                    <span className="font-bold text-red-500">{stats?.failed_tasks || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500" />
                      Escalated
                    </span>
                    <span className="font-bold text-orange-500">{stats?.escalated_tasks || 0}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                <h4 className="font-medium">Execute</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  AI can execute workflows and routines
                </p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
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
          </CardContent>
        </Card>
      </div>
    </GrabbaLayout>
  );
};

export default Floor9Results;
