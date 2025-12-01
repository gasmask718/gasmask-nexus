import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportOsBlueprintToJson } from '@/services/exportService';
import { exportAllToExcel } from '@/services/excelExportService';
import {
  Activity,
  AlertTriangle,
  Brain,
  Building2,
  ChevronRight,
  Cpu,
  Crown,
  Bell,
  Clock,
  Users,
  Zap,
  CheckCircle2,
  XCircle,
  LineChart,
  Factory,
  Sparkles,
  Download,
} from 'lucide-react';

// Import new polished components
import { ExecutiveKPIs } from './components/ExecutiveKPIs';
import { QuickActionsRow } from './components/QuickActionsRow';
import { SystemHealthBar } from './components/SystemHealthBar';
import { OwnerToolsFooter } from './components/OwnerToolsFooter';
import { CashFlowPulse } from './components/CashFlowPulse';
import { EmpireMap } from './components/EmpireMap';

// ═══════════════════════════════════════════════════════════════════════════════
// DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const automations = [
  { name: 'Auto Text Follow-Up Engine', system: 'Communication OS', status: 'Active', lastRun: '3 min ago' },
  { name: 'TopTier Lead Nurture Sequence', system: 'TopTier OS', status: 'Active', lastRun: '12 min ago' },
  { name: 'Grant Deadline Watcher', system: 'Grant Company OS', status: 'Degraded', lastRun: '45 min ago' },
  { name: 'Funding Pipeline Monitor', system: 'Funding Company OS', status: 'Active', lastRun: '8 min ago' },
  { name: 'Sports Betting Bankroll Guard', system: 'Sports Betting AI', status: 'Active', lastRun: '1 min ago' },
];

const workforceSummary = [
  { name: 'Drivers', count: 50, tasksToday: 120, status: 'Strong', note: 'On-time rate 94%' },
  { name: 'Bikers / Store Checkers', count: 24, tasksToday: 310, status: 'OK', note: 'Some zones need coverage' },
  { name: 'VAs', count: 6, tasksToday: 84, status: 'Strong', note: 'Admin and CRM up-to-date' },
  { name: 'Ambassadors', count: 40, tasksToday: 65, status: 'Needs focus', note: 'More campaigns required' },
];

const alerts = [
  { id: 'alert-1', type: 'Critical', system: 'Funding Company', message: '1 large file in underwriting over SLA', time: '1h ago' },
  { id: 'alert-2', type: 'Warning', system: 'TopTier Experience', message: '3 bookings missing payment confirmation', time: '3h ago' },
  { id: 'alert-3', type: 'Warning', system: 'PlayBoxxx', message: '2 creator payout reviews pending', time: '5h ago' },
  { id: 'alert-4', type: 'Info', system: 'GasMask / Grabba', message: '5 stores flagged for low inventory', time: 'Today' },
];

const activityFeed = [
  { title: 'Updated TopTier pricing matrix', detail: 'Adjusted weekend rates for NYC & ATL fleets', time: '2h ago' },
  { title: 'Activated Sports Betting AI OS', detail: 'Enabled hedge calculator and AI picks dashboard', time: 'Yesterday' },
  { title: 'Added new wholesaler region', detail: 'Expanded GasMask coverage into new borough', time: '2 days ago' },
  { title: 'Approved grant applications batch', detail: '3 clients moved to Approved stage', time: '3 days ago' },
];

const aiInsights = [
  { 
    type: 'opportunity', 
    title: 'Biggest Opportunity', 
    content: 'Scale TopTier Experience in NYC & ATL using bundled "Black Truck + Roses" celebration campaigns.',
    icon: Sparkles,
    color: 'emerald'
  },
  { 
    type: 'risk', 
    title: 'Biggest Risk', 
    content: 'Funding and grant files over SLA. Create hard rule: any file >48h gets forced follow-up.',
    icon: AlertTriangle,
    color: 'amber'
  },
  { 
    type: 'quickwin', 
    title: 'Quick Win', 
    content: 'Raise weekend base price on black trucks by $10 and bundle roses for +AOV.',
    icon: Zap,
    color: 'blue'
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function statusBadge(status: string) {
  switch (status) {
    case 'Healthy': case 'Strong': case 'Active':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'Watch': case 'OK':
      return 'bg-blue-500/10 text-blue-300 border-blue-500/30';
    case 'Critical': case 'Needs focus': case 'Degraded':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function automationStatus(s: string) {
  switch (s) {
    case 'Active': return 'text-emerald-400';
    case 'Degraded': return 'text-amber-400';
    case 'Paused': return 'text-red-400';
    default: return 'text-muted-foreground';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCESS DENIED COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function AccessDenied({ role }: { role: string | null }) {
  return (
    <div className="flex h-full items-center justify-center min-h-[60vh]">
      <Card className="max-w-md rounded-xl border-red-500/40 bg-gradient-to-br from-red-950/40 to-red-900/20 shadow-xl">
        <CardHeader className="flex flex-row items-center gap-3">
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>This page is restricted to Owner / Admin accounts.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-red-100/80">
          Your current role is <span className="font-semibold">{role ?? 'unknown'}</span>.
          If you believe this is an error, verify your admin role in the database.
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const OwnerDashboard: React.FC = () => {
  const { role, isAdmin, loading: roleLoading } = useUserRole();
  const [dataLoading, setDataLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Simulate initial data load
    const timer = setTimeout(() => setDataLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleExportSnapshot = async () => {
    try {
      await exportOsBlueprintToJson();
      toast.success('Snapshot exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export snapshot');
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await exportAllToExcel();
      if (blob) {
        const timestamp = new Date().toISOString().split('T')[0];
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Dynasty_OS_Full_Export_${timestamp}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Excel export complete');
      } else {
        toast.error('No data available for export');
      }
    } catch (error) {
      console.error('Excel export failed:', error);
      toast.error('Failed to export to Excel');
    }
  };

  // Show loading state while role is being determined
  if (roleLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
          <p className="text-muted-foreground">Loading Owner Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin()) {
    return <AccessDenied role={role} />;
  }

  const loading = dataLoading;

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER SECTION
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-yellow-500/10 border border-amber-500/30 shadow-lg">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
              Owner Control Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Dynasty OS — Unified view across all systems, businesses, and automations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="outline" className="border-amber-500/60 bg-amber-900/40 text-amber-200 px-3 py-1">
            <Crown className="h-3 w-3 mr-1" />
            DYNASTY OWNER
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/os/owner/ai-advisor')}>
            <Brain className="h-4 w-4" />
            AI Summary
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportSnapshot}>
            <Download className="h-4 w-4" />
            JSON Snapshot
          </Button>
          <Button size="sm" className="gap-2" onClick={handleExportExcel}>
            <Download className="h-4 w-4" />
            Excel Export
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SYSTEM HEALTH BAR
          ═══════════════════════════════════════════════════════════════════════ */}
      <SystemHealthBar />

      {/* ═══════════════════════════════════════════════════════════════════════
          EXECUTIVE KPIs ROW
          ═══════════════════════════════════════════════════════════════════════ */}
      <ExecutiveKPIs loading={loading} />

      {/* ═══════════════════════════════════════════════════════════════════════
          QUICK ACTIONS ROW
          ═══════════════════════════════════════════════════════════════════════ */}
      <QuickActionsRow />

      {/* ═══════════════════════════════════════════════════════════════════════
          EMPIRE MAP - BUSINESS PERFORMANCE
          ═══════════════════════════════════════════════════════════════════════ */}
      <EmpireMap />

      {/* ═══════════════════════════════════════════════════════════════════════
          REVENUE & CASH FLOW SECTION
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 rounded-xl shadow-lg border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <LineChart className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">Empire Revenue Overview</CardTitle>
                <CardDescription className="text-xs">Summarized across all businesses (last 6 months)</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 text-[10px]">Live</Badge>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-44">
              {[
                { month: 'Jul', value: 52 },
                { month: 'Aug', value: 68 },
                { month: 'Sep', value: 75 },
                { month: 'Oct', value: 83 },
                { month: 'Nov', value: 92 },
                { month: 'Dec', value: 100 },
              ].map((bar) => (
                <div key={bar.month} className="flex flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600/30 via-emerald-500/50 to-emerald-400/80 shadow-sm"
                    style={{ height: `${bar.value}%` }}
                  />
                  <span className="text-xs text-muted-foreground font-medium">{bar.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Trend: steady growth with acceleration in Q4</span>
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Volatility: moderate
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Pulse */}
        <CashFlowPulse />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          INTELLIGENCE TABS — AI / AUTOMATIONS / WORKFORCE
          ═══════════════════════════════════════════════════════════════════════ */}
      <Card className="rounded-xl shadow-lg border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Cpu className="h-4 w-4 text-purple-400" />
            </div>
            <div>
              <CardTitle className="text-base">Empire Intelligence</CardTitle>
              <CardDescription className="text-xs">AI advisor, automation health, and workforce view</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="advisor" className="space-y-4">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="advisor" className="gap-1.5">
                <Brain className="h-3 w-3" />
                AI Advisor
              </TabsTrigger>
              <TabsTrigger value="automations" className="gap-1.5">
                <Zap className="h-3 w-3" />
                Automations
              </TabsTrigger>
              <TabsTrigger value="workforce" className="gap-1.5">
                <Users className="h-3 w-3" />
                Workforce
              </TabsTrigger>
            </TabsList>

            {/* AI Advisor Tab */}
            <TabsContent value="advisor" className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                {aiInsights.map((insight) => {
                  const colors = {
                    emerald: 'border-emerald-500/30 bg-gradient-to-br from-emerald-950/50 to-emerald-900/20',
                    amber: 'border-amber-500/30 bg-gradient-to-br from-amber-950/50 to-amber-900/20',
                    blue: 'border-blue-500/30 bg-gradient-to-br from-blue-950/50 to-blue-900/20',
                  };
                  const iconColors = {
                    emerald: 'text-emerald-400 bg-emerald-500/20',
                    amber: 'text-amber-400 bg-amber-500/20',
                    blue: 'text-blue-400 bg-blue-500/20',
                  };
                  return (
                    <Card key={insight.type} className={cn('rounded-xl', colors[insight.color as keyof typeof colors])}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <div className={cn('p-1.5 rounded-lg', iconColors[insight.color as keyof typeof iconColors])}>
                            <insight.icon className="h-4 w-4" />
                          </div>
                          {insight.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-foreground/80">
                        {insight.content}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Automations Tab */}
            <TabsContent value="automations" className="space-y-3">
              <div className="space-y-2">
                {automations.map((auto, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border bg-card/70 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{auto.name}</span>
                      <span className="text-xs text-muted-foreground">{auto.system}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5">
                        {auto.status === 'Active' && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                        {auto.status === 'Degraded' && <AlertTriangle className="h-3 w-3 text-amber-400" />}
                        {auto.status === 'Paused' && <XCircle className="h-3 w-3 text-red-400" />}
                        <span className={automationStatus(auto.status)}>{auto.status}</span>
                      </div>
                      <span className="text-muted-foreground">Last: {auto.lastRun}</span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Workforce Tab */}
            <TabsContent value="workforce" className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {workforceSummary.map((w) => (
                  <Card key={w.name} className="rounded-xl bg-card/70">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        {w.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Active</span>
                        <span className="font-bold text-foreground">{w.count}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Tasks today</span>
                        <span className="font-bold text-foreground">{w.tasksToday}</span>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] px-2 py-0.5', statusBadge(w.status))}>
                        {w.status}
                      </Badge>
                      <p className="text-[10px] text-muted-foreground">{w.note}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════
          ALERTS & ACTIVITY FEED
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Critical Alerts */}
        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Bell className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-base">Critical Alerts</CardTitle>
                <CardDescription className="text-xs">Issues requiring owner attention</CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-amber-200 border-amber-500/40 bg-amber-500/10">
              {alerts.length} open
            </Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px] pr-4">
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className="flex flex-col gap-1.5 rounded-xl border bg-card/70 px-4 py-3 cursor-pointer hover:bg-card/90 transition-colors"
                    onClick={() => navigate(`/os/owner/alert/${alert.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'px-2 py-0.5 text-[10px]',
                            alert.type === 'Critical' && 'border-red-500/50 text-red-300 bg-red-500/10',
                            alert.type === 'Warning' && 'border-amber-500/50 text-amber-300 bg-amber-500/10',
                            alert.type === 'Info' && 'border-blue-500/40 text-blue-300 bg-blue-500/10'
                          )}
                        >
                          {alert.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{alert.system}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{alert.time}</span>
                    </div>
                    <p className="text-xs text-foreground">{alert.message}</p>
                    <Button variant="ghost" size="sm" className="w-fit text-xs mt-1 h-6 px-2">
                      Review →
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="rounded-xl shadow-lg border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Activity className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">Recent Owner Activity</CardTitle>
                <CardDescription className="text-xs">High-level actions across your empire</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px] pr-4">
              <div className="space-y-4">
                {activityFeed.map((item, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      {idx < activityFeed.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-border" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground">{item.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          OWNER TOOLS FOOTER
          ═══════════════════════════════════════════════════════════════════════ */}
      <OwnerToolsFooter />
    </div>
  );
};

export default OwnerDashboard;
