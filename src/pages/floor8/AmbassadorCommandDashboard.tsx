/**
 * Floor 8 - Ambassador Command Dashboard
 * Real-time command center for ambassador-driven growth
 * MASTER GENIUS ARCHITECT: Growth intelligence, not just metrics
 */
import { useNavigate } from 'react-router-dom';
import {
  Users, Store, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, ChevronRight, Phone, MessageSquare,
  Calendar, Target, Award, UserPlus, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useAdminAmbassadorCommand, type AdminTopPerformer, type AdminAmbassadorProfile } from '@/hooks/useAdminAmbassadorCommand';
import { formatDistanceToNow } from 'date-fns';

// KPI Card Component
function CommandKPI({ 
  label, 
  value, 
  subValue,
  icon: Icon, 
  trend,
  variant = 'default',
  onClick 
}: {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  onClick?: () => void;
}) {
  const variantClasses = {
    default: 'bg-muted/50 border-border',
    success: 'bg-emerald-500/10 border-emerald-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    danger: 'bg-red-500/10 border-red-500/30',
    info: 'bg-blue-500/10 border-blue-500/30',
  };

  const iconClasses = {
    default: 'text-muted-foreground',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    info: 'text-blue-400',
  };

  return (
    <Card 
      className={`${variantClasses[variant]} border cursor-pointer hover:scale-[1.02] transition-transform`}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
            )}
          </div>
          <div className={`p-2 rounded-full bg-background/50`}>
            <Icon className={`h-5 w-5 ${iconClasses[variant]}`} />
          </div>
        </div>
        {trend && (
          <div className="flex items-center mt-2 text-xs">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-400 mr-1" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-400 mr-1" />}
            <span className={trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground'}>
              {trend === 'up' ? 'Trending up' : trend === 'down' ? 'Needs attention' : 'Stable'}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Top Performer Card
function TopPerformerCard({ performer, rank }: { performer: AdminTopPerformer; rank: number }) {
  const navigate = useNavigate();
  
  const trendColor = {
    improving: 'text-emerald-400',
    stable: 'text-muted-foreground',
    declining: 'text-red-400',
    new: 'text-blue-400',
  }[performer.trend] || 'text-muted-foreground';

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border hover:border-primary/50 cursor-pointer transition-colors"
      onClick={() => navigate(`/ambassadors/${performer.id}`)}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
        #{rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{performer.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">{performer.tier}</Badge>
          <span>{performer.stores_acquired} stores</span>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold text-primary">${performer.revenue_generated.toLocaleString()}</p>
        <p className={`text-xs ${trendColor}`}>{performer.trend}</p>
      </div>
    </div>
  );
}

// At-Risk Ambassador Card
function AtRiskCard({ ambassador }: { ambassador: AdminAmbassadorProfile }) {
  const navigate = useNavigate();
  
  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20 hover:border-red-500/40 cursor-pointer transition-colors"
      onClick={() => navigate(`/ambassadors/${ambassador.id}`)}
    >
      <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{ambassador.name}</p>
        <p className="text-xs text-muted-foreground">
          {ambassador.last_activity 
            ? `Last active ${formatDistanceToNow(new Date(ambassador.last_activity), { addSuffix: true })}`
            : 'No recent activity'}
        </p>
      </div>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Phone className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <MessageSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Conversion Funnel
function ConversionFunnel({ ambassadors }: { ambassadors: AdminAmbassadorProfile[] }) {
  const totalAmbassadors = ambassadors.length;
  const withStores = ambassadors.filter(a => a.stores_acquired > 0).length;
  const withOrders = ambassadors.filter(a => a.orders_generated > 0).length;
  const withRepeat = ambassadors.filter(a => a.orders_generated > 3).length;

  const stages = [
    { label: 'Active Ambassadors', count: totalAmbassadors, percent: 100 },
    { label: 'With Stores', count: withStores, percent: totalAmbassadors > 0 ? (withStores / totalAmbassadors) * 100 : 0 },
    { label: 'Generated Orders', count: withOrders, percent: totalAmbassadors > 0 ? (withOrders / totalAmbassadors) * 100 : 0 },
    { label: 'Repeat Business', count: withRepeat, percent: totalAmbassadors > 0 ? (withRepeat / totalAmbassadors) * 100 : 0 },
  ];

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => (
        <div key={stage.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{stage.label}</span>
            <span className="font-medium">{stage.count}</span>
          </div>
          <Progress value={stage.percent} className="h-2" />
        </div>
      ))}
    </div>
  );
}

export default function AmbassadorCommandDashboard() {
  const navigate = useNavigate();
  const { ambassadors, metrics, topPerformers, atRiskAmbassadors, isLoading } = useAdminAmbassadorCommand();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ambassador Command Center</h1>
          <p className="text-muted-foreground">Real-time growth intelligence</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/ambassadors')}>
            <Users className="h-4 w-4 mr-2" />
            All Ambassadors
          </Button>
          <Button onClick={() => navigate('/ambassador/leads')}>
            <UserPlus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CommandKPI
          label="Active Ambassadors"
          value={metrics.total_ambassadors}
          icon={Users}
          variant="info"
          onClick={() => navigate('/ambassadors')}
        />
        <CommandKPI
          label="Stores Acquired (30d)"
          value={metrics.stores_acquired_30d}
          subValue={`${metrics.stores_acquired_7d} this week`}
          icon={Store}
          variant="success"
          trend={metrics.stores_acquired_7d > 5 ? 'up' : metrics.stores_acquired_7d === 0 ? 'down' : 'neutral'}
        />
        <CommandKPI
          label="Revenue Today"
          value={`$${metrics.revenue_today.toLocaleString()}`}
          subValue={`${metrics.orders_today} orders`}
          icon={DollarSign}
          variant="success"
        />
        <CommandKPI
          label="Pending Payouts"
          value={`$${metrics.pending_payouts.toLocaleString()}`}
          icon={Clock}
          variant={metrics.pending_payouts > 1000 ? 'warning' : 'default'}
          onClick={() => navigate('/ambassadors/payouts')}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CommandKPI
          label="Stores Today"
          value={metrics.stores_acquired_today}
          icon={Target}
          variant="default"
        />
        <CommandKPI
          label="Stores (7d)"
          value={metrics.stores_acquired_7d}
          icon={Calendar}
          variant="default"
        />
        <CommandKPI
          label="At-Risk Ambassadors"
          value={atRiskAmbassadors.length}
          icon={AlertTriangle}
          variant={atRiskAmbassadors.length > 5 ? 'danger' : 'default'}
        />
        <CommandKPI
          label="Overdue Follow-ups"
          value={metrics.overdue_followups}
          icon={Clock}
          variant={metrics.overdue_followups > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Main Intelligence Grid */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Top Performers */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  Top Performers
                </CardTitle>
                <CardDescription>By revenue generated</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/ambassadors?sort=revenue')}>
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-2">
                {topPerformers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No data yet</p>
                ) : (
                  topPerformers.map((performer, idx) => (
                    <TopPerformerCard key={performer.id} performer={performer} rank={idx + 1} />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* At-Risk Ambassadors */}
        <Card className="border-red-500/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Needs Attention
                </CardTitle>
                <CardDescription>Declining activity</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[280px]">
              <div className="space-y-2">
                {atRiskAmbassadors.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 mx-auto text-emerald-400/50 mb-2" />
                    <p className="text-muted-foreground">All ambassadors active</p>
                  </div>
                ) : (
                  atRiskAmbassadors.map((amb) => (
                    <AtRiskCard key={amb.id} ambassador={amb} />
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Conversion Funnel
            </CardTitle>
            <CardDescription>Ambassador → Store → Order → Repeat</CardDescription>
          </CardHeader>
          <CardContent>
            <ConversionFunnel ambassadors={ambassadors} />
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Button className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/ambassadors')}>
              <Users className="h-5 w-5" />
              <span>All Ambassadors</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/ambassador/leads')}>
              <UserPlus className="h-5 w-5" />
              <span>Add Lead</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/ambassadors/payouts')}>
              <DollarSign className="h-5 w-5" />
              <span>Payouts</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/ambassadors/regions')}>
              <Target className="h-5 w-5" />
              <span>Regions</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => navigate('/influencers')}>
              <Award className="h-5 w-5" />
              <span>Influencers</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
