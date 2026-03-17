import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRetentionMetrics, useClientValue } from '@/hooks/useBrandaroRetention';
import {
  Heart, Shield, TrendingUp, AlertTriangle, Users, DollarSign,
  Clock, Star, Repeat, Activity, Crown, BarChart3
} from 'lucide-react';

const stageConfig: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: 'New', color: 'bg-blue-500', icon: Users },
  onboarding: { label: 'Onboarding', color: 'bg-cyan-500', icon: Clock },
  active: { label: 'Active', color: 'bg-green-500', icon: Activity },
  growth: { label: 'Growth', color: 'bg-emerald-500', icon: TrendingUp },
  at_risk: { label: 'At Risk', color: 'bg-amber-500', icon: AlertTriangle },
  churned: { label: 'Churned', color: 'bg-red-500', icon: Shield },
};

const gradeColors: Record<string, string> = {
  A: 'bg-emerald-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-amber-500 text-white',
  D: 'bg-orange-500 text-white',
  F: 'bg-red-500 text-white',
};

export default function RetentionDashboardPage() {
  const { data: metrics, isLoading } = useRetentionMetrics();
  const { data: topClients } = useClientValue();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = metrics || {
    stages: {}, mrr: 0, avgSatisfaction: 0, atRisk: 0, healthy: 0,
    avgLTV: 0, avgLifespan: 0, grades: {}, churnRate: 0,
    totalClients: 0, touchpointsSent: 0, touchpointsPending: 0,
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Heart className="h-8 w-8 text-red-500" />
          Client Retention Engine
        </h1>
        <p className="text-muted-foreground">LTV Maximizer — Keep clients paying, growing, and happy</p>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Repeat} label="Monthly Recurring" value={fmt(m.mrr)} sub="Active MRR" color="text-emerald-500" />
        <KPICard icon={Crown} label="Avg Client LTV" value={fmt(m.avgLTV)} sub={`${m.avgLifespan.toFixed(1)} mo avg lifespan`} color="text-amber-500" />
        <KPICard icon={AlertTriangle} label="Churn Rate" value={`${m.churnRate.toFixed(1)}%`} sub={`${m.atRisk} at risk`} color="text-red-500" />
        <KPICard icon={Star} label="Avg Satisfaction" value={`${m.avgSatisfaction.toFixed(0)}/100`} sub={`${m.healthy} healthy`} color="text-blue-500" />
      </div>

      {/* Client Lifecycle Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Client Lifecycle Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(stageConfig).map(([key, cfg]) => {
              const count = m.stages[key] || 0;
              const Icon = cfg.icon;
              return (
                <div key={key} className="text-center p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className={`mx-auto w-10 h-10 rounded-full ${cfg.color} flex items-center justify-center`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Client Grade Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Client Grade Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['A', 'B', 'C', 'D', 'F'].map(grade => {
                const count = m.grades[grade] || 0;
                const pct = m.totalClients > 0 ? (count / m.totalClients) * 100 : 0;
                return (
                  <div key={grade} className="flex items-center gap-3">
                    <Badge className={`${gradeColors[grade]} w-8 h-8 flex items-center justify-center text-sm font-bold`}>
                      {grade}
                    </Badge>
                    <div className="flex-1">
                      <Progress value={pct} className="h-3" />
                    </div>
                    <span className="text-sm font-medium w-16 text-right">{count} ({pct.toFixed(0)}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Touchpoint Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Relationship Automation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Touchpoints Sent</p>
                <p className="text-xs text-muted-foreground">Check-ins, reports, win alerts</p>
              </div>
              <span className="text-2xl font-bold text-primary">{m.touchpointsSent}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div>
                <p className="font-medium">Scheduled</p>
                <p className="text-xs text-muted-foreground">Upcoming automated messages</p>
              </div>
              <span className="text-2xl font-bold text-amber-500">{m.touchpointsPending}</span>
            </div>
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <p className="text-sm font-medium">🔄 Auto-Sequence Active</p>
              <p className="text-xs text-muted-foreground mt-1">
                Weekly check-ins • Monthly reports • Win notifications • Re-engagement triggers
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Clients by Value */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Top Clients by Lifetime Value
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(topClients || []).length > 0 ? (
            <div className="space-y-3">
              {(topClients || []).slice(0, 8).map((c: any, i: number) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Badge variant={i < 3 ? "default" : "outline"} className="w-6 h-6 flex items-center justify-center text-xs p-0">
                      {i + 1}
                    </Badge>
                    <div>
                      <p className="font-medium">{c.brandaro_leads_master?.business_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {c.brandaro_leads_master?.industry?.replace(/_/g, ' ') || 'N/A'} • {c.months_active || 0} months
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{fmt(c.total_spent || 0)}</p>
                    <p className="text-xs text-muted-foreground">{fmt(c.monthly_value || 0)}/mo</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Client value data will populate as clients pay and engage.</p>
          )}
        </CardContent>
      </Card>

      {/* Retention Rules */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <p className="font-semibold mb-2">🔒 Retention Rules (Always Active)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <p>• Never let a client go silent</p>
            <p>• Always show measurable results</p>
            <p>• Push upgrades at 7d, 30d, 60d</p>
            <p>• Re-engage at-risk clients instantly</p>
            <p>• Weekly check-ins for all active clients</p>
            <p>• Client relationship = recurring revenue</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub: string; color: string;
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
