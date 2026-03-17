import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useCEODashboard } from '@/hooks/useBrandaroCEO';
import {
  DollarSign, TrendingUp, Phone, Users, Target, Zap,
  BarChart3, ArrowUpRight, Clock, Flame
} from 'lucide-react';

export default function CEODashboardPage() {
  const { data: d, isLoading } = useCEODashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = d || {
    leadsToday: 0, totalLeads: 0, callsToday: 0, closedDeals: 0,
    revenueThisMonth: 0, totalRevenue: 0, avgDealSize: 0, closeRate: 0,
    pendingQueue: 0, topIndustries: [], performanceData: [],
    monthlyTarget: 100000, monthlyProgress: 0, dailyTarget: 3333,
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CEO Command Center</h1>
          <p className="text-muted-foreground">Brandaro Revenue Engine — Real-time Performance</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2 border-primary text-primary">
          <Target className="h-4 w-4 mr-2" />
          Target: {fmt(stats.monthlyTarget)}/mo
        </Badge>
      </div>

      {/* Monthly Progress */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-lg">Monthly Revenue Progress</span>
            </div>
            <span className="text-2xl font-bold text-primary">{fmt(stats.revenueThisMonth)} / {fmt(stats.monthlyTarget)}</span>
          </div>
          <Progress value={Math.min(stats.monthlyProgress, 100)} className="h-4" />
          <p className="text-sm text-muted-foreground mt-2">
            {stats.monthlyProgress.toFixed(1)}% of monthly target • Daily target: {fmt(stats.dailyTarget)}
          </p>
        </CardContent>
      </Card>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Leads Today" value={stats.leadsToday} sub={`${stats.totalLeads} total`} color="text-blue-500" />
        <MetricCard icon={Phone} label="Calls Today" value={stats.callsToday} sub={`${stats.pendingQueue} in queue`} color="text-green-500" />
        <MetricCard icon={DollarSign} label="Revenue (Month)" value={fmt(stats.revenueThisMonth)} sub={`Total: ${fmt(stats.totalRevenue)}`} color="text-emerald-500" />
        <MetricCard icon={TrendingUp} label="Close Rate" value={`${stats.closeRate.toFixed(1)}%`} sub={`${stats.closedDeals} deals closed`} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard icon={BarChart3} label="Avg Deal Size" value={fmt(stats.avgDealSize)} sub="Per closed deal" color="text-amber-500" />
        <MetricCard icon={Zap} label="Queue Active" value={stats.pendingQueue} sub="Leads waiting for call" color="text-red-500" />
      </div>

      {/* Top Industries */}
      {stats.topIndustries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Top Converting Industries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topIndustries.map((ind, i) => (
                <div key={ind.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs p-0">
                      {i + 1}
                    </Badge>
                    <span className="font-medium capitalize">{ind.name}</span>
                  </div>
                  <Badge>{ind.count} leads</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Speed Rule */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Clock className="h-6 w-6 text-accent" />
            <div>
              <p className="font-semibold">Speed Rule Active</p>
              <p className="text-sm text-muted-foreground">Lead → Call → Demo → Payment must happen within 5–10 minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub: string; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
