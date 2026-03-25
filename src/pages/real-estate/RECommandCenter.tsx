import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Target, FileText, DollarSign, TrendingUp, Building2, Phone, Zap, Play, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

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

const AUTOMATION_JOBS = [
  { key: 'lead_import', label: 'Lead Import', desc: 'PropStream + Zillow + BatchLeads', schedule: 'Monday 6am', fn: 're-lead-import' },
  { key: 'skip_trace', label: 'Skip Trace', desc: 'BatchSkipTracing API', schedule: 'Daily 7am + on insert', fn: 're-skip-trace' },
  { key: 'queue_dc_campaign', label: 'Queue DC Campaign', desc: 'Auto-queue leads for Dynasty Connect', schedule: 'Weekdays 9am', fn: 're-queue-dc-campaign' },
  { key: 'generate_deal_sheet', label: 'Deal Sheet Gen', desc: 'Auto on contract signed', schedule: 'On event', fn: 're-generate-deal-sheet' },
  { key: 'buyer_blast', label: 'Buyer Blast', desc: 'Email + SMS matching buyers', schedule: 'On event', fn: 're-buyer-blast' },
];

export default function RECommandCenter() {
  const [stats, setStats] = useState({
    totalLeads: 0, dealsUnderContract: 0, feesMTD: 0,
    avgFee: 0, activeBuyers: 0, vaCalls: 0,
  });
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [urgentDeals, setUrgentDeals] = useState<any[]>([]);
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    fetchAutomationLogs();
    fetchSourceStats();
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

    const urgent = (dealsRes.data || []).filter(d => !d.buyer_name && ['under_contract', 'buyer_searching'].includes(d.status));
    setUrgentDeals(urgent.slice(0, 5));

    const { data: recentLeads } = await supabase.from('re_leads').select('property_address, status, updated_at, state').order('updated_at', { ascending: false }).limit(10);
    setRecentActivity(recentLeads || []);
  };

  const fetchAutomationLogs = async () => {
    const { data } = await supabase.from('re_automation_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setAutomationLogs(data || []);
  };

  const fetchSourceStats = async () => {
    const { data: leads } = await supabase.from('re_leads').select('lead_source, status, skip_traced');
    if (!leads) return;
    const sources: Record<string, { total: number; traced: number; interested: number; contracts: number }> = {};
    leads.forEach(l => {
      const src = l.lead_source || 'unknown';
      if (!sources[src]) sources[src] = { total: 0, traced: 0, interested: 0, contracts: 0 };
      sources[src].total++;
      if (l.skip_traced) sources[src].traced++;
      if (l.status === 'interested') sources[src].interested++;
      if (l.status === 'under_contract') sources[src].contracts++;
    });
    setSourceStats(Object.entries(sources).map(([name, s]) => ({ name, ...s })));
  };

  const triggerAutomation = async (fnName: string, jobKey: string) => {
    setRunningJob(jobKey);
    toast.info(`Running ${jobKey}...`);
    try {
      const { error } = await supabase.functions.invoke(fnName, { body: {} });
      if (error) throw error;
      toast.success(`${jobKey} completed`);
      fetchAutomationLogs();
      fetchData();
    } catch (e: any) {
      toast.error(`${jobKey} failed: ${e.message}`);
    } finally {
      setRunningJob(null);
    }
  };

  const getLastRun = (type: string) => {
    return automationLogs.find(l => l.automation_type === type);
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

      {/* Automation Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: GREEN }} />
            Automation Control Panel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {AUTOMATION_JOBS.map(job => {
              const lastRun = getLastRun(job.key);
              const isRunning = runningJob === job.key;
              return (
                <div key={job.key} className="flex items-center justify-between border border-border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${lastRun?.status === 'completed' ? 'bg-green-500' : lastRun?.status === 'failed' ? 'bg-red-500' : lastRun?.status === 'running' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'}`} />
                    <div>
                      <div className="font-medium text-sm">{job.label}</div>
                      <div className="text-xs text-muted-foreground">{job.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {job.schedule}
                      </div>
                      {lastRun && (
                        <div className="text-xs text-muted-foreground">
                          Last: {new Date(lastRun.created_at).toLocaleDateString()} — {lastRun.leads_processed || 0} processed
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRunning}
                      onClick={() => triggerAutomation(job.fn, job.key)}
                      className="min-w-[80px]"
                    >
                      {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      <span className="ml-1">{isRunning ? 'Running' : 'Run'}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lead Source Performance */}
      {sourceStats.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Lead Source Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground text-xs uppercase">Source</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs uppercase">Imported</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs uppercase">Skip Traced %</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs uppercase">Interested %</th>
                    <th className="text-right py-2 px-3 text-muted-foreground text-xs uppercase">Contracts %</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceStats.map(s => (
                    <tr key={s.name} className="border-b border-border/50">
                      <td className="py-2 px-3 font-medium capitalize">{s.name}</td>
                      <td className="text-right py-2 px-3">{s.total}</td>
                      <td className="text-right py-2 px-3">{s.total > 0 ? ((s.traced / s.total) * 100).toFixed(0) : 0}%</td>
                      <td className="text-right py-2 px-3">{s.total > 0 ? ((s.interested / s.total) * 100).toFixed(1) : 0}%</td>
                      <td className="text-right py-2 px-3" style={{ color: GREEN }}>{s.total > 0 ? ((s.contracts / s.total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Automation Run History */}
      {automationLogs.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Automation Runs</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {automationLogs.slice(0, 8).map(log => (
              <div key={log.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                <div className="flex items-center gap-2">
                  {log.status === 'completed' ? <CheckCircle className="h-4 w-4 text-green-500" /> :
                   log.status === 'failed' ? <XCircle className="h-4 w-4 text-red-500" /> :
                   <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />}
                  <span className="font-medium capitalize">{log.automation_type?.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span>{log.leads_processed || 0} processed</span>
                  <span>{log.leads_imported || 0} new</span>
                  <span>{new Date(log.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">NEEDS BUYER</Badge>
                  <Button size="sm" variant="outline" onClick={() => triggerAutomation('re-buyer-blast', 'buyer_blast')}>
                    Blast
                  </Button>
                </div>
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
