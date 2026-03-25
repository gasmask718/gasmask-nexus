import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, DollarSign, Target, Phone, Users, Zap, BarChart3, Sun, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

const AMBER = '#E8A317';

export default function SolarAnalytics() {
  const { data: stats } = useQuery({
    queryKey: ['solar-analytics'],
    queryFn: async () => {
      const [leads, qualified, appointed, deals, interactions, partners] = await Promise.all([
        supabase.from('solar_leads').select('lead_source, status, lead_score, created_at'),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'qualified'),
        supabase.from('solar_leads').select('id', { count: 'exact', head: true }).eq('status', 'appointment_booked'),
        supabase.from('solar_deals').select('deal_value, commission_amount, stage, created_at'),
        supabase.from('solar_interactions').select('interaction_type, sentiment_score, created_at'),
        supabase.from('solar_partners').select('company_name, avg_close_rate, ranking_score').eq('status', 'active'),
      ]);

      const allLeads = leads.data || [];
      const allDeals = deals.data || [];
      const allInteractions = interactions.data || [];
      const wonDeals = allDeals.filter(d => d.stage === 'closed_won');
      const totalRevenue = wonDeals.reduce((s, d) => s + (Number(d.deal_value) || 0), 0);
      const totalCommission = wonDeals.reduce((s, d) => s + (Number(d.commission_amount) || 0), 0);

      // Source breakdown
      const sourceMap: Record<string, number> = {};
      allLeads.forEach(l => { const src = l.lead_source || 'unknown'; sourceMap[src] = (sourceMap[src] || 0) + 1; });

      // Conversion rates
      const qualRate = allLeads.length ? ((qualified.count || 0) / allLeads.length * 100) : 0;
      const apptRate = allLeads.length ? ((appointed.count || 0) / allLeads.length * 100) : 0;
      const closeRate = allDeals.length ? (wonDeals.length / allDeals.length * 100) : 0;

      return {
        totalLeads: allLeads.length,
        qualifiedCount: qualified.count || 0,
        appointmentCount: appointed.count || 0,
        totalDeals: allDeals.length,
        wonDeals: wonDeals.length,
        totalRevenue,
        totalCommission,
        avgDealSize: wonDeals.length ? totalRevenue / wonDeals.length : 0,
        qualRate,
        apptRate,
        closeRate,
        totalCalls: allInteractions.filter(i => i.interaction_type === 'call').length,
        totalSMS: allInteractions.filter(i => i.interaction_type === 'sms').length,
        avgSentiment: allInteractions.filter(i => i.sentiment_score != null).length
          ? allInteractions.filter(i => i.sentiment_score != null).reduce((s, i) => s + Number(i.sentiment_score), 0) / allInteractions.filter(i => i.sentiment_score != null).length
          : 0,
        sourceBreakdown: Object.entries(sourceMap).sort((a, b) => b[1] - a[1]),
        topPartners: (partners.data || []).sort((a: any, b: any) => (b.ranking_score || 0) - (a.ranking_score || 0)).slice(0, 5),
      };
    },
    refetchInterval: 60000,
  });

  const s = stats || {
    totalLeads: 0, qualifiedCount: 0, appointmentCount: 0, totalDeals: 0, wonDeals: 0,
    totalRevenue: 0, totalCommission: 0, avgDealSize: 0, qualRate: 0, apptRate: 0, closeRate: 0,
    totalCalls: 0, totalSMS: 0, avgSentiment: 0, sourceBreakdown: [], topPartners: [],
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" style={{ color: AMBER }} />
          Floor 10 — Analytics Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">Performance intelligence across the entire solar engine</p>
      </div>

      {/* Revenue Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: `$${s.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-green-400', sub: `${s.wonDeals} deals` },
          { label: 'Commission', value: `$${s.totalCommission.toLocaleString()}`, icon: TrendingUp, color: 'text-amber-400', sub: 'earned' },
          { label: 'Avg Deal Size', value: `$${s.avgDealSize.toLocaleString()}`, icon: Zap, color: 'text-blue-400', sub: 'per closed deal' },
          { label: 'Close Rate', value: `${s.closeRate.toFixed(1)}%`, icon: Target, color: 'text-purple-400', sub: `${s.wonDeals}/${s.totalDeals}` },
        ].map((m) => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" style={{ color: AMBER }} />
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { stage: 'Total Leads', count: s.totalLeads, pct: 100, color: 'bg-gray-500' },
              { stage: 'Qualified', count: s.qualifiedCount, pct: s.qualRate, color: 'bg-orange-500' },
              { stage: 'Appointments', count: s.appointmentCount, pct: s.apptRate, color: 'bg-purple-500' },
              { stage: 'Deals Created', count: s.totalDeals, pct: s.totalLeads ? (s.totalDeals / s.totalLeads * 100) : 0, color: 'bg-blue-500' },
              { stage: 'Closed Won', count: s.wonDeals, pct: s.totalLeads ? (s.wonDeals / s.totalLeads * 100) : 0, color: 'bg-green-500' },
            ].map((f) => (
              <div key={f.stage} className="flex items-center gap-4">
                <div className="w-32 text-sm font-medium">{f.stage}</div>
                <div className="flex-1 bg-muted/30 rounded-full h-6 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.color} transition-all duration-500`}
                    style={{ width: `${Math.max(f.pct, 2)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {f.count}
                  </span>
                </div>
                <div className="w-16 text-right text-sm font-medium">{f.pct.toFixed(1)}%</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lead Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {s.sourceBreakdown.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">No data yet</p>
            ) : (
              <div className="space-y-3">
                {s.sourceBreakdown.map(([source, count]: [string, number]) => (
                  <div key={source} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: AMBER }} />
                      <span className="text-sm capitalize">{source}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{count}</span>
                      <span className="text-xs text-muted-foreground">({(count / s.totalLeads * 100).toFixed(0)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outreach Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Outreach Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-green-400" />
                  <span className="text-sm">Calls Made</span>
                </div>
                <span className="text-lg font-bold">{s.totalCalls}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-400" />
                  <span className="text-sm">SMS Sent</span>
                </div>
                <span className="text-lg font-bold">{s.totalSMS}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4" style={{ color: AMBER }} />
                  <span className="text-sm">Avg Sentiment</span>
                </div>
                <span className="text-lg font-bold">
                  {s.avgSentiment > 0.5 ? '😊' : s.avgSentiment > 0 ? '😐' : '—'} {s.avgSentiment > 0 ? s.avgSentiment.toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Partners */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" style={{ color: AMBER }} />
            Top Partner Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {s.topPartners.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No partners yet</p>
          ) : (
            <div className="space-y-3">
              {s.topPartners.map((p: any, i: number) => (
                <div key={p.company_name} className="flex items-center gap-3 p-3 rounded-lg border border-border/30">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${AMBER}20`, color: AMBER }}>
                    #{i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.company_name}</p>
                  </div>
                  <Badge variant="outline">{p.avg_close_rate}% close</Badge>
                  <Badge variant="outline" style={{ color: AMBER, borderColor: AMBER }}>Score: {p.ranking_score}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Capacity Projection */}
      <Card className="border-2" style={{ borderColor: `${AMBER}30` }}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sun className="h-5 w-5" style={{ color: AMBER }} />
            $1M/Month Capacity Projection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3 rounded-lg bg-muted/20">
              <p className="text-2xl font-bold">100+</p>
              <p className="text-xs text-muted-foreground">Leads/Day Target</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20">
              <p className="text-2xl font-bold">25%</p>
              <p className="text-xs text-muted-foreground">Qualification Rate</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20">
              <p className="text-2xl font-bold">15%</p>
              <p className="text-xs text-muted-foreground">Close Rate</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/20">
              <p className="text-2xl font-bold">$5K</p>
              <p className="text-xs text-muted-foreground">Avg Deal Value</p>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: `${AMBER}10` }}>
              <p className="text-2xl font-bold" style={{ color: AMBER }}>$1.1M</p>
              <p className="text-xs text-muted-foreground">Projected Monthly</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
