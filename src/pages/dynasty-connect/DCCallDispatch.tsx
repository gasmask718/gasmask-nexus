import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, Play, Pause, Phone, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, Loader2, MessageSquare, StopCircle, RotateCw, RefreshCw, Trash2, Download, FileText } from 'lucide-react';

interface TranscriptSegment {
  id: string;
  call_id: string;
  timestamp: number;
  speaker: 'ai' | 'prospect';
  text: string;
}

const BUSINESS_OPTIONS = [
  { value: 'brandaro', label: 'Brandaro' },
  { value: 'surplus_funds', label: 'Surplus Funds' },
  { value: 'wholesale_re', label: 'Wholesale RE' },
  { value: 'gasmask', label: 'GasMask' },
];

export default function DCCallDispatch() {
  const qc = useQueryClient();
  const [businessType, setBusinessType] = useState('brandaro');
  const [concurrency, setConcurrency] = useState([5]);
  const [autoMatch, setAutoMatch] = useState(true);
  const [manualNumberOverride, setManualNumberOverride] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [liveTranscripts, setLiveTranscripts] = useState<Record<string, TranscriptSegment[]>>({});
  const [transcriptModal, setTranscriptModal] = useState<{ callId: string; segments: TranscriptSegment[] } | null>(null);

  // Tick every second so active-call durations update live
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const formatDuration = (startIso?: string | null) => {
    if (!startIso) return '0:00';
    const secs = Math.max(0, Math.floor((now - new Date(startIso).getTime()) / 1000));
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const { data: availableNumbers = [] } = useQuery({
    queryKey: ['dc-available-phone-numbers'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dynasty_phone_numbers')
        .select('*')
        .eq('is_active', true)
        .order('state', { ascending: true });
      return data || [];
    },
  });

  // Queue data with realtime
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['dynasty-call-queue', businessType],
    queryFn: async () => {
      const { data } = await (supabase as any).from('dynasty_call_queue')
        .select('*').eq('business_type', businessType).order('created_at', { ascending: false });
      return data || [];
    },
    refetchInterval: isRunning ? 5000 : 30000,
  });

  const { data: completedCalls = [] } = useQuery({
    queryKey: ['dynasty-completed-calls'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('dynasty_call_history')
        .select('*')
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 15000,
  });

  // Auto-fail calls stuck > 5 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: stuckCalls } = await (supabase as any)
        .from('dynasty_call_queue')
        .select('id')
        .in('status', ['calling', 'in-progress'])
        .lt('called_at', fiveMinutesAgo);

      if (stuckCalls && stuckCalls.length > 0) {
        await (supabase as any)
          .from('dynasty_call_queue')
          .update({
            status: 'failed',
            error_message: 'Auto-failed: No response after 5 minutes',
            updated_at: new Date().toISOString(),
          })
          .in('id', stuckCalls.map((c: any) => c.id));
        toast.warning(`${stuckCalls.length} stuck call${stuckCalls.length > 1 ? 's' : ''} auto-failed`);
        qc.invalidateQueries({ queryKey: ['dynasty-call-queue'] });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [qc]);

  const retryAllFailed = async () => {
    const failedItems = queue.filter((q: any) => q.status === 'failed');
    if (!failedItems.length) return;
    if (!confirm(`Retry all ${failedItems.length} failed calls?`)) return;
    await (supabase as any)
      .from('dynasty_call_queue')
      .update({ status: 'pending', error_message: null, called_at: null, bland_call_id: null, updated_at: new Date().toISOString() })
      .in('id', failedItems.map((f: any) => f.id));
    toast.success(`${failedItems.length} call${failedItems.length > 1 ? 's' : ''} moved back to queue`);
    qc.invalidateQueries({ queryKey: ['dynasty-call-queue'] });
  };

  const formatSeconds = (s?: number | null) => {
    if (!s) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const downloadRecording = (url: string, callId: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-${callId}.mp3`;
    a.target = '_blank';
    a.click();
  };

  const viewFullTranscript = async (callId: string) => {
    const { data } = await (supabase as any)
      .from('dynasty_call_transcripts')
      .select('*')
      .eq('call_id', callId)
      .order('timestamp', { ascending: true });
    setTranscriptModal({ callId, segments: (data || []) as TranscriptSegment[] });
  };

  // Realtime subscription
  useEffect(() => {
    const channel = supabase.channel('dc-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dynasty_call_queue' }, () => {
        qc.invalidateQueries({ queryKey: ['dynasty-call-queue'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = text.split('\n').slice(1).filter(r => r.trim());
    const items = rows.map(r => {
      const parts = r.split(',').map(s => s.trim().replace(/"/g, ''));
      return {
        business_type: businessType,
        contact_name: parts[0] || null,
        business_name: parts[1] || null,
        phone_number: parts[2],
        status: 'pending',
      };
    }).filter(i => i.phone_number);

    if (!items.length) { toast.error('No valid rows'); return; }
    const { error } = await (supabase as any).from('dynasty_call_queue').insert(items);
    if (error) toast.error(error.message);
    else { toast.success(`${items.length} leads uploaded`); qc.invalidateQueries({ queryKey: ['dynasty-call-queue'] }); }
  };

  const startCampaign = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('dc-bland-dispatch', {
        body: { action: 'start-campaign', businessType, concurrency: concurrency[0], manualNumberOverride, autoMatch },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`${data.dispatched} calls dispatched`);
      setIsRunning(true);
      qc.invalidateQueries({ queryKey: ['dynasty-call-queue'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const refreshQueue = () => qc.invalidateQueries({ queryKey: ['dynasty-call-queue'] });

  const cancelCall = async (leadId: string, callId?: string | null) => {
    try {
      if (callId) {
        const { data, error } = await supabase.functions.invoke('dc-bland-dispatch', {
          body: { action: 'cancel-call', callId },
        });
        if (error) {
          console.error('[CANCEL ERROR]', error);
          toast.error('Failed to stop call in Bland.ai');
        } else {
          console.log('[CANCEL SUCCESS]', data);
        }
      }
      await (supabase as any)
        .from('dynasty_call_queue')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', leadId);
      await qc.invalidateQueries({ queryKey: ['dynasty-call-queue'] });
      toast.success('Call cancelled');
    } catch (e: any) {
      console.error('[CANCEL EXCEPTION]', e);
      toast.error(e.message || 'Failed to cancel call');
    }
  };

  const cancelAllCalls = async () => {
    const active = queue.filter((q: any) => q.status === 'calling');
    if (!active.length) return;
    if (!confirm(`Cancel all ${active.length} active calls?`)) return;
    for (const c of active) await cancelCall(c.id, c.bland_call_id);
  };

  const markAsFailed = async (leadId: string) => {
    await (supabase as any)
      .from('dynasty_call_queue')
      .update({ status: 'failed', error_message: 'Manually marked as failed', updated_at: new Date().toISOString() })
      .eq('id', leadId);
    toast.success('Marked as failed');
    refreshQueue();
  };

  const retryCall = async (leadId: string) => {
    await (supabase as any)
      .from('dynasty_call_queue')
      .update({ status: 'pending', error_message: null, called_at: null, bland_call_id: null, updated_at: new Date().toISOString() })
      .eq('id', leadId);
    toast.success('Moved back to queue');
    refreshQueue();
  };

  const clearQueue = async () => {
    if (!confirm('Delete all pending calls in this queue?')) return;
    await (supabase as any)
      .from('dynasty_call_queue')
      .delete()
      .eq('business_type', businessType)
      .in('status', ['pending']);
    toast.success('Pending queue cleared');
    refreshQueue();
  };

  const pending = queue.filter((q: any) => q.status === 'pending').length;
  const calling = queue.filter((q: any) => q.status === 'calling').length;
  const completed = queue.filter((q: any) => q.status === 'completed').length;
  const failed = queue.filter((q: any) => q.status === 'failed').length;
  const total = queue.length;
  const progress = total > 0 ? ((completed + failed) / total) * 100 : 0;

  const statusIcon = (s: string) => {
    switch (s) {
      case 'pending': return <Clock className="h-3 w-3 text-muted-foreground" />;
      case 'calling': return <Loader2 className="h-3 w-3 text-primary animate-spin" />;
      case 'completed': return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'failed': return <XCircle className="h-3 w-3 text-destructive" />;
      default: return <AlertCircle className="h-3 w-3" />;
    }
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-muted text-muted-foreground',
      calling: 'bg-primary/10 text-primary',
      completed: 'bg-green-500/10 text-green-500',
      failed: 'bg-destructive/10 text-destructive',
    };
    return <Badge variant="outline" className={colors[s] || ''}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">🚀 Call Dispatch</h1><p className="text-sm text-muted-foreground">Upload leads and launch AI calling campaigns</p></div>

      {/* Config Panel */}
      <Card>
        <CardHeader><CardTitle className="text-base">Campaign Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Business</Label>
              <Select value={businessType} onValueChange={setBusinessType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BUSINESS_OPTIONS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload Leads (CSV: name, business, phone)</Label>
              <label className="cursor-pointer">
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
                <Button variant="outline" className="w-full" asChild><span><Upload className="h-4 w-4 mr-2" /> Upload CSV</span></Button>
              </label>
            </div>
            <div>
              <Label>Concurrency: {concurrency[0]} calls</Label>
              <Slider value={concurrency} onValueChange={setConcurrency} min={1} max={20} step={1} className="mt-2" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={autoMatch} onCheckedChange={setAutoMatch} disabled={!!manualNumberOverride} />
            <Label>Auto-match Caller ID to state</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="number-select">Caller ID Number</Label>
            <Select
              value={manualNumberOverride || 'auto'}
              onValueChange={(value) => setManualNumberOverride(value === 'auto' ? null : value)}
            >
              <SelectTrigger id="number-select">
                <SelectValue placeholder="Select caller ID..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  🎯 Auto-match by state {autoMatch ? '(Active)' : '(Inactive)'}
                </SelectItem>
                <SelectSeparator />
                {availableNumbers.map((num: any) => (
                  <SelectItem key={num.phone_number} value={num.phone_number}>
                    {num.friendly_name || num.phone_number} ({num.phone_number}){num.state ? ` - ${num.state}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {manualNumberOverride && (
              <Alert className="mt-2 border-yellow-500/40 bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                  Manual override: All calls will use{' '}
                  {availableNumbers.find((n: any) => n.phone_number === manualNumberOverride)?.friendly_name || manualNumberOverride}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex items-center justify-end">
            <div className="flex gap-2">
              <Button onClick={() => startCampaign.mutate()} disabled={pending === 0 || startCampaign.isPending} size="lg" className="bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4 mr-2" /> Start Campaign ({pending} pending)
              </Button>
              {isRunning && (
                <Button variant="outline" size="lg" onClick={() => setIsRunning(false)}>
                  <Pause className="h-4 w-4 mr-2" /> Pause
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {total > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Campaign Progress</span>
              <span className="text-sm text-muted-foreground">{completed + failed}/{total}</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Pending: {pending}</span>
              <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3" /> Calling: {calling}</span>
              <span className="flex items-center gap-1 text-green-500"><CheckCircle className="h-3 w-3" /> Done: {completed}</span>
              <span className="flex items-center gap-1 text-destructive"><XCircle className="h-3 w-3" /> Failed: {failed}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Calls */}
      {calling > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4 text-primary animate-pulse" /> Active Calls ({calling})</CardTitle>
            <Button size="sm" variant="destructive" onClick={cancelAllCalls}>
              <XCircle className="h-4 w-4 mr-2" /> Cancel All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {queue.filter((q: any) => q.status === 'calling').map((q: any) => (
                <div key={q.id} className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{q.contact_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground truncate">{q.business_name}</p>
                      <p className="font-mono text-xs mt-1">{q.phone_number}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-base font-semibold text-primary tabular-nums">
                        {formatDuration(q.called_at)}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Live</div>
                    </div>
                  </div>
                  <Badge variant="outline" className="mt-2 bg-primary/10 text-primary">In Progress</Badge>

                  {q.called_at && (() => {
                    const minutesElapsed = Math.floor((now - new Date(q.called_at).getTime()) / 60000);
                    const timeoutIn = 5 - minutesElapsed;
                    if (timeoutIn > 1) return null;
                    return (
                      <Alert variant="destructive" className="mt-2 py-2">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <AlertDescription className="text-xs">
                          Will auto-fail in {timeoutIn < 1 ? '<1' : timeoutIn} minute{timeoutIn !== 1 ? 's' : ''}
                        </AlertDescription>
                      </Alert>
                    );
                  })()}

                  {q.bland_call_id && liveTranscripts[q.bland_call_id]?.length > 0 && (
                    <div className="border-t border-border/60 pt-3 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium">Live Transcript</span>
                      </div>
                      <div className="bg-background border border-border rounded p-2 max-h-48 overflow-y-auto space-y-2 flex flex-col-reverse">
                        <div className="space-y-2">
                          {liveTranscripts[q.bland_call_id].map((seg) => (
                            <div
                              key={seg.id}
                              className={`flex ${seg.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}
                            >
                              <div className={`px-2.5 py-1.5 rounded-lg max-w-[85%] ${
                                seg.speaker === 'ai'
                                  ? 'bg-primary/10 text-foreground'
                                  : 'bg-green-500/10 text-foreground'
                              }`}>
                                <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                                  {seg.speaker === 'ai' ? '🤖 AI' : '👤 Prospect'}
                                </p>
                                <p className="text-xs leading-snug">{seg.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3 border-t border-border/60 pt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => cancelCall(q.id, q.bland_call_id)}>
                      <StopCircle className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markAsFailed(q.id)}>
                      <XCircle className="h-4 w-4 mr-1" /> Mark Failed
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed Calls */}
      {failed > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Failed Calls ({failed})
            </CardTitle>
            <Button size="sm" variant="outline" onClick={retryAllFailed}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry All
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {queue.filter((q: any) => q.status === 'failed').map((q: any) => (
              <div key={q.id} className="border border-destructive/20 rounded p-3 bg-destructive/5 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{q.contact_name || 'Unknown'} <span className="text-muted-foreground font-mono text-xs ml-2">{q.phone_number}</span></p>
                  <p className="text-xs text-destructive mt-1">{q.error_message || 'Unknown error'}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => retryCall(q.id)} className="shrink-0">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Queue Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Lead Queue ({queue.length})</CardTitle>
          {pending > 0 && (
            <Button size="sm" variant="outline" onClick={clearQueue}>
              <Trash2 className="h-4 w-4 mr-2" /> Clear Pending
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Name</th><th className="p-3">Business</th><th className="p-3">Phone</th><th className="p-3">State</th><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3">Called At</th><th className="p-3 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No leads uploaded. Upload a CSV to get started.</td></tr>
                ) : queue.map((q: any) => (
                  <tr key={q.id} className="border-b border-border/50 hover:bg-accent/50">
                    <td className="p-3 font-medium">{q.contact_name || '-'}</td>
                    <td className="p-3">{q.business_name || '-'}</td>
                    <td className="p-3 font-mono text-xs">{q.phone_number}</td>
                    <td className="p-3">{q.state || '-'}</td>
                    <td className="p-3">
                      {q.source_table ? (
                        <Badge variant="outline" className={
                          q.source_table === 'brandaro_qualified_leads'
                            ? 'bg-orange-500/10 text-orange-400 border-orange-500/30 text-[10px]'
                            : 'bg-muted text-muted-foreground text-[10px]'
                        }>
                          {q.source_table === 'brandaro_qualified_leads' ? '🅱️ Brandaro' : q.source_table.replace(/_/g, ' ')}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Direct</span>
                      )}
                    </td>
                    <td className="p-3"><div className="flex items-center gap-1">{statusIcon(q.status)} {statusBadge(q.status)}</div></td>
                    <td className="p-3 text-xs text-muted-foreground">{q.called_at ? new Date(q.called_at).toLocaleString() : '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {q.status === 'failed' && (
                          <Button size="sm" variant="ghost" onClick={() => retryCall(q.id)} title="Retry">
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {q.status === 'calling' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => cancelCall(q.id, q.bland_call_id)} title="Cancel">
                              <StopCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => markAsFailed(q.id)} title="Mark Failed">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Completed Calls with Recordings */}
      {completedCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" /> Completed Calls ({completedCalls.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedCalls.map((call: any) => (
              <div key={call.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{call.contact_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{call.phone_number}</p>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 shrink-0">
                    Completed
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Duration</p>
                    <p className="text-sm font-semibold tabular-nums">{formatSeconds(call.duration)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">From</p>
                    <p className="text-xs font-mono truncate">{call.from_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ended</p>
                    <p className="text-xs">{call.ended_at ? new Date(call.ended_at).toLocaleString() : '-'}</p>
                  </div>
                </div>

                {call.call_summary && (
                  <div className="border border-primary/20 rounded p-3 bg-primary/5 mb-3">
                    <p className="text-xs font-semibold mb-1">📊 Call Summary</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{call.call_summary}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {call.recording_url && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => window.open(call.recording_url, '_blank')}>
                        <Play className="h-4 w-4 mr-2" /> Play Recording
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => downloadRecording(call.recording_url, call.call_id)}>
                        <Download className="h-4 w-4 mr-2" /> Download
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" onClick={() => viewFullTranscript(call.call_id)}>
                    <FileText className="h-4 w-4 mr-2" /> View Transcript
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!transcriptModal} onOpenChange={(open) => !open && setTranscriptModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Full Transcript</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto space-y-2 pr-2">
            {transcriptModal?.segments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No transcript available for this call.</p>
            ) : (
              transcriptModal?.segments.map((seg) => (
                <div key={seg.id} className={`flex ${seg.speaker === 'ai' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`px-3 py-2 rounded-lg max-w-[85%] ${
                    seg.speaker === 'ai' ? 'bg-primary/10' : 'bg-green-500/10'
                  }`}>
                    <p className="text-[10px] font-semibold mb-0.5 opacity-70">
                      {seg.speaker === 'ai' ? '🤖 AI' : '👤 Prospect'}
                    </p>
                    <p className="text-sm leading-snug">{seg.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
