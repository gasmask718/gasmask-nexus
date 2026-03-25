import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Target, FileText, DollarSign, TrendingUp, Building2, Phone, Zap, Play, RefreshCw, CheckCircle, XCircle, Clock, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const GREEN = '#3B6D11';

const PIPELINE_STAGES = [
  { key: 'new', label: 'New Leads' },
  { key: 'phone_found', label: 'Skip Traced' },
  { key: 'called', label: 'Called' },
  { key: 'interested', label: 'Interested' },
  { key: 'offer_made', label: 'Offer Made' },
  { key: 'under_contract', label: 'Under Contract' },
  { key: 'buyer_found', label: 'Buyer Found' },
  { key: 'closed', label: 'Closed' },
];

const AUTOMATION_STATUS = [
  { key: 'lead_import', label: 'Lead Import', fn: 're-lead-import' },
  { key: 'skip_trace', label: 'Skip Trace', fn: 're-skip-trace' },
  { key: 'dc_campaign', label: 'DC Campaign', fn: 're-queue-dc-campaign' },
  { key: 'docusign', label: 'DocuSign', fn: '' },
  { key: 'buyer_blast', label: 'Buyer Blast', fn: 're-buyer-blast' },
];

export default function RECommandCenter() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLeads: 0, skipTracedToday: 0, callsToday: 0, interestedSellers: 0,
    dealsUnderContract: 0, feesMTD: 0, avgFee: 0, activeBuyers: 0,
  });
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [urgentDeals, setUrgentDeals] = useState<any[]>([]);
  const [vaPerformance, setVaPerformance] = useState<any[]>([]);
  const [automationHealth, setAutomationHealth] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
    fetchAutomationHealth();
  }, []);

  const fetchData = async () => {
    const [leadsRes, dealsRes, closedRes, buyersRes, vaRes] = await Promise.all([
      supabase.from('re_leads').select('id, status, skip_traced, updated_at', { count: 'exact' }),
      supabase.from('re_deals').select('*').in('status', ['under_contract', 'buyer_searching', 'buyer_found', 'assignment_signed', 'title_opened', 'closing_scheduled']),
      supabase.from('re_deals').select('assignment_fee_actual').eq('status', 'closed').gte('close_date_actual', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),
      supabase.from('re_buyers').select('id', { count: 'exact' }).eq('status', 'active'),
      supabase.from('re_va_profiles').select('*').eq('is_active', true),
    ]);

    const leads = leadsRes.data || [];
    const pipelineCounts: Record<string, number> = {};
    leads.forEach((l: any) => { pipelineCounts[l.status] = (pipelineCounts[l.status] || 0) + 1; });
    setPipeline(pipelineCounts);

    const today = new Date().toISOString().split('T')[0];
    const skipTracedToday = leads.filter(l => l.skip_traced && l.updated_at?.startsWith(today)).length;
    const interestedCount = leads.filter(l => ['interested', 'appointment_set'].includes(l.status)).length;

    const closedDeals = closedRes.data || [];
    const totalFees = closedDeals.reduce((s, d) => s + (d.assignment_fee_actual || 0), 0);
    const totalCalls = (vaRes.data || []).reduce((s, v) => s + (v.calls_today || 0), 0);

    setStats({
      totalLeads: leadsRes.count || 0,
      skipTracedToday,
      callsToday: totalCalls,
      interestedSellers: interestedCount,
      dealsUnderContract: (dealsRes.data || []).length,
      feesMTD: totalFees,
      avgFee: closedDeals.length > 0 ? totalFees / closedDeals.length : 0,
      activeBuyers: buyersRes.count || 0,
    });

    setVaPerformance(vaRes.data || []);

    const urgent = (dealsRes.data || []).filter(d => !d.buyer_name && ['under_contract', 'buyer_searching'].includes(d.status));
    setUrgentDeals(urgent.slice(0, 5));

    const { data: recentLeads } = await supabase.from('re_leads').select('property_address, status, updated_at, state').order('updated_at', { ascending: false }).limit(10);
    setRecentActivity(recentLeads || []);
  };

  const fetchAutomationHealth = async () => {
    const { data } = await supabase.from('re_automation_log').select('automation_type, status').order('created_at', { ascending: false }).limit(20);
    const health: Record<string, string> = {};
    AUTOMATION_STATUS.forEach(a => {
      const log = (data || []).find(l => l.automation_type === a.key);
      health[a.key] = log?.status === 'completed' ? 'running' : log?.status === 'failed' ? 'error' : 'ready';
    });
    if (!health.docusign) health.docusign = 'ready';
    setAutomationHealth(health);
  };

  const triggerBlast = async (dealId: string) => {
    try {
      await supabase.functions.invoke('re-buyer-blast', { body: { deal_id: dealId, manual: true } });
      toast.success('Buyer blast sent');
    } catch { toast.error('Blast failed'); }
  };

  const metricCards = [
    { label: 'Leads In Pipeline', value: stats.totalLeads.toLocaleString(), icon: Target },
    { label: 'Skip Traced Today', value: stats.skipTracedToday.toString(), icon: Search },
    { label: 'Calls Made Today', value: stats.callsToday.toString(), icon: Phone },
    { label: 'Interested Sellers', value: stats.interestedSellers.toString(), icon: Users },
    { label: 'Under Contract', value: stats.dealsUnderContract.toString(), icon: FileText },
    { label: 'Fees MTD', value: `$${(stats.feesMTD / 1000).toFixed(0)}K`, icon: DollarSign },
    { label: 'Avg Fee', value: `$${(stats.avgFee / 1000).toFixed(1)}K`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: GREEN }}>Penthouse — Command Center</h1>
        <p className="text-muted-foreground">The $1M/month war room — wholesale acquisition engine</p>
      </div>

      {/* Live Automation Status Strip */}
      <div className="flex items-center gap-4 p-3 rounded-lg border border-border bg-card/50 overflow-x-auto">
        {AUTOMATION_STATUS.map(a => {
          const status = automationHealth[a.key] || 'ready';
          return (
            <button
              key={a.key}
              className="flex items-center gap-2 text-sm whitespace-nowrap"
              onClick={() => status === 'error' && navigate('/real-estate/automation')}
            >
              <div className={`h-2.5 w-2.5 rounded-full ${
                status === 'running' ? 'bg-green-500 animate-pulse' :
                status === 'error' ? 'bg-red-500' : 'bg-green-500'
              }`} />
              <span className={status === 'error' ? 'text-red-400' : 'text-muted-foreground'}>{a.label}: {status === 'running' ? 'Running' : status === 'error' ? 'Error' : 'Ready'}</span>
            </button>
          );
        })}
      </div>

      {/* 7 Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {metricCards.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
              <CardTitle className="text-[10px] font-medium text-muted-foreground uppercase">{m.label}</CardTitle>
              <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xl font-bold">{m.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <Card>
        <CardHeader><CardTitle>Acquisition Pipeline</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => {
              const count = pipeline[stage.key] || 0;
              const prevCount = i > 0 ? (pipeline[PIPELINE_STAGES[i - 1].key] || 1) : count;
              const rate = i > 0 && prevCount > 0 ? ((count / prevCount) * 100).toFixed(0) : '';
              return (
                <div key={stage.key} className="flex items-center gap-1">
                  <div className="text-center min-w-[85px] p-2 rounded-lg" style={{ backgroundColor: `rgba(59,109,17,${0.05 + i * 0.03})` }}>
                    <div className="text-xl font-bold">{count}</div>
                    <div className="text-[10px] text-muted-foreground">{stage.label}</div>
                    {rate && <div className="text-[10px] font-medium" style={{ color: GREEN }}>{rate}%</div>}
                  </div>
                  {i < PIPELINE_STAGES.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
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
              <p className="text-muted-foreground text-sm">No urgent deals — all buyers assigned ✓</p>
            ) : urgentDeals.map((d) => {
              const daysLeft = d.close_date_target ? Math.ceil((new Date(d.close_date_target).getTime() - Date.now()) / 86400000) : null;
              return (
                <div key={d.id} className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <div className="font-medium text-sm">{d.property_address}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.state} | ARV: ${(d.arv || 0).toLocaleString()} | Ask: ${(d.purchase_price || 0).toLocaleString()}
                      {daysLeft !== null && <span className="text-red-400 ml-2">{daysLeft}d remaining</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">NEEDS BUYER</Badge>
                    <Button size="sm" variant="outline" onClick={() => triggerBlast(d.id)}>Blast</Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* VA Performance */}
        <Card>
          <CardHeader><CardTitle>VA Performance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {vaPerformance.length === 0 ? (
              <p className="text-muted-foreground text-sm">No active VAs</p>
            ) : vaPerformance.sort((a, b) => (b.revenue_mtd || 0) - (a.revenue_mtd || 0)).map((v, i) => (
              <div key={v.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                  <span className="font-medium">{v.name}</span>
                  <Badge variant="outline" className="text-[10px]">{v.role}</Badge>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{v.calls_today || 0} calls</span>
                  <span>{v.contracts_mtd || 0} contracts</span>
                  <span style={{ color: GREEN }}>${(v.revenue_mtd || 0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader><CardTitle>Live Activity Feed</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recentActivity.map((a, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  a.status === 'under_contract' ? 'bg-green-500' :
                  a.status === 'buyer_found' ? 'bg-green-500' :
                  ['interested', 'appointment_set'].includes(a.status) ? 'bg-amber-500' : 'bg-muted-foreground'
                }`} />
                <span className="font-medium">{a.property_address}</span>
                <span className="text-muted-foreground">{a.state}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={a.status === 'under_contract' ? 'default' : 'secondary'} style={a.status === 'under_contract' ? { backgroundColor: GREEN } : undefined}>
                  {a.status?.replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">{new Date(a.updated_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
