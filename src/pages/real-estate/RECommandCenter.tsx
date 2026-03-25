import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Target, FileText, DollarSign, TrendingUp, Building2, Phone } from 'lucide-react';

const GREEN = '#3B6D11';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New Leads' },
  { key: 'phone_found', label: 'Phone Found' },
  { key: 'called', label: 'Called' },
  { key: 'interested', label: 'Interested' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'buyer_found', label: 'Buyer Found' },
  { key: 'closed', label: 'Closed' },
];

export default function RECommandCenter() {
  const [stats, setStats] = useState({
    totalLeads: 0, dealsUnderContract: 0, feesMTD: 0,
    avgFee: 0, activeBuyers: 0, vaCalls: 0,
  });
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [urgentDeals, setUrgentDeals] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [leadsRes, dealsRes, closedRes, buyersRes, vaRes] = await Promise.all([
      supabase.from('re_leads').select('id, status', { count: 'exact' }),
      supabase.from('re_deals').select('*').in('status', ['under_contract', 'buyer_searching', 'buyer_found', 'assignment_signed', 'title_opened', 'closing_scheduled']),
      supabase.from('re_deals').select('assignment_fee_actual').eq('status', 'closed').gte('close_date_actual', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      supabase.from('re_buyers').select('id', { count: 'exact' }).eq('status', 'active'),
      supabase.from('re_va_profiles').select('calls_today').eq('is_active', true),
    ]);

    const leads = leadsRes.data || [];
    const pipelineCounts: Record<string, number> = {};
    leads.forEach((l: any) => { pipelineCounts[l.status] = (pipelineCounts[l.status] || 0) + 1; });
    setPipeline(pipelineCounts);

    const closedDeals = closedRes.data || [];
    const totalFees = closedDeals.reduce((s, d) => s + (d.assignment_fee_actual || 0), 0);
    const totalCalls = (vaRes.data || []).reduce((s, v) => s + (v.calls_today || 0), 0);

    setStats({
      totalLeads: leadsRes.count || 0,
      dealsUnderContract: (dealsRes.data || []).length,
      feesMTD: totalFees,
      avgFee: closedDeals.length > 0 ? totalFees / closedDeals.length : 0,
      activeBuyers: buyersRes.count || 0,
      vaCalls: totalCalls,
    });

    // Urgent deals (under contract, no buyer)
    const urgent = (dealsRes.data || []).filter(d => !d.buyer_name && ['under_contract', 'buyer_searching'].includes(d.status));
    setUrgentDeals(urgent.slice(0, 5));

    // Recent activity
    const { data: recentLeads } = await supabase.from('re_leads').select('property_address, status, updated_at, state').order('updated_at', { ascending: false }).limit(10);
    setRecentActivity(recentLeads || []);
  };

  const metricCards = [
    { label: 'Leads In Pipeline', value: stats.totalLeads.toLocaleString(), icon: Target },
    { label: 'Deals Under Contract', value: stats.dealsUnderContract.toString(), icon: FileText },
    { label: 'Assignment Fees MTD', value: `$${(stats.feesMTD / 1000).toFixed(0)}K`, icon: DollarSign },
    { label: 'Avg Assignment Fee', value: `$${(stats.avgFee / 1000).toFixed(1)}K`, icon: TrendingUp },
    { label: 'Active Buyers', value: stats.activeBuyers.toString(), icon: Building2 },
    { label: 'VA Calls Today', value: stats.vaCalls.toString(), icon: Phone },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: GREEN }}>Real Estate OS</h1>
        <p className="text-muted-foreground">Wholesale acquisition engine — 50 states</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metricCards.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">{m.label}</CardTitle>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <Card>
        <CardHeader><CardTitle>Acquisition Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = pipeline[stage.key] || 0;
              const prevCount = i > 0 ? (pipeline[PIPELINE_STAGES[i - 1].key] || 1) : count;
              const rate = i > 0 && prevCount > 0 ? ((count / prevCount) * 100).toFixed(0) : '';
              return (
                <div key={stage.key} className="flex items-center gap-2">
                  <div className="text-center min-w-[100px]">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground">{stage.label}</div>
                    {rate && <div className="text-xs" style={{ color: GREEN }}>{rate}% →</div>}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && <div className="text-muted-foreground">→</div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Deals */}
        <Card>
          <CardHeader><CardTitle className="text-amber-500">⚠️ Deals Needing Buyers</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {urgentDeals.length === 0 ? (
              <p className="text-muted-foreground text-sm">No urgent deals</p>
            ) : urgentDeals.map((d) => (
              <div key={d.id} className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <div className="font-medium text-sm">{d.property_address}</div>
                  <div className="text-xs text-muted-foreground">{d.state} | ARV: ${(d.arv || 0).toLocaleString()}</div>
                </div>
                <Badge variant="destructive">NEEDS BUYER</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <div>
                  <span className="font-medium">{a.property_address}</span>
                  <span className="text-muted-foreground ml-2">{a.state}</span>
                </div>
                <Badge variant={a.status === 'under_contract' ? 'default' : 'secondary'}>{a.status?.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
