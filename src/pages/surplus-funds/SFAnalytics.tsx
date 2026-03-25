import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#BA7517', '#d97706', '#f59e0b', '#fbbf24', '#fcd34d', '#fef3c7'];

export default function SFAnalytics() {
  const { data: leads = [] } = useQuery({
    queryKey: ['sf-analytics-leads'],
    queryFn: async () => {
      const { data } = await supabase.from('surplus_funds_leads').select('status, state, lead_source, surplus_amount, created_at');
      return data ?? [];
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ['sf-analytics-cases'],
    queryFn: async () => {
      const { data } = await supabase.from('surplus_funds_cases').select('status, state, surplus_amount, our_expected_fee, amount_received, created_at, attorney_name');
      return data ?? [];
    },
  });

  // Pipeline by state
  const stateMap = new Map<string, number>();
  leads.forEach((l: any) => { if (l.state && l.surplus_amount) stateMap.set(l.state, (stateMap.get(l.state) || 0) + Number(l.surplus_amount)); });
  const byState = Array.from(stateMap.entries()).map(([state, value]) => ({ state, value })).sort((a, b) => b.value - a.value).slice(0, 10);

  // Lead source breakdown
  const sourceMap = new Map<string, number>();
  leads.forEach((l: any) => { const s = l.lead_source || 'unknown'; sourceMap.set(s, (sourceMap.get(s) || 0) + 1); });
  const bySources = Array.from(sourceMap.entries()).map(([name, value]) => ({ name, value }));

  // Revenue by month
  const monthMap = new Map<string, number>();
  cases.forEach((c: any) => { if (c.amount_received && c.created_at) { const m = c.created_at.slice(0, 7); monthMap.set(m, (monthMap.get(m) || 0) + Number(c.amount_received)); } });
  const revenueByMonth = Array.from(monthMap.entries()).map(([month, revenue]) => ({ month, revenue })).sort((a, b) => a.month.localeCompare(b.month));

  // KPIs
  const totalLeads = leads.length;
  const totalCases = cases.length;
  const convRate = totalLeads > 0 ? Math.round((totalCases / totalLeads) * 100) : 0;
  const totalReceived = cases.reduce((s: number, c: any) => s + (Number(c.amount_received) || 0), 0);
  const avgCaseValue = totalCases > 0 ? Math.round(cases.reduce((s: number, c: any) => s + (Number(c.our_expected_fee) || 0), 0) / totalCases) : 0;
  const bestState = byState[0]?.state || 'N/A';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-500">Analytics</h1>
        <p className="text-sm text-muted-foreground">Surplus Funds performance intelligence</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Best State', value: bestState },
          { label: 'Total Leads', value: totalLeads },
          { label: 'Conversion Rate', value: `${convRate}%` },
          { label: 'Avg Case Value', value: `$${avgCaseValue.toLocaleString()}` },
          { label: 'Total Received', value: `$${totalReceived.toLocaleString()}` },
        ].map(k => (
          <Card key={k.label} className="border-amber-500/20">
            <CardContent className="pt-4">
              <span className="text-xs text-muted-foreground">{k.label}</span>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pipeline by State */}
        <Card className="border-amber-500/20">
          <CardHeader><CardTitle className="text-sm">Pipeline Value by State</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byState}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="state" stroke="#888" />
                <YAxis stroke="#888" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="#BA7517" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Month */}
        <Card className="border-amber-500/20">
          <CardHeader><CardTitle className="text-sm">Revenue by Month</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="month" stroke="#888" />
                <YAxis stroke="#888" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `$${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="#BA7517" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Lead Source Breakdown */}
        <Card className="border-amber-500/20">
          <CardHeader><CardTitle className="text-sm">Lead Source</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={bySources} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {bySources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
