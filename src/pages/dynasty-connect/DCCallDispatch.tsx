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
import { Upload, Play, Pause, Phone, Clock, CheckCircle, XCircle, AlertCircle, Loader2, MessageSquare } from 'lucide-react';

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
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4 text-primary animate-pulse" /> Active Calls ({calling})</CardTitle></CardHeader>
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
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Lead Queue ({queue.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3">Name</th><th className="p-3">Business</th><th className="p-3">Phone</th><th className="p-3">State</th><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3">Called At</th>
              </tr></thead>
              <tbody>
                {queue.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No leads uploaded. Upload a CSV to get started.</td></tr>
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
                    <td className="p-3 flex items-center gap-1">{statusIcon(q.status)} {statusBadge(q.status)}</td>
                    <td className="p-3 text-xs text-muted-foreground">{q.called_at ? new Date(q.called_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
