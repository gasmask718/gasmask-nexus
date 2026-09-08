import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { verifiedUpdate, mutationErrorMessage } from '@/lib/verifiedMutation';
import { toast } from 'sonner';
import { Users, Activity, CalendarRange, DollarSign, Sparkles, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

type AttentionJob = {
  id: string;
  category: string;
  sub_service: string | null;
  state: string | null;
  address: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  latest_note: string | null;
};

function startOfWeek(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day; // Sunday start
  const s = new Date(d.setDate(diff));
  s.setHours(0, 0, 0, 0);
  return s;
}

export default function ICWCommandDashboard() {
  const weekStart = startOfWeek().toISOString();
  const qc = useQueryClient();
  const [retrying, setRetrying] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['icw-command-metrics', weekStart],
    queryFn: async () => {
      const [workers, activeJobs, weekJobs, blocked, unmatched] = await Promise.all([
        supabase.from('icw_workers').select('id', { count: 'exact', head: true }),
        supabase
          .from('icw_jobs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['pending', 'matched', 'in_progress']),
        supabase
          .from('icw_jobs')
          .select('id, price, status')
          .gte('scheduled_at', weekStart),
        supabase.from('icw_jobs').select('id', { count: 'exact', head: true }).eq('status', 'blocked_licensing'),
        supabase.from('icw_jobs').select('id', { count: 'exact', head: true }).eq('status', 'unmatched'),
      ]);

      if (workers.error) throw workers.error;
      if (activeJobs.error) throw activeJobs.error;
      if (weekJobs.error) throw weekJobs.error;
      if (blocked.error) throw blocked.error;
      if (unmatched.error) throw unmatched.error;

      const rows = weekJobs.data ?? [];
      const revenue = rows
        .filter((r) => r.status === 'complete')
        .reduce((sum, r) => sum + Number(r.price ?? 0), 0);

      return {
        totalWorkers: workers.count ?? 0,
        activeJobs: activeJobs.count ?? 0,
        jobsThisWeek: rows.length,
        revenueThisWeek: revenue,
        blockedLicensing: blocked.count ?? 0,
        unmatched: unmatched.count ?? 0,
      };
    },
  });

  const attentionCount = (data?.blockedLicensing ?? 0) + (data?.unmatched ?? 0);

  const attention = useQuery({
    queryKey: ['icw-attention-jobs'],
    queryFn: async (): Promise<AttentionJob[]> => {
      const { data: jobs, error: jErr } = await supabase
        .from('icw_jobs')
        .select('id, category, sub_service, state, address, status, scheduled_at, created_at')
        .in('status', ['blocked_licensing', 'unmatched'])
        .order('created_at', { ascending: false })
        .limit(50);
      if (jErr) throw jErr;
      const ids = (jobs ?? []).map((j) => j.id);
      if (ids.length === 0) return [];
      const { data: logs, error: lErr } = await supabase
        .from('icw_dispatch_log')
        .select('job_id, note, created_at')
        .in('job_id', ids)
        .order('created_at', { ascending: false });
      if (lErr) throw lErr;
      const latest = new Map<string, string>();
      for (const l of logs ?? []) {
        if (l.job_id && !latest.has(l.job_id)) latest.set(l.job_id, l.note ?? '');
      }
      return (jobs ?? []).map((j) => ({ ...j, latest_note: latest.get(j.id) ?? null }));
    },
  });

  // Resetting to 'pending' re-fires the DB dispatch trigger (gate → match).
  const retryDispatch = async (jobId: string) => {
    setRetrying(jobId);
    try {
      await verifiedUpdate('re-run ICW dispatch', () =>
        supabase.from('icw_jobs').update({ status: 'pending' }).eq('id', jobId),
      );
      toast.success('Dispatch re-run — see updated status below');
    } catch (e) {
      toast.error(mutationErrorMessage(e));
    } finally {
      setRetrying(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['icw-command-metrics'] }),
        qc.invalidateQueries({ queryKey: ['icw-attention-jobs'] }),
      ]);
    }
  };

  // ICW brand accent: blue (#1B4F72 / #4FC3E8) → green (#3C9F40 / #B4D334)
  const stats = [
    { label: 'Total Workers', value: data?.totalWorkers ?? 0, icon: Users, color: 'text-[#4FC3E8]' },
    { label: 'Active Jobs', value: data?.activeJobs ?? 0, icon: Activity, color: 'text-[#3C9F40]' },
    { label: 'Jobs This Week', value: data?.jobsThisWeek ?? 0, icon: CalendarRange, color: 'text-[#B4D334]' },
    {
      label: 'Revenue This Week',
      value: `$${(data?.revenueThisWeek ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: DollarSign,
      color: 'text-[#3C9F40]',
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-[#4FC3E8] to-[#B4D334] bg-clip-text text-transparent">
            I Clean We Clean — Command
          </h1>
          <p className="text-muted-foreground mt-1">
            Internal dispatch console · Cash Flow Engines layer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 text-amber-500 bg-amber-500/10">
            Public booking site not connected yet
          </Badge>
          <Button asChild className="bg-gradient-to-r from-[#1B4F72] to-[#3C9F40] hover:from-[#16405d] hover:to-[#338536] text-white">
            <Link to="/os/icw/workers">
              <Users className="h-4 w-4 mr-2" />
              Worker Roster
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="p-4 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-border/50 bg-gradient-to-br from-background to-muted/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-1">{isLoading ? '—' : stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-muted/50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={attentionCount > 0 ? 'border-destructive/50 bg-destructive/10' : 'border-border/50'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${attentionCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            Needs Human Attention
            {!isLoading && (
              <span className="ml-2 flex items-center gap-2 text-sm font-normal">
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  {data?.blockedLicensing ?? 0} blocked (licensing)
                </Badge>
                <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                  {data?.unmatched ?? 0} unmatched
                </Badge>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {attention.isLoading && <p className="text-muted-foreground">Loading…</p>}
          {attention.error && <p className="text-destructive">{(attention.error as Error).message}</p>}
          {!attention.isLoading && !attention.error && (attention.data?.length ?? 0) === 0 && (
            <p className="text-muted-foreground">No jobs blocked by licensing or waiting on a worker.</p>
          )}
          {(attention.data?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {attention.data!.map((j) => (
                <div key={j.id} className="rounded-lg border border-border/50 bg-background/60 p-3 flex flex-col md:flex-row md:items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={j.status === 'blocked_licensing'
                          ? 'border-destructive/40 text-destructive'
                          : 'border-amber-500/40 text-amber-500'}
                      >
                        {j.status === 'blocked_licensing' ? 'Blocked — licensing' : 'Unmatched'}
                      </Badge>
                      <span className="font-medium">{j.category}{j.sub_service ? ` · ${j.sub_service}` : ''}</span>
                      <span className="text-muted-foreground">{j.state ?? 'no state'}{j.address ? ` · ${j.address}` : ''}</span>
                    </div>
                    {j.latest_note && <p className="text-xs text-muted-foreground break-words">{j.latest_note}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retrying === j.id}
                    onClick={() => retryDispatch(j.id)}
                  >
                    {retrying === j.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Re-run dispatch
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#4FC3E8]" />
            Build Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Foundation pass: schema, command dashboard, worker roster, stubbed intake/status-sync functions.</p>
          <p>Live: licensing gate + load-balanced matching run automatically when a job is created or reset to pending. Every decision is written to the dispatch log.</p>
          <p>Not built yet: worker notification / accept-decline flow, public-site webhook sync.</p>
        </CardContent>
      </Card>
    </div>
  );
}
