import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, CheckCircle, XCircle, Clock, Play, Loader2, BarChart3, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CRON_JOBS = [
  { name: 'Daily Venue Scrape', schedule: 'Every day at 2:00 AM EST', source: 'Outscraper', query: 'event venue', lead_type: 'venue', city: 'Brooklyn', state: 'NY', apiKeyEnv: 'OUTSCRAPER_API_KEY' },
  { name: 'Daily Staff Scrape', schedule: 'Every day at 2:30 AM EST', source: 'Outscraper', query: 'event staff catering DJ', lead_type: 'staff', city: 'Brooklyn', state: 'NY', apiKeyEnv: 'OUTSCRAPER_API_KEY' },
  { name: 'Ambassador Search', schedule: 'Every day at 3:00 AM EST', source: 'PhantomBuster', query: 'events party planner', lead_type: 'ambassador', city: 'New York', state: 'NY', apiKeyEnv: 'PHANTOMBUSTER_API_KEY' },
  { name: 'Claude Scoring Pass', schedule: 'Every day at 4:00 AM EST', source: 'Anthropic Claude', query: '', lead_type: '', city: '', state: '', apiKeyEnv: '' },
];

export default function UTAutomationRuns() {
  const queryClient = useQueryClient();
  const [runningJob, setRunningJob] = useState<string | null>(null);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['ut-automation-runs'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_automation_runs').select('*').order('started_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: sources = [] } = useQuery({
    queryKey: ['ut-lead-sources'],
    queryFn: async () => {
      const { data } = await supabase.from('ut_lead_sources').select('*');
      return data || [];
    },
  });

  useEffect(() => {
    const channel = supabase.channel('ut-automation-runs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ut_automation_runs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['ut-automation-runs'] });
        toast.info('⚡ Automation run updated!');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const totalRuns = runs.length;
  const successRuns = runs.filter((r: any) => r.status === 'completed').length;
  const failedRuns = runs.filter((r: any) => r.status === 'failed').length;
  const totalLeads = runs.reduce((sum: number, r: any) => sum + (r.leads_found || 0), 0);

  const isSourceConnected = (apiKeyEnv: string) => {
    if (!apiKeyEnv) return true; // Claude scoring has no env
    const src = sources.find((s: any) => (s.config as any)?.api_key_env === apiKeyEnv);
    return src?.is_connected || false;
  };

  const handleRunNow = async (job: typeof CRON_JOBS[0]) => {
    setRunningJob(job.name);
    try {
      const { data, error } = await supabase.functions.invoke('ut-lead-scraper', {
        body: { source: job.source.toLowerCase().replace(' ', ''), query: job.query, city: job.city, state: job.state, lead_type: job.lead_type },
      });
      if (error) throw error;
      toast.success(`${job.name} completed! Found ${data?.leads_found || 0} leads`);
      queryClient.invalidateQueries({ queryKey: ['ut-automation-runs'] });
    } catch (err: any) {
      toast.error(err.message || 'Run failed');
    } finally {
      setRunningJob(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      case 'completed': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed': return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDuration = (start: string, end?: string) => {
    if (!end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`;
  };

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="h-6 w-6 text-primary" />Automation Runs</h1>
        <p className="text-sm text-muted-foreground">Monitor all automated lead generation jobs</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totalRuns}</p><p className="text-xs text-muted-foreground">Total Runs</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-400">{successRuns}</p><p className="text-xs text-muted-foreground">Successful</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-400">{failedRuns}</p><p className="text-xs text-muted-foreground">Failed</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-400">{totalLeads}</p><p className="text-xs text-muted-foreground">Total Leads Generated</p></CardContent></Card>
      </div>

      {/* Cron Schedule */}
      <div>
        <h2 className="text-lg font-semibold mb-3">⏰ Scheduled Jobs</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CRON_JOBS.map((job) => {
            const connected = isSourceConnected(job.apiKeyEnv);
            const lastRun = runs.find((r: any) => r.source === job.source.toLowerCase().replace(' ', ''));
            return (
              <Card key={job.name} className="border-border/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">⏰ {job.name}</h3>
                    {connected
                      ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">✅ Active</Badge>
                      : <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">⚠️ Pending API Key</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{job.schedule}</p>
                  <p className="text-xs text-muted-foreground">Source: {job.source}</p>
                  <p className="text-xs text-muted-foreground">Last run: {lastRun ? format(new Date(lastRun.started_at), 'MMM d, yyyy, h:mm a') : 'Never'}</p>
                  <Button size="sm" variant="outline" className="w-full mt-2" disabled={runningJob === job.name} onClick={() => handleRunNow(job)}>
                    {runningJob === job.name ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running...</> : <><Play className="h-3 w-3 mr-1" />Run Now</>}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Runs Table */}
      <div>
        <h2 className="text-lg font-semibold mb-3">📊 Recent Runs</h2>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Leads Found</TableHead>
                <TableHead>A-Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : runs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No automation runs yet</p>
                  <p className="text-xs">Click "Run Now" on a scheduled job to start</p>
                </TableCell></TableRow>
              ) : runs.map((run: any) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium text-xs">{run.source || '—'}</TableCell>
                  <TableCell className="text-xs">{run.run_type || '—'}</TableCell>
                  <TableCell className="text-xs">{run.started_at ? format(new Date(run.started_at), 'MMM d, yyyy, h:mm a') : '—'}</TableCell>
                  <TableCell className="text-xs font-semibold">{run.leads_found || 0}</TableCell>
                  <TableCell className="text-xs">{run.leads_graded || 0}</TableCell>
                  <TableCell>{getStatusBadge(run.status)}</TableCell>
                  <TableCell className="text-xs">{getDuration(run.started_at, run.completed_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
