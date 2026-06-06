import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GrabbaLayout } from '@/components/grabba/GrabbaLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2, Play, Pause, RefreshCw, Bot, FileText, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

type FloorAgent = {
  id: string; floor: number; agent_name: string; purpose: string;
  enabled: boolean; daily_token_budget: number; tokens_used_today: number;
  last_run_at: string | null; last_findings_count: number | null;
  last_run_summary: any;
};

type BackfillJob = {
  id: string; job_type: 'notes' | 'invoices'; status: string;
  per_run_cap: number; scanned_count: number; generated_count: number;
  reviewed_count: number; failed_count: number; last_run_at: string | null;
};

export default function Floor9AIAgents() {
  const { toast } = useToast();
  const [agents, setAgents] = useState<FloorAgent[]>([]);
  const [jobs, setJobs] = useState<BackfillJob[]>([]);
  const [scan, setScan] = useState<{ notes_needed?: number; invoices_needed?: number }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [draftCount, setDraftCount] = useState(0);

  const load = async () => {
    const [{ data: a }, { data: j }, { count: drafts }] = await Promise.all([
      supabase.from('floor_agents' as any).select('*').order('floor'),
      supabase.from('ai_backfill_jobs' as any).select('*').order('job_type'),
      supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'draft_ai' as any),
    ]);
    setAgents((a as any) || []);
    setJobs((j as any) || []);
    setDraftCount(drafts || 0);
  };

  useEffect(() => { load(); }, []);

  const runAgent = async (agent: FloorAgent) => {
    setBusy(`agent-${agent.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('floor-agent-runner', {
        body: { agent_id: agent.id },
      });
      if (error) throw error;
      toast({ title: `${agent.agent_name} complete`, description: JSON.stringify(data?.results?.[0] || {}) });
      load();
    } catch (e: any) {
      toast({ title: 'Run failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const toggleAgent = async (agent: FloorAgent, enabled: boolean) => {
    await supabase.from('floor_agents' as any).update({ enabled }).eq('id', agent.id);
    load();
  };

  const updateBudget = async (agent: FloorAgent, budget: number) => {
    await supabase.from('floor_agents' as any).update({ daily_token_budget: budget }).eq('id', agent.id);
    load();
  };

  const runScan = async () => {
    setBusy('scan');
    try {
      const { data } = await supabase.functions.invoke('ai-backfill-runner', { body: { action: 'scan' } });
      setScan(data || {});
    } finally { setBusy(null); }
  };

  const runBackfill = async (jobType: 'notes' | 'invoices', cap = 5) => {
    setBusy(`backfill-${jobType}`);
    try {
      const { data, error } = await supabase.functions.invoke('ai-backfill-runner', {
        body: { action: 'run', job_type: jobType, cap },
      });
      if (error) throw error;
      toast({ title: `Backfill ${jobType} done`, description: `Generated ${data?.generated} / scanned ${data?.scanned}` });
      load();
    } catch (e: any) {
      toast({ title: 'Backfill failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const pauseJob = async (job: BackfillJob) => {
    const next = job.status === 'paused' ? 'pending' : 'paused';
    await supabase.from('ai_backfill_jobs' as any).update({ status: next }).eq('id', job.id);
    load();
  };

  return (
    <GrabbaLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Bot className="h-8 w-8" /> AI Agents & Backfill</h1>
          <p className="text-muted-foreground">Per-floor Claude agents (read-only, recommendations only) + AI batch backfill for missing notes & invoices.</p>
        </div>

        {/* Floor Agents Roster */}
        <Card>
          <CardHeader><CardTitle>Floor Agents Roster</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {agents.map(a => {
              const overBudget = a.tokens_used_today >= a.daily_token_budget;
              return (
                <div key={a.id} className="border rounded-lg p-4 flex items-center gap-4">
                  <Badge variant="outline" className="text-base shrink-0">F{a.floor}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{a.agent_name}</div>
                    <div className="text-sm text-muted-foreground truncate">{a.purpose}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Last run: {a.last_run_at ? formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true }) : 'never'}
                      {' · '}Findings: {a.last_findings_count ?? 0}
                      {' · '}Tokens today: {a.tokens_used_today}/{a.daily_token_budget}
                      {overBudget && <Badge variant="destructive" className="ml-2">budget exceeded</Badge>}
                    </div>
                  </div>
                  <Input type="number" className="w-28" value={a.daily_token_budget}
                    onChange={(e) => updateBudget(a, parseInt(e.target.value) || 0)} />
                  <Switch checked={a.enabled} onCheckedChange={(v) => toggleAgent(a, v)} />
                  <Button size="sm" disabled={busy === `agent-${a.id}` || !a.enabled || overBudget} onClick={() => runAgent(a)}>
                    {busy === `agent-${a.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Run Now
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Backfill Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>AI Backfill — Missing Notes & Invoices</span>
              <Button size="sm" variant="outline" onClick={runScan} disabled={busy === 'scan'}>
                {busy === 'scan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Scan
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(scan.notes_needed !== undefined || scan.invoices_needed !== undefined) && (
              <div className="text-sm text-muted-foreground">
                Stores needing notes: <b>{scan.notes_needed ?? '—'}</b> · Delivered orders missing invoices: <b>{scan.invoices_needed ?? '—'}</b>
              </div>
            )}
            {jobs.map(j => (
              <div key={j.id} className="border rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  {j.job_type === 'notes' ? <FileText className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
                  <div className="flex-1">
                    <div className="font-medium capitalize">{j.job_type} backfill</div>
                    <div className="text-xs text-muted-foreground">
                      scanned {j.scanned_count} · generated {j.generated_count} · reviewed {j.reviewed_count} · failed {j.failed_count}
                    </div>
                  </div>
                  <Badge variant={j.status === 'paused' ? 'destructive' : 'secondary'}>{j.status}</Badge>
                  <Button size="sm" variant="outline" onClick={() => pauseJob(j)}>
                    {j.status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" disabled={busy === `backfill-${j.job_type}` || j.status === 'paused'}
                    onClick={() => runBackfill(j.job_type, 5)}>
                    {busy === `backfill-${j.job_type}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Run Batch (5)
                  </Button>
                </div>
                <Progress value={Math.min(100, (j.generated_count / Math.max(1, j.scanned_count)) * 100)} />
              </div>
            ))}
            <div className="text-sm border-t pt-3">
              <b>{draftCount}</b> AI-drafted invoices awaiting human review. Drafts have status <code>draft_ai</code> and cannot be finalized until a reviewer calls <code>approve_ai_draft_invoice</code>.
            </div>
          </CardContent>
        </Card>
      </div>
    </GrabbaLayout>
  );
}
