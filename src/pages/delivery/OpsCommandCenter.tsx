// ═══════════════════════════════════════════════════════════════════════════════
// OPS COMMAND CENTER — Floor 4 Phase 3.5
// Decision-ready command views for Ops, Managers, and Executives
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  AlertTriangle, 
  Clock, 
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Shield,
  Activity,
  Target,
  BarChart3,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Radio,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAlertStats, useOpenAlerts } from "@/hooks/useDeliveryAlerts";
import { useAllWorkerPerformance } from "@/hooks/useRouteAnalytics";
import { useFloor4PendingActions, useFloor4PlaybookStats } from "@/hooks/useFloor4Playbook";
import { useAllActiveBlocks } from "@/hooks/useAutonomyGuardrails";
import { useComputationStats } from "@/hooks/useAutoAnalytics";
import { PlaybookActionsPanel } from "@/components/delivery/PlaybookActionsPanel";
import { AutonomyGuardrailsPanel } from "@/components/delivery/AutonomyGuardrailsPanel";
import { AlertsPanel } from "@/components/delivery/AlertsPanel";
import { WorkerPerformanceCard } from "@/components/delivery/WorkerPerformanceCard";

export default function OpsCommandCenter() {
  const [activeView, setActiveView] = useState<'ops' | 'manager' | 'executive'>('ops');
  
  // Data hooks
  const { data: alertStats } = useAlertStats();
  const { data: openAlerts } = useOpenAlerts();
  const { data: workers } = useAllWorkerPerformance();
  const { data: pendingActions } = useFloor4PendingActions();
  const { data: playbookStats } = useFloor4PlaybookStats();
  const { data: activeBlocks } = useAllActiveBlocks();
  const { data: computationStats } = useComputationStats();
  
  // Active routes for today
  const { data: todayRoutes, refetch: refetchRoutes } = useQuery({
    queryKey: ['today-routes-command'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('routes')
        .select(`
          *,
          assignee:profiles!routes_assigned_to_fkey(id, name, role)
        `)
        .eq('date', today);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
  
  // Compute metrics
  const routesAtRisk = todayRoutes?.filter(r => 
    r.status === 'in_progress' && 
    r.route_state !== 'completed'
  ).length || 0;
  
  const workersNeedingIntervention = workers?.filter(w => 
    w.trend_direction === 'declining' || 
    w.requires_training
  ).length || 0;
  
  const autoEligibleRate = workers?.length 
    ? Math.round((workers.filter(w => w.autonomy_level === 'auto_eligible').length / workers.length) * 100)
    : 0;
  
  const systemHealthScore = Math.round(
    100 - 
    ((alertStats?.critical || 0) * 10) - 
    ((alertStats?.slaBreached || 0) * 5) -
    (workersNeedingIntervention * 3)
  );
  
  return (
    <Layout>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Ops Command Center</h1>
            <p className="text-muted-foreground">
              Phase 3.5 • Intelligence & Decision Compression
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1">
              <Radio className="h-3 w-3 text-green-500 animate-pulse" />
              Live
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetchRoutes()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* View Selector */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <TabsList>
            <TabsTrigger value="ops">
              <Activity className="h-4 w-4 mr-2" />
              Ops Command
            </TabsTrigger>
            <TabsTrigger value="manager">
              <Users className="h-4 w-4 mr-2" />
              Worker Intelligence
            </TabsTrigger>
            <TabsTrigger value="executive">
              <BarChart3 className="h-4 w-4 mr-2" />
              Executive Snapshot
            </TabsTrigger>
          </TabsList>
          
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* OPS COMMAND VIEW */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="ops" className="space-y-6">
            {/* Quick Decision Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className={routesAtRisk > 0 ? 'border-orange-500/50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Routes at Risk</p>
                      <p className={`text-2xl font-bold ${routesAtRisk > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                        {routesAtRisk}
                      </p>
                    </div>
                    <AlertTriangle className={`h-8 w-8 ${routesAtRisk > 0 ? 'text-orange-500' : 'text-muted'}`} />
                  </div>
                </CardContent>
              </Card>
              
              <Card className={workersNeedingIntervention > 0 ? 'border-red-500/50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Need Intervention</p>
                      <p className={`text-2xl font-bold ${workersNeedingIntervention > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {workersNeedingIntervention}
                      </p>
                    </div>
                    <Users className={`h-8 w-8 ${workersNeedingIntervention > 0 ? 'text-red-500' : 'text-muted'}`} />
                  </div>
                </CardContent>
              </Card>
              
              <Card className={alertStats?.total && alertStats.total > 0 ? 'border-red-500/50' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Alerts</p>
                      <p className={`text-2xl font-bold ${(alertStats?.total || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {alertStats?.total || 0}
                      </p>
                    </div>
                    <AlertTriangle className={`h-8 w-8 ${(alertStats?.total || 0) > 0 ? 'text-red-500' : 'text-muted'}`} />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Actions</p>
                      <p className="text-2xl font-bold text-primary">
                        {pendingActions?.length || 0}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Main Ops Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AlertsPanel />
              <PlaybookActionsPanel />
            </div>
          </TabsContent>
          
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* MANAGER / WORKER INTELLIGENCE VIEW */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="manager" className="space-y-6">
            {/* Worker Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Workers</p>
                      <p className="text-2xl font-bold">{workers?.length || 0}</p>
                    </div>
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-green-500/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Improving</p>
                      <p className="text-2xl font-bold text-green-500">
                        {workers?.filter(w => w.trend_direction === 'improving').length || 0}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-red-500/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Declining</p>
                      <p className="text-2xl font-bold text-red-500">
                        {workers?.filter(w => w.trend_direction === 'declining').length || 0}
                      </p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Auto-Eligible</p>
                      <p className="text-2xl font-bold text-primary">
                        {workers?.filter(w => w.autonomy_level === 'auto_eligible').length || 0}
                      </p>
                    </div>
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Autonomy Guardrails */}
              <AutonomyGuardrailsPanel />
              
              {/* Worker Leaderboard */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Top Performers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {workers?.slice(0, 10).map((worker) => (
                        <WorkerPerformanceCard 
                          key={worker.id} 
                          performance={worker as any} 
                          compact 
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          {/* EXECUTIVE SNAPSHOT VIEW */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          <TabsContent value="executive" className="space-y-6">
            {/* System Health */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  System Health Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className={`text-6xl font-bold ${
                    systemHealthScore >= 80 ? 'text-green-500' :
                    systemHealthScore >= 60 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {Math.max(0, systemHealthScore)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <Progress value={Math.max(0, systemHealthScore)} className="h-4" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Critical</span>
                      <span>Healthy</span>
                      <span>Optimal</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Auto-Eligible Rate</p>
                  <p className="text-3xl font-bold text-primary">{autoEligibleRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">of workforce</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Alert Volume</p>
                  <p className="text-3xl font-bold">{alertStats?.total || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">active alerts</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">SLA Risk</p>
                  <p className={`text-3xl font-bold ${(alertStats?.slaBreached || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {alertStats?.slaBreached || 0}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">breached</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Blocked Workers</p>
                  <p className="text-3xl font-bold">{activeBlocks?.length || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">manual only</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Workforce Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Workforce Trend Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        Improving
                      </span>
                      <span>{workers?.filter(w => w.trend_direction === 'improving').length || 0}</span>
                    </div>
                    <Progress 
                      value={workers?.length ? (workers.filter(w => w.trend_direction === 'improving').length / workers.length) * 100 : 0} 
                      className="h-2 bg-muted" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-muted-foreground" />
                        Stable
                      </span>
                      <span>{workers?.filter(w => w.trend_direction === 'stable').length || 0}</span>
                    </div>
                    <Progress 
                      value={workers?.length ? (workers.filter(w => w.trend_direction === 'stable').length / workers.length) * 100 : 0} 
                      className="h-2 bg-muted" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        Declining
                      </span>
                      <span>{workers?.filter(w => w.trend_direction === 'declining').length || 0}</span>
                    </div>
                    <Progress 
                      value={workers?.length ? (workers.filter(w => w.trend_direction === 'declining').length / workers.length) * 100 : 0} 
                      className="h-2 bg-muted" 
                    />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>Autonomy Level Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-500" />
                        Auto-Eligible
                      </span>
                      <span>{workers?.filter(w => w.autonomy_level === 'auto_eligible').length || 0}</span>
                    </div>
                    <Progress 
                      value={workers?.length ? (workers.filter(w => w.autonomy_level === 'auto_eligible').length / workers.length) * 100 : 0} 
                      className="h-2 bg-green-500" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        Assisted
                      </span>
                      <span>{workers?.filter(w => w.autonomy_level === 'assisted').length || 0}</span>
                    </div>
                    <Progress 
                      value={workers?.length ? (workers.filter(w => w.autonomy_level === 'assisted').length / workers.length) * 100 : 0} 
                      className="h-2 bg-blue-500" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        Manual Only
                      </span>
                      <span>{workers?.filter(w => w.autonomy_level === 'manual_only').length || 0}</span>
                    </div>
                    <Progress 
                      value={workers?.length ? (workers.filter(w => w.autonomy_level === 'manual_only').length / workers.length) * 100 : 0} 
                      className="h-2 bg-muted" 
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Computation Stats */}
            {computationStats && (
              <Card>
                <CardHeader>
                  <CardTitle>Analytics Engine Status (Today)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{computationStats.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500">{computationStats.successful}</p>
                      <p className="text-xs text-muted-foreground">Success</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-500">{computationStats.failed}</p>
                      <p className="text-xs text-muted-foreground">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-500">{computationStats.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{computationStats.avgDurationMs}ms</p>
                      <p className="text-xs text-muted-foreground">Avg Time</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
