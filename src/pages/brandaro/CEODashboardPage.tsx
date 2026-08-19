import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useCEODashboard } from '@/hooks/useBrandaroCEO';
import {
  DollarSign, TrendingUp, Phone, Users, Target, Zap,
  BarChart3, ArrowUpRight, Clock, Flame, Repeat, Crown,
  Building2, Layers, Bot, MessageSquare, CheckCircle2, UserCheck
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
    monthlyTarget: 1000000, monthlyProgress: 0, dailyTarget: 33333,
    monthlyRecurring: 0, totalActiveClients: 0, serviceBreakdown: {},
    avgLTV: 0, industryPerformance: [],
    aiDialsToday: 0, humanDialsToday: 0, leadsWorkedToday: 0,
    textsToday: 0, closesToday: 0, leadsAssigned: 0, leadsUnassigned: 0,
  } as any;


  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const serviceLabels: Record<string, string> = {
    website: '🌐 Website Build',
    maintenance: '🔧 Monthly Maintenance',
    seo: '📈 SEO Package',
    ads: '📣 Ads Management',
    lead_gen: '🎯 Lead Gen System',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">CEO Command Center</h1>
          <p className="text-muted-foreground">Brandaro $1M Revenue Engine — Real-time Performance</p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2 border-primary text-primary">
          <Crown className="h-4 w-4 mr-2" />
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

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={DollarSign} label="Revenue (Month)" value={fmt(stats.revenueThisMonth)} sub={`Total: ${fmt(stats.totalRevenue)}`} color="text-emerald-500" />
        <MetricCard icon={Repeat} label="Monthly Recurring" value={fmt(stats.monthlyRecurring)} sub={`${stats.totalActiveClients} active clients`} color="text-blue-500" />
        <MetricCard icon={Crown} label="Avg LTV" value={fmt(stats.avgLTV)} sub="Per client lifetime" color="text-amber-500" />
        <MetricCard icon={BarChart3} label="Avg Deal Size" value={fmt(stats.avgDealSize)} sub="Per closed deal" color="text-purple-500" />
      </div>

      {/* Operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Total Leads" value={stats.totalLeads} sub={`${stats.leadsToday} added today`} color="text-blue-500" />
        <MetricCard icon={UserCheck} label="Assigned" value={stats.leadsAssigned} sub={`${stats.leadsUnassigned} unassigned`} color="text-emerald-500" />
        <MetricCard icon={TrendingUp} label="Close Rate (Today)" value={`${stats.closeRate.toFixed(1)}%`} sub={`${stats.closedDeals} total closes`} color="text-purple-500" />
        <MetricCard icon={Zap} label="Queue (Unassigned)" value={stats.leadsUnassigned} sub="Leads waiting" color="text-red-500" />
      </div>

      {/* Today's Activity (T5) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          icon={Bot}
          label="AI Dials Today"
          value={stats.aiDialsToday}
          sub={
            stats.aiDialsFailedToday
              ? `${stats.aiDialsAttemptedToday} attempted · ${stats.aiDialsFailedToday} failed to dispatch (${stats.aiDialFailureRate}%)`
              : `${stats.aiDialsAttemptedToday || 0} attempted · all dispatched`
          }
          color={stats.aiDialsFailedToday ? "text-destructive" : "text-cyan-500"}
        />

        <MetricCard icon={Phone} label="Human Dials Today" value={stats.humanDialsToday} sub="va_call_logs" color="text-green-500" />
        <MetricCard icon={Users} label="Leads Worked Today" value={stats.leadsWorkedToday} sub="Distinct lead_id" color="text-blue-500" />
        <MetricCard icon={MessageSquare} label="Texts Today" value={stats.textsToday} sub="pending_messages → sent" color="text-amber-500" />
        <MetricCard icon={CheckCircle2} label="Closes Today" value={stats.closesToday} sub="converted = true" color="text-emerald-500" />
      </div>


      {/* Service Breakdown + Industry Domination */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recurring Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Active Service Revenue Stack
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.serviceBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.serviceBreakdown)
                  .sort(([, a]: any, [, b]: any) => b.revenue - a.revenue)
                  .map(([type, data]: any) => (
                    <div key={type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{serviceLabels[type] || type}</p>
                        <p className="text-xs text-muted-foreground">{data.count} active clients</p>
                      </div>
                      <span className="text-lg font-bold text-primary">{fmt(data.revenue)}/mo</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No active services yet. Push clients into monthly packages.</p>
            )}
          </CardContent>
        </Card>

        {/* Industry Domination */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Industry Domination Board
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.industryPerformance.length > 0 ? (
              <div className="space-y-3">
                {stats.industryPerformance.slice(0, 6).map((ind: any, i: number) => (
                  <div key={ind.industry} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Badge variant={i < 3 ? "default" : "outline"} className="w-6 h-6 flex items-center justify-center text-xs p-0">
                        {i + 1}
                      </Badge>
                      <div>
                        <p className="font-medium capitalize">{ind.industry.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">{ind.total_clients} clients • {ind.close_rate}% close rate</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{fmt(ind.total_revenue)}</p>
                      <p className="text-xs text-muted-foreground">LTV: {fmt(ind.avg_ltv)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Industry data accumulating...</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Lead Industries */}
      {stats.topIndustries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-primary" />
              Top Lead Sources by Industry
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
                    <span className="font-medium capitalize">{ind.name.replace(/_/g, ' ')}</span>
                  </div>
                  <Badge>{ind.count} leads</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Speed + Domination Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-accent" />
              <div>
                <p className="font-semibold">Speed Rule Active</p>
                <p className="text-sm text-muted-foreground">Lead → Call → Demo → Payment within 5–10 minutes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold">Empire Rules</p>
                <p className="text-sm text-muted-foreground">Own relationship • Never lose a lead • Maximize LTV • Automate everything</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
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
