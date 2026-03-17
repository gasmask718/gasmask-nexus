import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useReportingOverview, useClientReports, useAdsCampaigns } from '@/hooks/useBrandaroReporting';
import {
  BarChart3, Eye, Users, DollarSign, TrendingUp, Megaphone,
  Send, Heart, Zap, Target, ArrowUpRight
} from 'lucide-react';

export default function ClientReportingPage() {
  const { data: overview, isLoading } = useReportingOverview();
  const { data: reports } = useClientReports();
  const { data: campaigns } = useAdsCampaigns();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const o = overview || {
    totalVisitors: 0, totalLeads: 0, totalRevEst: 0, reportsSent: 0,
    avgSatisfaction: 0, totalAutoMessages: 0, managedClients: 0,
    totalAdSpend: 0, totalAdLeads: 0, totalAdRevenue: 0, avgROI: 0, activeCampaigns: 0,
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Client Reporting & AI Account Manager
        </h1>
        <p className="text-muted-foreground">Value perception engine — Show results, retain clients, upsell automatically</p>
      </div>

      {/* Reporting KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Eye} label="Total Visitors" value={o.totalVisitors.toLocaleString()} sub="Across all clients" color="text-blue-500" />
        <KPI icon={Users} label="Leads Generated" value={o.totalLeads.toLocaleString()} sub="From client sites" color="text-green-500" />
        <KPI icon={DollarSign} label="Est. Revenue" value={fmt(o.totalRevEst)} sub="Attributed to clients" color="text-emerald-500" />
        <KPI icon={Send} label="Reports Sent" value={o.reportsSent.toString()} sub="Weekly + monthly" color="text-purple-500" />
      </div>

      {/* AI Account Manager + Ads KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={Heart} label="Avg Satisfaction" value={`${o.avgSatisfaction.toFixed(0)}/100`} sub={`${o.managedClients} managed`} color="text-red-500" />
        <KPI icon={Zap} label="Auto Messages" value={o.totalAutoMessages.toString()} sub="Sent by AI manager" color="text-amber-500" />
        <KPI icon={Megaphone} label="Ad Spend" value={fmt(o.totalAdSpend)} sub={`${o.activeCampaigns} active`} color="text-orange-500" />
        <KPI icon={TrendingUp} label="Ads ROI" value={`${o.avgROI.toFixed(0)}%`} sub={`${o.totalAdLeads} leads`} color="text-cyan-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Recent Client Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(reports || []).length > 0 ? (
              <div className="space-y-3">
                {(reports || []).slice(0, 8).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{r.brandaro_leads_master?.business_name || 'Client'}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {r.period} • {r.visitors} visits • {r.leads_generated} leads
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{fmt(r.revenue_estimate || 0)}</p>
                      {r.growth_pct > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <ArrowUpRight className="h-3 w-3 mr-1" />+{r.growth_pct}%
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Reports will populate as client data flows in.</p>
            )}
          </CardContent>
        </Card>

        {/* Active Ad Campaigns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Active Ad Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(campaigns || []).length > 0 ? (
              <div className="space-y-3">
                {(campaigns || []).slice(0, 8).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{c.brandaro_leads_master?.business_name || 'Client'}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {c.platform} • {c.leads_generated} leads • CPL: {fmt(c.cost_per_lead || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={c.status === 'active' ? 'default' : 'secondary'}>{c.status}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">ROI: {c.roi_pct?.toFixed(0) || 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No ad campaigns yet. Set up Google Ads for clients to start tracking.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Value Perception Engine */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Value Perception Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm font-medium mb-1">📊 Auto-Generated Messages</p>
              <p className="text-xs text-muted-foreground">"You received 18 new customer inquiries this month"</p>
              <p className="text-xs text-muted-foreground mt-1">"Your visibility grew +32% 🚀"</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm font-medium mb-1">💰 ROI Display</p>
              <p className="text-xs text-muted-foreground">"You spent $300 → generated 15 leads"</p>
              <p className="text-xs text-muted-foreground mt-1">"Estimated revenue: $4,500"</p>
            </div>
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm font-medium mb-1">🚀 Upsell Triggers</p>
              <p className="text-xs text-muted-foreground">"Want more leads like this?"</p>
              <p className="text-xs text-muted-foreground mt-1">→ Upgrade to SEO • Run Ads</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <p className="font-semibold mb-2">🔒 Perception = Retention (Always Active)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
            <p>• Always show measurable results</p>
            <p>• Always communicate growth</p>
            <p>• Suggest upgrades at every touchpoint</p>
            <p>• Never let a client feel stagnant</p>
            <p>• Weekly reports auto-sent via SMS</p>
            <p>• AI manager detects dissatisfaction early</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, color }: {
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
