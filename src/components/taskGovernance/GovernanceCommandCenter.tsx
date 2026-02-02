/**
 * GovernanceCommandCenter - Phase H: Human Operator View
 * 
 * A unified view for human operators to see:
 * - All active tasks across floors
 * - All blocked tasks requiring intervention
 * - All awaiting approval
 * - All dry-run failures
 * - All live executions
 * 
 * This is the single source of truth for task observability.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Eye,
  Lock,
  Unlock,
  RefreshCw,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useGlobalTasks } from '@/hooks/useGovernedTasks';
import { GovernedTaskCard } from './GovernedTaskCard';
import { 
  getGovernanceLockStatus, 
  enableProductionLock, 
  disableProductionLock,
  setLockMode,
  getViolations,
  type GovernanceLockStatus,
} from '@/services/taskGovernance/productionLock';
import { toast } from 'sonner';

// ============= TYPES =============

type TaskFilter = 
  | 'all' 
  | 'active' 
  | 'blocked' 
  | 'awaiting_approval' 
  | 'dry_run_failed' 
  | 'live_running' 
  | 'completed'
  | 'cancelled';

// ============= COMPONENT =============

export function GovernanceCommandCenter() {
  const { tasks, isLoading, refresh, stats } = useGlobalTasks();
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('all');
  const [lockStatus, setLockStatus] = useState<GovernanceLockStatus | null>(null);

  // Refresh lock status
  useEffect(() => {
    const status = getGovernanceLockStatus();
    setLockStatus(status);
    
    const interval = setInterval(() => {
      setLockStatus(getGovernanceLockStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Filter tasks based on active filter
  // Note: Using (task.status as string) to allow comparison with UI filter values
  // that may not match the exact GovernedTaskStatus enum
  const filteredTasks = tasks.filter(task => {
    const status = task.status as string;
    switch (activeFilter) {
      case 'active':
        return ['queued', 'running', 'paused_for_approval'].includes(status);
      case 'blocked':
        return task.items_blocked > 0;
      case 'awaiting_approval':
        return status === 'paused_for_approval';
      case 'dry_run_failed':
        return status === 'failed' && task.execution_mode === 'dry_run';
      case 'live_running':
        return status === 'running' && task.execution_mode === 'live';
      case 'completed':
        return status === 'completed';
      case 'cancelled':
        return status === 'cancelled';
      default:
        return true;
    }
  });

  const getFilterCount = (filter: TaskFilter): number => {
    return tasks.filter(task => {
      const status = task.status as string;
      switch (filter) {
        case 'active': return ['queued', 'running', 'paused_for_approval'].includes(status);
        case 'blocked': return task.items_blocked > 0;
        case 'awaiting_approval': return status === 'paused_for_approval';
        case 'dry_run_failed': return status === 'failed' && task.execution_mode === 'dry_run';
        case 'live_running': return status === 'running' && task.execution_mode === 'live';
        case 'completed': return status === 'completed';
        case 'cancelled': return status === 'cancelled';
        default: return true;
      }
    }).length;
  };

  const handleToggleLock = () => {
    if (lockStatus?.enabled) {
      const confirmed = window.confirm(
        '⚠️ WARNING: Disabling production lock will allow ungoverned data writes.\n\n' +
        'This should ONLY be done in development. Continue?'
      );
      if (confirmed) {
        disableProductionLock('dev_mode');
        toast.warning('Production lock DISABLED', {
          description: 'Ungoverned writes are now allowed',
        });
      }
    } else {
      enableProductionLock();
      toast.success('Production lock ENABLED', {
        description: 'All ungoverned writes are blocked',
      });
    }
    setLockStatus(getGovernanceLockStatus());
  };

  const handleModeChange = (mode: 'strict' | 'warn' | 'audit') => {
    setLockMode(mode);
    toast.info(`Lock mode set to: ${mode}`);
    setLockStatus(getGovernanceLockStatus());
  };

  return (
    <div className="space-y-6">
      {/* Production Lock Status Banner */}
      <Alert 
        variant={lockStatus?.enabled ? 'default' : 'destructive'}
        className={lockStatus?.enabled ? 'border-green-500 bg-green-500/10' : ''}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            {lockStatus?.enabled ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-destructive" />
            )}
            <div>
              <AlertTitle className="mb-0">
                {lockStatus?.enabled ? 'Production Lock ENABLED' : 'Production Lock DISABLED'}
              </AlertTitle>
              <AlertDescription className="text-xs">
                {lockStatus?.enabled 
                  ? 'All ungoverned database writes are blocked. Mode: ' + lockStatus.mode
                  : '⚠️ WARNING: Ungoverned writes are allowed. Enable lock before production.'}
              </AlertDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="lock-toggle" className="text-xs">Lock</Label>
              <Switch
                id="lock-toggle"
                checked={lockStatus?.enabled ?? true}
                onCheckedChange={handleToggleLock}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Alert>

      {/* Violation Alert */}
      {lockStatus && lockStatus.violationsTotal > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Governance Violations Detected</AlertTitle>
          <AlertDescription>
            {lockStatus.violationsBlocked} blocked, {lockStatus.violationsWarned} warnings. 
            Review the violation log below.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${activeFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Building2 className="h-6 w-6 text-primary/30" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeFilter === 'active' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => setActiveFilter('active')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-blue-600">{getFilterCount('active')}</p>
              </div>
              <Activity className="h-6 w-6 text-blue-600/30" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeFilter === 'awaiting_approval' ? 'ring-2 ring-amber-500' : ''}`}
          onClick={() => setActiveFilter('awaiting_approval')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Awaiting Approval</p>
                <p className="text-2xl font-bold text-amber-600">{getFilterCount('awaiting_approval')}</p>
              </div>
              <Clock className="h-6 w-6 text-amber-600/30" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeFilter === 'blocked' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => setActiveFilter('blocked')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Blocked</p>
                <p className="text-2xl font-bold text-red-600">{getFilterCount('blocked')}</p>
              </div>
              <XCircle className="h-6 w-6 text-red-600/30" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeFilter === 'live_running' ? 'ring-2 ring-green-500' : ''}`}
          onClick={() => setActiveFilter('live_running')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Live Running</p>
                <p className="text-2xl font-bold text-green-600">{getFilterCount('live_running')}</p>
              </div>
              <Play className="h-6 w-6 text-green-600/30" />
            </div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all ${activeFilter === 'dry_run_failed' ? 'ring-2 ring-orange-500' : ''}`}
          onClick={() => setActiveFilter('dry_run_failed')}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Dry-Run Failed</p>
                <p className="text-2xl font-bold text-orange-600">{getFilterCount('dry_run_failed')}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-orange-600/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Task Monitor
                </CardTitle>
                <CardDescription>
                  {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} • Filter: {activeFilter.replace('_', ' ')}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {(['completed', 'cancelled'] as TaskFilter[]).map(filter => (
                  <Badge
                    key={filter}
                    variant={activeFilter === filter ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter} ({getFilterCount(filter)})
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTasks.length > 0 ? (
                <div className="space-y-3">
                  {filteredTasks.map(task => (
                    <GovernedTaskCard key={task.id} task={task} compact />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No tasks matching filter: {activeFilter.replace('_', ' ')}</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Governance Status Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Governance Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Lock Mode */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Lock Mode</Label>
              <div className="flex gap-2">
                {(['strict', 'warn', 'audit'] as const).map(mode => (
                  <Button
                    key={mode}
                    variant={lockStatus?.mode === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleModeChange(mode)}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {lockStatus?.mode === 'strict' && 'Blocks all ungoverned writes'}
                {lockStatus?.mode === 'warn' && 'Logs violations but allows writes'}
                {lockStatus?.mode === 'audit' && 'Silent logging only'}
              </p>
            </div>

            <Separator />

            {/* Violation Summary */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Violations</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-destructive/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-destructive">{lockStatus?.violationsBlocked || 0}</p>
                  <p className="text-xs text-muted-foreground">Blocked</p>
                </div>
                <div className="bg-amber-500/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{lockStatus?.violationsWarned || 0}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Recent Violations */}
            {lockStatus && lockStatus.recentViolations.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Recent Violations</Label>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {lockStatus.recentViolations.map(v => (
                      <div 
                        key={v.id} 
                        className={`text-xs p-2 rounded ${v.blocked ? 'bg-destructive/10' : 'bg-amber-500/10'}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {v.blocked ? (
                            <XCircle className="h-3 w-3 text-destructive" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 text-amber-600" />
                          )}
                          <span className="font-medium">{v.operation} on {v.table}</span>
                        </div>
                        <p className="text-muted-foreground">{v.reason}</p>
                        <p className="text-muted-foreground/60 mt-1">
                          {new Date(v.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Floor Summary */}
            <Separator />
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Tasks by Floor</Label>
              <div className="space-y-2">
                {Object.entries(stats.byFloor).map(([floor, count]) => (
                  <div key={floor} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{floor.replace('floor', 'Floor ').replace('_', ' - ')}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
