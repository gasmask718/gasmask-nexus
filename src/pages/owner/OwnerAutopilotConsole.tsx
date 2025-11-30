import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Zap,
  Play,
  Pause,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Settings,
  Bot,
} from 'lucide-react';

const automations = [
  {
    id: 'nightly-backup',
    name: 'Nightly Database Backup',
    system: 'Dynasty OS Core',
    status: 'Active',
    lastRun: '2 hours ago',
    nextRun: 'Tonight 2:00 AM',
    category: 'System',
  },
  {
    id: 'va-scheduling',
    name: 'VA Task Auto-Assignment',
    system: 'Workforce Engine',
    status: 'Active',
    lastRun: '15 min ago',
    nextRun: 'Every 30 min',
    category: 'Workforce',
  },
  {
    id: 'route-planning',
    name: 'Smart Route Planning',
    system: 'Delivery OS',
    status: 'Active',
    lastRun: '1 hour ago',
    nextRun: '4:00 AM daily',
    category: 'Operations',
  },
  {
    id: 'crm-followups',
    name: 'CRM Follow-Up Engine',
    system: 'Communication Hub',
    status: 'Active',
    lastRun: '5 min ago',
    nextRun: 'Continuous',
    category: 'Communication',
  },
  {
    id: 'funding-workflow',
    name: 'Funding Pipeline Monitor',
    system: 'Funding Company OS',
    status: 'Degraded',
    lastRun: '45 min ago',
    nextRun: 'Every 15 min',
    category: 'Finance',
  },
  {
    id: 'grant-deadlines',
    name: 'Grant Deadline Watcher',
    system: 'Grant Company OS',
    status: 'Active',
    lastRun: '30 min ago',
    nextRun: '6:00 AM daily',
    category: 'Finance',
  },
  {
    id: 'betting-bankroll',
    name: 'Sports Betting Bankroll Guard',
    system: 'Sports Betting AI',
    status: 'Active',
    lastRun: '1 min ago',
    nextRun: 'Continuous',
    category: 'Trading',
  },
  {
    id: 'invoice-reminders',
    name: 'Unpaid Invoice Reminders',
    system: 'Finance Engine',
    status: 'Active',
    lastRun: '3 hours ago',
    nextRun: '9:00 AM daily',
    category: 'Finance',
  },
  {
    id: 'inventory-alerts',
    name: 'Low Inventory Alerts',
    system: 'Grabba Inventory',
    status: 'Paused',
    lastRun: 'Yesterday',
    nextRun: 'Paused',
    category: 'Operations',
  },
  {
    id: 'excel-exports',
    name: 'Weekly Excel Exports',
    system: 'Reporting Engine',
    status: 'Active',
    lastRun: '5 days ago',
    nextRun: 'Sunday 6:00 AM',
    category: 'Reporting',
  },
];

export default function OwnerAutopilotConsole() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const activeCount = automations.filter((a) => a.status === 'Active').length;
  const degradedCount = automations.filter((a) => a.status === 'Degraded').length;
  const pausedCount = automations.filter((a) => a.status === 'Paused').length;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/30">
            <Bot className="h-8 w-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Autopilot Console</h1>
            <p className="text-sm text-muted-foreground">
              Empire-wide automation control center
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          <Button variant="outline" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Automations</p>
                <p className="text-2xl font-bold">{automations.length}</p>
              </div>
              <Zap className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-emerald-400">{activeCount}</p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Degraded</p>
                <p className="text-2xl font-bold text-amber-400">{degradedCount}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-muted">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paused</p>
                <p className="text-2xl font-bold text-muted-foreground">{pausedCount}</p>
              </div>
              <Pause className="h-6 w-6 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Automations List */}
      <Card className="rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Automations</CardTitle>
          <CardDescription className="text-xs">Manage empire-wide automated workflows</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {automations.map((auto) => (
                <AutomationRow key={auto.id} automation={auto} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationRow({ automation }: { automation: typeof automations[0] }) {
  const statusConfig = {
    Active: { color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: CheckCircle2 },
    Degraded: { color: 'text-amber-400', bg: 'bg-amber-500/20', icon: AlertTriangle },
    Paused: { color: 'text-muted-foreground', bg: 'bg-muted', icon: Pause },
  };

  const config = statusConfig[automation.status as keyof typeof statusConfig];

  return (
    <div className="flex items-center justify-between rounded-xl border bg-card/50 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className={cn("p-2 rounded-lg", config.bg)}>
          <config.icon className={cn("h-4 w-4", config.color)} />
        </div>
        <div>
          <p className="font-medium text-sm">{automation.name}</p>
          <p className="text-xs text-muted-foreground">{automation.system}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right hidden md:block">
          <p className="text-xs text-muted-foreground">Last Run</p>
          <p className="text-sm">{automation.lastRun}</p>
        </div>
        <div className="text-right hidden lg:block">
          <p className="text-xs text-muted-foreground">Next Run</p>
          <p className="text-sm">{automation.nextRun}</p>
        </div>
        <Badge variant="outline" className={cn(config.bg, config.color, "border-transparent")}>
          {automation.status}
        </Badge>
        <Button variant="ghost" size="sm" className="gap-1">
          <FileText className="h-3 w-3" />
          Logs
        </Button>
      </div>
    </div>
  );
}
