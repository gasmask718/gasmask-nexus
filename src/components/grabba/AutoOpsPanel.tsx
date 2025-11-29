// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-OPS DASHBOARD PANEL — Phase 27: Autonomous Daily Ops Cycle
// ═══════════════════════════════════════════════════════════════════════════════

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Sun, 
  Clock, 
  Moon, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Trash2,
  RefreshCw,
  Zap,
  Target,
  TrendingUp,
  MessageSquare,
  Route,
  FileWarning
} from 'lucide-react';
import { useAutonomousOps, OpsLog } from '@/hooks/useAutonomousOps';
import { formatDistanceToNow, format } from 'date-fns';

const CycleIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'morning':
      return <Sun className="h-4 w-4 text-amber-500" />;
    case 'midday':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'evening':
      return <Moon className="h-4 w-4 text-indigo-500" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const CycleCard = ({ 
  type, 
  lastRun, 
  enabled, 
  onToggle, 
  onRun, 
  isRunning 
}: { 
  type: 'morning' | 'midday' | 'evening';
  lastRun?: OpsLog;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onRun: () => void;
  isRunning: boolean;
}) => {
  const titles = {
    morning: 'Morning Ops',
    midday: 'Midday Monitor',
    evening: 'Evening Wrap-Up',
  };

  const schedules = {
    morning: '8:00 AM',
    midday: 'Hourly',
    evening: '8:00 PM',
  };

  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CycleIcon type={type} />
            <span className="font-medium">{titles[type]}</span>
          </div>
          <Switch checked={enabled} onCheckedChange={onToggle} />
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>Schedule:</span>
            <span>{schedules[type]}</span>
          </div>
          
          {lastRun && (
            <>
              <div className="flex items-center justify-between">
                <span>Last run:</span>
                <span>{formatDistanceToNow(new Date(lastRun.run_at), { addSuffix: true })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status:</span>
                {lastRun.success ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Success
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                    <XCircle className="h-3 w-3 mr-1" />
                    Failed
                  </Badge>
                )}
              </div>
            </>
          )}
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-3"
          onClick={onRun}
          disabled={isRunning || !enabled}
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Run Now
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

const StatTile = ({ 
  icon: Icon, 
  label, 
  value, 
  variant = 'default' 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: number; 
  variant?: 'default' | 'warning' | 'danger';
}) => {
  const colors = {
    default: 'text-primary',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <Icon className={`h-5 w-5 ${colors[variant]}`} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
};

export function AutoOpsPanel() {
  const { 
    logs, 
    settings, 
    stats, 
    loading, 
    runningCycle, 
    runCycle, 
    updateSettings, 
    clearLogs,
    getLastRun,
    refreshData,
  } = useAutonomousOps();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const recentLogs = logs.slice(0, 5);
  const hasErrors = logs.some(log => !log.success);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Autonomous Ops Engine</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => refreshData()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => clearLogs()}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cycle Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CycleCard
            type="morning"
            lastRun={getLastRun('morning')}
            enabled={settings.morning_enabled}
            onToggle={(enabled) => updateSettings({ morning_enabled: enabled })}
            onRun={() => runCycle('morning')}
            isRunning={runningCycle === 'morning'}
          />
          <CycleCard
            type="midday"
            lastRun={getLastRun('midday')}
            enabled={settings.midday_enabled}
            onToggle={(enabled) => updateSettings({ midday_enabled: enabled })}
            onRun={() => runCycle('midday')}
            isRunning={runningCycle === 'midday'}
          />
          <CycleCard
            type="evening"
            lastRun={getLastRun('evening')}
            enabled={settings.evening_enabled}
            onToggle={(enabled) => updateSettings({ evening_enabled: enabled })}
            onRun={() => runCycle('evening')}
            isRunning={runningCycle === 'evening'}
          />
        </div>

        <Separator />

        {/* KPI Stats */}
        <div>
          <h4 className="text-sm font-medium mb-3">Today's Automated Activity</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile icon={TrendingUp} label="AI Actions Today" value={stats.todayActions} />
            <StatTile icon={Route} label="Routes Created" value={stats.routesCreated} />
            <StatTile 
              icon={AlertTriangle} 
              label="High Urgency" 
              value={stats.highUrgencyIssues} 
              variant={stats.highUrgencyIssues > 5 ? 'warning' : 'default'}
            />
            <StatTile 
              icon={FileWarning} 
              label="Critical Risks" 
              value={stats.criticalRisks}
              variant={stats.criticalRisks > 0 ? 'danger' : 'default'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatTile icon={Target} label="Stores Need Visits" value={stats.storesNeedingVisits} />
          <StatTile 
            icon={FileWarning} 
            label="Unpaid Invoices" 
            value={stats.unpaidInvoices}
            variant={stats.unpaidInvoices > 10 ? 'warning' : 'default'}
          />
          <StatTile icon={MessageSquare} label="Pending Messages" value={stats.pendingMessages} />
        </div>

        <Separator />

        {/* Recent Logs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">Recent Activity</h4>
            {hasErrors && (
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Has Errors
              </Badge>
            )}
          </div>
          
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {recentLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity. Run a cycle to get started.
                </p>
              ) : (
                recentLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <CycleIcon type={log.cycle_type} />
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {log.cycle_type} Cycle
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.run_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {log.notes && (
                        <span className="text-xs text-muted-foreground">{log.notes}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

// Compact version for sidebar/overview
export function AutoOpsCompact() {
  const { stats, runningCycle, runCycle, getLastRun } = useAutonomousOps();

  return (
    <Card className="bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Auto-Ops</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {stats.todayActions} actions today
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 rounded bg-muted/50">
            <p className="text-lg font-bold">{stats.criticalRisks}</p>
            <p className="text-[10px] text-muted-foreground">Critical</p>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <p className="text-lg font-bold">{stats.storesNeedingVisits}</p>
            <p className="text-[10px] text-muted-foreground">Visits</p>
          </div>
          <div className="text-center p-2 rounded bg-muted/50">
            <p className="text-lg font-bold">{stats.pendingMessages}</p>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => runCycle('morning')}
            disabled={!!runningCycle}
          >
            {runningCycle === 'morning' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Sun className="h-3 w-3 mr-1" />
                Morning
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => runCycle('evening')}
            disabled={!!runningCycle}
          >
            {runningCycle === 'evening' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Moon className="h-3 w-3 mr-1" />
                Evening
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
