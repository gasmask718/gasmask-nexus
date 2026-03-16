import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, DollarSign, Users, BarChart3, Target, Percent } from 'lucide-react';

export default function RevenueAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalRevenue: 0,
    mrr: 0,
    oneTimeRevenue: 0,
    avgDealSize: 0,
    totalClients: 0,
    activeClients: 0,
    proposals: 0,
    accepted: 0,
    closeRate: 0,
    demos: 0,
    demoToProposal: 0,
    byPackage: [] as { tier: string; count: number; revenue: number }[],
  });

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [
        { data: proposals },
        { data: clients },
        { data: subs },
        { data: demos },
      ] = await Promise.all([
        (supabase as any).from('brandaro_proposals').select('*'),
        (supabase as any).from('brandaro_clients').select('*'),
        (supabase as any).from('brandaro_subscriptions').select('*').eq('status', 'active'),
        (supabase as any).from('brandaro_demo_sites').select('id'),
      ]);

      const accepted = (proposals || []).filter((p: any) => p.status === 'accepted');
      const mrr = (subs || []).reduce((s: number, sub: any) => s + (sub.monthly_fee || 0), 0);
      const oneTime = accepted.reduce((s: number, p: any) => s + (p.total_price || 0), 0);

      // Revenue by package
      const tiers = ['starter', 'professional', 'premium', 'elite'];
      const byPackage = tiers.map(tier => ({
        tier,
        count: accepted.filter((p: any) => p.package_tier === tier).length,
        revenue: accepted.filter((p: any) => p.package_tier === tier).reduce((s: number, p: any) => s + (p.total_price || 0), 0),
      }));

      setMetrics({
        totalRevenue: oneTime + mrr,
        mrr,
        oneTimeRevenue: oneTime,
        avgDealSize: accepted.length > 0 ? Math.round(oneTime / accepted.length) : 0,
        totalClients: (clients || []).length,
        activeClients: (clients || []).filter((c: any) => c.client_status === 'active').length,
        proposals: (proposals || []).length,
        accepted: accepted.length,
        closeRate: (proposals || []).length > 0 ? Math.round((accepted.length / (proposals || []).length) * 100) : 0,
        demos: (demos || []).length,
        demoToProposal: (demos || []).length > 0 ? Math.round(((proposals || []).length / (demos || []).length) * 100) : 0,
        byPackage,
      });
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue Analytics</h1>
        <p className="text-muted-foreground">Complete financial overview of the Brandaro conversion engine</p>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${metrics.totalRevenue.toLocaleString()}`, icon: DollarSign, sub: 'All time' },
          { label: 'Monthly Recurring', value: `$${metrics.mrr.toLocaleString()}`, icon: TrendingUp, sub: 'Active subs' },
          { label: 'One-Time Revenue', value: `$${metrics.oneTimeRevenue.toLocaleString()}`, icon: BarChart3, sub: 'Website builds' },
          { label: 'Avg Deal Size', value: `$${metrics.avgDealSize.toLocaleString()}`, icon: Target, sub: 'Per accepted' },
        ].map(m => (
          <Card key={m.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <m.icon className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Conversion Funnel</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Demos Created', value: metrics.demos },
              { label: 'Proposals Sent', value: metrics.proposals },
              { label: 'Proposals Accepted', value: metrics.accepted },
              { label: 'Close Rate', value: `${metrics.closeRate}%` },
              { label: 'Demo→Proposal', value: `${metrics.demoToProposal}%` },
            ].map(f => (
              <div key={f.label} className="text-center p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-foreground">{f.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Package */}
      <Card>
        <CardHeader><CardTitle className="text-lg">Revenue by Package</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {metrics.byPackage.map(pkg => (
              <div key={pkg.tier} className="p-4 rounded-lg border bg-card">
                <Badge variant="outline" className="capitalize mb-2">{pkg.tier}</Badge>
                <p className="text-xl font-bold text-foreground">${pkg.revenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{pkg.count} deals</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Client Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Client Base</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Clients</span>
              <span className="font-semibold">{metrics.totalClients}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Clients</span>
              <span className="font-semibold text-green-600">{metrics.activeClients}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Projected Annual Revenue</span>
              <span className="font-semibold">${(metrics.mrr * 12 + metrics.oneTimeRevenue).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Subscription Health</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active MRR</span>
              <span className="font-semibold text-primary">${metrics.mrr.toLocaleString()}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Annual Run Rate</span>
              <span className="font-semibold">${(metrics.mrr * 12).toLocaleString()}/yr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg Revenue Per Client</span>
              <span className="font-semibold">
                ${metrics.activeClients > 0 ? Math.round(metrics.mrr / metrics.activeClients).toLocaleString() : 0}/mo
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
