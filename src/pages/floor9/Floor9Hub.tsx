import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Brain,
  AlertTriangle,
  Shield,
  Activity,
  Users,
  ClipboardList,
  Bell,
  Power,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Eye,
  Ban,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useWorkforceStats,
  useAIHealthMetrics,
  useFloor9Tasks,
  useAIWorkers,
  useActionQueue,
  useKillSwitchState,
  useActivateKillSwitch,
  useDeactivateKillSwitch,
} from '@/hooks/useFloor9';
import { useKillSwitchStatus } from '@/hooks/useDriftAlerts';
import { ShadowModeBanner, ShadowModeGovernanceRules } from '@/components/floor9';

const Floor9Hub = () => {
  // Route health check - verifies Floor 9 Hub mounts correctly
  useEffect(() => {
    console.info('[Floor 9] AI Operations Hub mounted successfully at /grabba/floor9');
  }, []);

  const { data: stats, isLoading: statsLoading } = useWorkforceStats();
  const { data: health, isLoading: healthLoading } = useAIHealthMetrics();
  const { data: tasks } = useFloor9Tasks({ status: 'processing', limit: 5 });
  const { data: workers } = useAIWorkers();
  const { data: actionQueue } = useActionQueue({ status: 'pending', limit: 5 });
  const { data: killSwitches } = useKillSwitchState();
  const { data: killSwitchStatus } = useKillSwitchStatus();
  const activateKillSwitch = useActivateKillSwitch();
  const deactivateKillSwitch = useDeactivateKillSwitch();

  const activeKillSwitches = killSwitches?.filter(k => k.is_active) || [];
  const isGlobalKillActive = killSwitchStatus?.globalActive || activeKillSwitches.some(k => k.scope === 'global');

  const handleGlobalKillSwitch = () => {
    if (isGlobalKillActive) {
      const globalSwitch = activeKillSwitches.find(k => k.scope === 'global');
      if (globalSwitch) {
        deactivateKillSwitch.mutate({ switchId: globalSwitch.id });
      }
    } else {
      activateKillSwitch.mutate({
        scope: 'global',
        reason: 'Manual global pause activated from command center',
      });
    }
  };

  const getHealthColor = (value: number) => {
    if (value >= 90) return 'text-green-500';
    if (value >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <GrabbaLayout>
      <div className="space-y-6">
        {/* Header with Kill Switch */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              Floor 9 — AI Operations Hub
            </h1>
            <p className="text-muted-foreground mt-1">
              Enterprise-grade AI workforce command center
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Global Kill Switch */}
            <Card className={`border-2 ${isGlobalKillActive ? 'border-red-500 bg-red-500/10' : 'border-green-500/30'}`}>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <Power className={`h-5 w-5 ${isGlobalKillActive ? 'text-red-500' : 'text-green-500'}`} />
                <div>
                  <p className="text-sm font-medium">Global AI Status</p>
                  <p className={`text-xs ${isGlobalKillActive ? 'text-red-500' : 'text-green-500'}`}>
                    {isGlobalKillActive ? 'PAUSED' : 'ACTIVE (Shadow Mode)'}
                  </p>
                </div>
                <Switch
                  checked={!isGlobalKillActive}
                  onCheckedChange={handleGlobalKillSwitch}
                  disabled={activateKillSwitch.isPending || deactivateKillSwitch.isPending}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* PHASE 9.1: Shadow Mode Banner - Always visible */}
        <ShadowModeBanner />

        {/* Critical Alert Banner */}
        {isGlobalKillActive && (
          <Card className="border-red-500 bg-red-500/10">
            <CardContent className="py-4 flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <div>
                <p className="font-medium text-red-500">Global Kill Switch Active</p>
                <p className="text-sm text-muted-foreground">
                  All AI operations are paused. Toggle the switch above to resume.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PHASE 9.1: Kill Switch Integrity Verification */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Kill Switch Integrity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Global Kill Switch</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isGlobalKillActive ? 'ACTIVE — All AI paused' : 'Ready — Can pause all AI instantly'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Worker-Level Switches</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {killSwitchStatus?.workerKills?.length || activeKillSwitches.filter(k => k.scope === 'worker').length} workers paused
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Playbook-Level Switches</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {killSwitchStatus?.playbookKills?.length || activeKillSwitches.filter(k => k.scope === 'playbook').length} playbooks paused
                </p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Server Enforcement</span>
                </div>
                <p className="text-xs text-green-600">
                  Database trigger blocks AI actions when any kill switch is active
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Health & Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {statsLoading || healthLoading ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <Card className="border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">AI Health</p>
                      <p className={`text-3xl font-bold ${getHealthColor(health?.overall_health || 0)}`}>
                        {health?.overall_health || 0}%
                      </p>
                    </div>
                    <Activity className={`h-10 w-10 ${getHealthColor(health?.overall_health || 0)} opacity-50`} />
                  </div>
                  <Progress value={health?.overall_health || 0} className="mt-2 h-1" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Workers</p>
                      <p className="text-3xl font-bold">{stats?.active_workers || 0}</p>
                    </div>
                    <Users className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats?.busy_workers || 0} busy / {stats?.sleeping_workers || 0} sleeping
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Tasks Today</p>
                      <p className="text-3xl font-bold">{stats?.tasks_today || 0}</p>
                    </div>
                    <ClipboardList className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stats?.processing_tasks || 0} in progress
                  </p>
                </CardContent>
              </Card>

              <Card className={stats?.pending_actions ? 'border-yellow-500/30' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pending Actions</p>
                      <p className="text-3xl font-bold text-yellow-500">{stats?.pending_actions || 0}</p>
                    </div>
                    <Bell className="h-10 w-10 text-yellow-500/50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Awaiting human decision
                  </p>
                </CardContent>
              </Card>

              <Card className={stats?.escalated_tasks ? 'border-red-500/30' : ''}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Escalations</p>
                      <p className="text-3xl font-bold text-red-500">{stats?.escalated_tasks || 0}</p>
                    </div>
                    <AlertTriangle className="h-10 w-10 text-red-500/50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Require attention
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Active AI Agents */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                AI Workers
              </CardTitle>
              <CardDescription>Currently active agents</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {workers?.slice(0, 8).map((worker) => (
                    <div key={worker.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          worker.status === 'active' ? 'bg-green-500' :
                          worker.status === 'busy' ? 'bg-yellow-500' :
                          worker.status === 'error' ? 'bg-red-500' : 'bg-muted-foreground'
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{worker.worker_name}</p>
                          <p className="text-xs text-muted-foreground">{worker.worker_department}</p>
                        </div>
                      </div>
                      <Badge variant={
                        worker.status === 'active' ? 'default' :
                        worker.status === 'busy' ? 'secondary' :
                        worker.status === 'error' ? 'destructive' : 'outline'
                      }>
                        {worker.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <Link to="/grabba/floor9/workers">
                <Button variant="outline" className="w-full mt-4">
                  View All Workers
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Tasks In Progress */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Tasks In Progress
              </CardTitle>
              <CardDescription>Currently processing</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {tasks?.length ? tasks.map((task) => (
                    <div key={task.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="secondary">
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          Processing
                        </Badge>
                        <Badge variant="outline">{task.priority}</Badge>
                      </div>
                      <p className="text-sm font-medium">{task.task_title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {task.worker?.worker_name || 'Unassigned'}
                      </p>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">No tasks in progress</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <Link to="/grabba/floor9/tasks">
                <Button variant="outline" className="w-full mt-4">
                  View All Tasks
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Action Queue */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Action Queue
              </CardTitle>
              <CardDescription>Awaiting human approval</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-3">
                  {actionQueue?.length ? actionQueue.map((item) => (
                    <div key={item.id} className={`p-3 rounded-lg border ${
                      item.risk_level === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                      item.risk_level === 'high' ? 'bg-yellow-500/10 border-yellow-500/30' :
                      'bg-muted/50 border-border'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={
                          item.risk_level === 'critical' ? 'destructive' :
                          item.risk_level === 'high' ? 'secondary' : 'outline'
                        }>
                          {item.risk_level}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{item.action_summary}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.ai_recommendation}
                      </p>
                      {/* PHASE 9.1: Show recommendation-only badge */}
                      <Badge variant="outline" className="mt-2 text-yellow-500 border-yellow-500 text-xs">
                        <Eye className="h-3 w-3 mr-1" />
                        Recommendation Only
                      </Badge>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">No pending actions</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <Link to="/grabba/floor9/action-queue">
                <Button variant="outline" className="w-full mt-4">
                  View Action Queue
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Governance Rules */}
          <div className="lg:col-span-1">
            <ShadowModeGovernanceRules />
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/grabba/floor9/playbooks">
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors h-full">
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Shield className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-medium">Playbooks</h3>
                <p className="text-xs text-muted-foreground mt-1">Deterministic logic</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/grabba/floor9/routines">
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors h-full">
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Clock className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-medium">Routines</h3>
                <p className="text-xs text-muted-foreground mt-1">Scheduled jobs</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/grabba/floor9/instinct-log">
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors h-full">
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Eye className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-medium">Instinct Log</h3>
                <p className="text-xs text-muted-foreground mt-1">AI memory & learning</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/grabba/floor9/results">
            <Card className="hover:bg-muted/50 cursor-pointer transition-colors h-full">
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <TrendingUp className="h-8 w-8 text-primary mb-2" />
                <h3 className="font-medium">Results</h3>
                <p className="text-xs text-muted-foreground mt-1">Performance & drift</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </GrabbaLayout>
  );
};

export default Floor9Hub;
