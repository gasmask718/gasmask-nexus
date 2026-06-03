import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Rocket, Phone, X } from 'lucide-react';
import { toast } from 'sonner';

const BUSINESSES = [
  { key: 'gasmask', name: 'GasMask / Hot Mama' },
  { key: 'brandaro', name: 'Brandaro Digital' },
  { key: 'unforgettable_times', name: 'Unforgettable Times' },
  { key: 'real_estate', name: 'Real Estate' },
  { key: 'surplus_funds', name: 'Surplus Funds' },
  { key: 'top_tier', name: 'Top Tier Experience' },
  { key: 'iclean', name: 'iClean WeClean' },
  { key: 'playboxxx', name: 'PlayBoxxx' },
];

export default function DCBulkLaunch() {
  const qc = useQueryClient();
  const [business, setBusiness] = useState('gasmask');
  const [agentId, setAgentId] = useState<string>('');
  const [concurrency, setConcurrency] = useState(3);
  const [pasted, setPasted] = useState('');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ['dc-agents', business],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_agents')
        .select('*')
        .eq('business', business)
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  // Reset agent when business changes
  useEffect(() => {
    setAgentId('');
  }, [business]);

  const selectedAgent = useMemo(
    () => agents.find((a: any) => a.id === agentId),
    [agents, agentId],
  );

  const parsedNumbers = useMemo(() => {
    return pasted
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter((s) => s.replace(/\D/g, '').length >= 7);
  }, [pasted]);

  // Live batch poll
  const { data: batch } = useQuery({
    queryKey: ['dc-bulk-batch', activeBatchId],
    queryFn: async () => {
      if (!activeBatchId) return null;
      const { data } = await (supabase as any)
        .from('dc_bulk_batches')
        .select('*')
        .eq('id', activeBatchId)
        .maybeSingle();
      return data;
    },
    enabled: !!activeBatchId,
    refetchInterval: activeBatchId ? 2000 : false,
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['dc-bulk-targets', activeBatchId],
    queryFn: async () => {
      if (!activeBatchId) return [];
      const { data } = await (supabase as any)
        .from('dc_bulk_targets')
        .select('*')
        .eq('batch_id', activeBatchId)
        .order('created_at');
      return data || [];
    },
    enabled: !!activeBatchId,
    refetchInterval: activeBatchId ? 2000 : false,
  });

  const { data: recentBatches = [] } = useQuery({
    queryKey: ['dc-bulk-batches-recent'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dc_bulk_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 5000,
  });

  const handleLaunch = async () => {
    if (!selectedAgent) {
      toast.error('Pick an agent (seeded for this business)');
      return;
    }
    if (parsedNumbers.length === 0) {
      toast.error('Paste at least one phone number');
      return;
    }
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke('dc-bulk-call', {
        body: {
          action: 'launch',
          business,
          agent_type: selectedAgent.agent_type,
          agent_bland_id: selectedAgent.agent_id,
          agent_name: selectedAgent.name,
          concurrency,
          source: 'paste',
          source_metadata: { count: parsedNumbers.length },
          targets: parsedNumbers.map((n) => ({ to_number: n })),
        },
      });
      if (error || !data?.ok) {
        throw new Error(error?.message || data?.error || 'Launch failed');
      }
      toast.success(
        `🚀 Batch launched · ${data.queued} queued${data.skipped_opted_out ? `, ${data.skipped_opted_out} opted-out skipped` : ''}`,
      );
      setActiveBatchId(data.batch_id);
      qc.invalidateQueries({ queryKey: ['dc-bulk-batches-recent'] });
    } catch (e: any) {
      toast.error(e.message || 'Launch failed');
    } finally {
      setLaunching(false);
    }
  };

  const handleCancel = async () => {
    if (!activeBatchId) return;
    await supabase.functions.invoke('dc-bulk-call', {
      body: { action: 'cancel', batch_id: activeBatchId },
    });
    toast.success('Batch cancelled');
  };

  const counts = batch || { queued_count: 0, dialing_count: 0, connected_count: 0, done_count: 0, failed_count: 0, skipped_count: 0, total_count: 0 };
  const progressed = (counts.done_count || 0) + (counts.failed_count || 0) + (counts.skipped_count || 0);
  const pct = counts.total_count > 0 ? (progressed / counts.total_count) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Rocket className="h-6 w-6" /> Bulk AI Call Launcher
        </h1>
        <p className="text-sm text-muted-foreground">
          Fire parallel Bland AI calls through the proven dc-outbound-call pipeline. Each call logs to{' '}
          <code className="text-xs">dc_call_logs</code>, <code className="text-xs">dynasty_ai_calls</code>,
          transcripts and analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Launcher */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure Batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business</Label>
              <Select value={business} onValueChange={setBusiness}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESSES.map((b) => (
                    <SelectItem key={b.key} value={b.key}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      agents.length === 0
                        ? 'No agents seeded for this business — bulk disabled'
                        : 'Select agent'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{' '}
                      <span className="text-muted-foreground text-xs">({a.agent_type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgent && (
                <p className="text-xs text-muted-foreground font-mono">
                  Bland: {selectedAgent.agent_id}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Concurrency (parallel calls)</Label>
                <Badge variant="secondary">{concurrency}</Badge>
              </div>
              <Slider
                value={[concurrency]}
                min={1}
                max={20}
                step={1}
                onValueChange={(v) => setConcurrency(v[0])}
              />
              <p className="text-xs text-muted-foreground">
                1 = sequential · 3 = balanced · 10+ = aggressive blast
              </p>
            </div>

            <div className="space-y-2">
              <Label>Phone Numbers (one per line)</Label>
              <Textarea
                rows={6}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="+17183089391&#10;+15551234567"
              />
              <p className="text-xs text-muted-foreground">
                {parsedNumbers.length} valid number(s) detected. Opt-outs in store_master will be auto-skipped.
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleLaunch}
              disabled={launching || !selectedAgent || parsedNumbers.length === 0}
            >
              {launching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Rocket className="h-4 w-4 mr-2" />
              Launch {parsedNumbers.length} parallel calls
            </Button>
          </CardContent>
        </Card>

        {/* Live progress */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Live Progress</CardTitle>
            {activeBatchId && batch?.status && (
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    batch.status === 'running'
                      ? 'bg-blue-500/10 text-blue-500 border-blue-500'
                      : batch.status === 'complete'
                        ? 'bg-green-500/10 text-green-500 border-green-500'
                        : batch.status === 'cancelled'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500'
                          : 'bg-muted'
                  }
                >
                  {batch.status}
                </Badge>
                {batch.status === 'running' && (
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    <X className="h-3 w-3 mr-1" /> Cancel
                  </Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeBatchId && (
              <p className="text-sm text-muted-foreground">
                Launch a batch to see live progress here.
              </p>
            )}
            {activeBatchId && (
              <>
                <Progress value={pct} />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Queued" value={counts.queued_count} tone="muted" />
                  <Stat label="Dialing" value={counts.dialing_count} tone="blue" />
                  <Stat label="Done" value={counts.done_count} tone="green" />
                  <Stat label="Failed" value={counts.failed_count} tone="red" />
                  <Stat label="Skipped" value={counts.skipped_count} tone="amber" />
                  <Stat label="Total" value={counts.total_count} tone="muted" />
                </div>

                <div className="border rounded-md max-h-72 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">Number</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Call ID / Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {targets.map((t: any) => (
                        <tr key={t.id} className="border-t">
                          <td className="p-2 font-mono">{t.to_number}</td>
                          <td className="p-2">
                            <Badge variant="outline" className="text-[10px]">
                              {t.status}
                            </Badge>
                          </td>
                          <td className="p-2 font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                            {t.call_id || t.error_message || t.skip_reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent batches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2">When</th>
                <th className="text-left p-2">Business</th>
                <th className="text-left p-2">Agent</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Done / Total</th>
                <th className="text-left p-2"></th>
              </tr>
            </thead>
            <tbody>
              {recentBatches.map((b: any) => (
                <tr key={b.id} className="border-t">
                  <td className="p-2">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="p-2">{b.business}</td>
                  <td className="p-2">{b.agent_name || '—'}</td>
                  <td className="p-2"><Badge variant="outline">{b.status}</Badge></td>
                  <td className="p-2">{b.done_count}/{b.total_count}</td>
                  <td className="p-2">
                    <Button size="sm" variant="ghost" onClick={() => setActiveBatchId(b.id)}>
                      <Phone className="h-3 w-3 mr-1" /> View
                    </Button>
                  </td>
                </tr>
              ))}
              {recentBatches.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground text-xs">No batches yet.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClass = {
    muted: 'bg-muted text-foreground',
    blue: 'bg-blue-500/10 text-blue-600 border border-blue-500/30',
    green: 'bg-green-500/10 text-green-600 border border-green-500/30',
    red: 'bg-red-500/10 text-red-600 border border-red-500/30',
    amber: 'bg-amber-500/10 text-amber-600 border border-amber-500/30',
  }[tone] || 'bg-muted';
  return (
    <div className={`rounded-md p-3 ${toneClass}`}>
      <div className="text-2xl font-bold">{value || 0}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}
