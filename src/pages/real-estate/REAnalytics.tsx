import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function REAnalytics() {
  const [stats, setStats] = useState({ totalLeads: 0, totalDeals: 0, closedDeals: 0, totalRevenue: 0, avgFee: 0, convRate: 0 });

  useEffect(() => {
    Promise.all([
      supabase.from('re_leads').select('id', { count: 'exact', head: true }),
      supabase.from('re_deals').select('id', { count: 'exact', head: true }),
      supabase.from('re_deals').select('assignment_fee_actual').eq('status', 'closed'),
    ]).then(([leads, deals, closed]) => {
      const closedData = closed.data || [];
      const rev = closedData.reduce((s, d) => s + (d.assignment_fee_actual || 0), 0);
      setStats({
        totalLeads: leads.count || 0,
        totalDeals: deals.count || 0,
        closedDeals: closedData.length,
        totalRevenue: rev,
        avgFee: closedData.length > 0 ? rev / closedData.length : 0,
        convRate: (leads.count || 0) > 0 ? (closedData.length / (leads.count || 1)) * 100 : 0,
      });
    });
  }, []);

  const kpis = [
    { label: 'Total Leads', value: stats.totalLeads.toLocaleString() },
    { label: 'Total Deals', value: stats.totalDeals.toString() },
    { label: 'Closed Deals', value: stats.closedDeals.toString() },
    { label: 'Total Revenue', value: `$${(stats.totalRevenue / 1000).toFixed(0)}K` },
    { label: 'Avg Assignment Fee', value: `$${(stats.avgFee / 1000).toFixed(1)}K` },
    { label: 'Lead → Close Rate', value: `${stats.convRate.toFixed(1)}%` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#3B6D11' }}>Floor 9 — Analytics & Revenue</h1>
        <p className="text-muted-foreground">The scoreboard for $1M/month</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{k.value}</div>
              <div className="text-xs text-muted-foreground">{k.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue Target: $1M/month</CardTitle></CardHeader>
        <CardContent>
          <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min((stats.totalRevenue / 1000000) * 100, 100)}%`,
              backgroundColor: '#3B6D11',
            }} />
          </div>
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>${(stats.totalRevenue / 1000).toFixed(0)}K earned</span>
            <span>$1,000K target</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Deal Score Distribution</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">A = $30K+ spread | B = $15-30K | C = $5-15K</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Markets by Revenue</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">FL, TX, GA, OH, NC, TN — Tier 1 states</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
