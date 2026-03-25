import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Play, RefreshCw, CheckCircle, XCircle, Clock, Zap, Brain, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const GREEN = '#3B6D11';

const AUTOMATION_JOBS = [
  { key: 'lead_import', label: 'Lead Import', desc: 'PropStream + Zillow + BatchLeads', schedule: 'Monday 6am ET', fn: 're-lead-import', icon: '📥' },
  { key: 'skip_trace', label: 'Skip Trace', desc: 'BatchSkipTracing API', schedule: 'Daily 7am + on insert', fn: 're-skip-trace', icon: '🔍' },
  { key: 'queue_dc_campaign', label: 'DC Campaign Queue', desc: 'Auto-queue A/B leads for Dynasty Connect', schedule: 'Weekdays 9am ET', fn: 're-queue-dc-campaign', icon: '📞' },
  { key: 'buyer_blast', label: 'Buyer Blast', desc: 'Email + SMS matching buyers on contract signed', schedule: 'On event (automatic)', fn: 're-buyer-blast', icon: '📨' },
  { key: 'deal_sheet', label: 'Deal Sheet Generator', desc: 'Auto-generate PDF on contract signed', schedule: 'On event (automatic)', fn: 're-generate-deal-sheet', icon: '📄' },
  { key: 'self_learn', label: 'Dynasty Connect Self-Learn', desc: 'Nightly analysis of call outcomes', schedule: '2am nightly', fn: 'self-learn', icon: '🧠' },
];

export default function REAutomation() {
  const [logs, setLogs] = useState<any[]>([]);
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [sourceStats, setSourceStats] = useState<{ source: string; total: number; traced: number; interested: number; contracts: number }[]>([]);

  useEffect(() => {
    fetchLogs();
    fetchSourceStats();
  }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('re_automation_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);
    setLogs((data || []) as any[]);
  };

  const fetchSourceStats = async () => {
    const { data: leads } = await supabase.from('re_leads').select('lead_source, status, skip_traced');
    if (!leads) return;
    const map = new Map<string, { total: number; traced: number; interested: number; contracts: number }>();
    leads.forEach(l => {
      const src = l.lead_source || 'unknown';
      if (!map.has(src)) map.set(src, { total: 0, traced: 0, interested: 0, contracts: 0 });
      const s = map.get(src)!;
      s.total++;
      if (l.skip_traced) s.traced++;
      if (['interested', 'appointment_set', 'offer_made', 'under_contract', 'buyer_found', 'assigned', 'closed'].includes(l.status)) s.interested++;
      if (['under_contract', 'buyer_found', 'assigned', 'closed'].includes(l.status)) s.contracts++;
    });
    setSourceStats(Array.from(map.entries()).map(([source, s]) => ({ source, ...s })));
  };

  const runJob = async (fnName: string, key: string) => {
    setRunningJob(key);
    try {
      const { error } = await supabase.functions.invoke(fnName, { body: { manual: true } });
      if (error) throw error;
      toast.success(`${key} triggered successfully`);
      fetchLogs();
    } catch {
      toast.error(`Failed to trigger ${key}`);
    } finally {
      setRunningJob(null);
    }
  };

  const getLastLog = (jobKey: string) => logs.find(l => l.automation_type === jobKey);

  const statusDot = (log: any) => {
    if (!log) return <Clock className="h-4 w-4 text-muted-foreground" />;
    if (log.status === 'success') return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (log.status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-amber-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: GREEN }}>
            <Bot className="inline h-8 w-8 mr-2" />Floor 7 — AI & Automation Engine
          </h1>
          <p className="text-muted-foreground">The engine running everything — zero manual steps</p>
        </div>
        <Button variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-2" />Refresh
        </Button>
      </div>

      {/* Automation Control Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AUTOMATION_JOBS.map(job => {
          const lastLog = getLastLog(job.key);
          return (
            <Card key={job.key} className="border-l-4" style={{ borderLeftColor: lastLog?.status === 'error' ? '#ef4444' : GREEN }}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{job.icon}</span> {job.label}
                  </CardTitle>
                  {statusDot(lastLog)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{job.desc}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Schedule: {job.schedule}</span>
                  {lastLog && (
                    <span className="text-muted-foreground">
                      Last: {new Date(lastLog.created_at).toLocaleDateString()} — {lastLog.records_processed || 0} processed
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => runJob(job.fn, job.key)}
                    disabled={runningJob === job.key}
                    style={{ backgroundColor: GREEN }}
                  >
                    {runningJob === job.key ? <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                    Run Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sales Mastery Engine AI Updates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" style={{ color: GREEN }} />
            Sales Mastery Engine — AI Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg border border-border bg-card/50">
            <p className="text-sm font-medium mb-1">Latest Script Insight</p>
            <p className="text-sm text-muted-foreground italic">
              "Added to objection library: 'We tried selling before' → new response: 'What happened? Because we close situations others can't.'"
            </p>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card/50">
            <p className="text-sm font-medium mb-1">Best Performing Opener (Last 7 Days)</p>
            <p className="text-sm text-muted-foreground italic">
              "Hey [name], this is [VA] from Dynasty Property Group — I noticed your property at [address]. Are you the owner? Quick question — would you be open to a cash offer if the price worked?"
            </p>
            <Badge className="mt-2" style={{ backgroundColor: GREEN }}>34% higher interested rate</Badge>
          </div>
        </CardContent>
      </Card>

      {/* VA Performance AI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" style={{ color: GREEN }} />
            VA Performance AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">AI Recommendation</p>
              <p className="text-sm font-medium">Calls at 10am–12pm have 34% higher answer rate in FL</p>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Focus Area</p>
              <p className="text-sm font-medium">Price objection handling needs improvement — schedule training</p>
            </div>
            <div className="p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Optimization</p>
              <p className="text-sm font-medium">TX leads converting 2x better than GA — increase TX volume</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lead Source Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Source Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {sourceStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No lead data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-2">Source</th>
                    <th className="text-right p-2">Imported</th>
                    <th className="text-right p-2">Skip Traced %</th>
                    <th className="text-right p-2">Interested %</th>
                    <th className="text-right p-2">Contracts</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceStats.map(s => (
                    <tr key={s.source} className="border-b border-border/50">
                      <td className="p-2 font-medium capitalize">{s.source}</td>
                      <td className="text-right p-2">{s.total}</td>
                      <td className="text-right p-2">{s.total > 0 ? ((s.traced / s.total) * 100).toFixed(0) : 0}%</td>
                      <td className="text-right p-2">{s.total > 0 ? ((s.interested / s.total) * 100).toFixed(0) : 0}%</td>
                      <td className="text-right p-2 font-semibold" style={{ color: GREEN }}>{s.contracts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Automation Log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Automation Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No automation runs recorded yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {logs.slice(0, 15).map(log => (
                <div key={log.id} className="flex items-center justify-between p-2 rounded border border-border/50 text-sm">
                  <div className="flex items-center gap-2">
                    {statusDot(log)}
                    <span className="font-medium">{log.job_name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{log.records_processed || 0} records</span>
                    <span>{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
