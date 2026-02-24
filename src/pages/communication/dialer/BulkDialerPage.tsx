import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Phone, Play, Pause, Square, Users, PhoneCall, PhoneOff, 
  Voicemail, BarChart3, RefreshCw, Zap, AlertTriangle, Lock, Unlock,
  ShieldAlert, Activity, FileText
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

type DialerState = 'idle' | 'running' | 'paused';
type QueueStatus = 'queued' | 'dialing' | 'answered' | 'voicemail' | 'no_answer' | 'bridged' | 'failed' | 'completed';

const statusConfig: Record<QueueStatus, { label: string; color: string }> = {
  queued: { label: 'Queued', color: 'bg-muted text-muted-foreground' },
  dialing: { label: 'Dialing', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  answered: { label: 'Answered', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  voicemail: { label: 'Voicemail', color: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  no_answer: { label: 'No Answer', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  bridged: { label: 'Bridged', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  failed: { label: 'Failed', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
};

export default function BulkDialerPage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [dialerState, setDialerState] = useState<DialerState>('idle');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [lastEngineResult, setLastEngineResult] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch queue
  const { data: queue = [], isLoading } = useQuery({
    queryKey: ['outbound-call-queue', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outbound_call_queue')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('priority_score', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: dialerState === 'running' ? 3000 : undefined,
  });

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['dialer-campaigns', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_campaigns')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
  });

  // Fetch agents
  const { data: agents = [] } = useQuery({
    queryKey: ['dialer-agents', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_agent_availability')
        .select('*')
        .eq('business_id', currentBusiness?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: dialerState === 'running' ? 3000 : undefined,
  });

  // Fetch engine lock status
  const { data: engineLock } = useQuery({
    queryKey: ['engine-lock', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_engine_locks')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: 2000,
  });

  // Fetch recent engine cycle logs
  const { data: cycleLogs = [] } = useQuery({
    queryKey: ['engine-cycle-logs', currentBusiness?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dialer_engine_cycle_logs')
        .select('*')
        .eq('business_id', currentBusiness?.id)
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentBusiness?.id,
    refetchInterval: dialerState === 'running' ? 3000 : undefined,
  });

  const isLocked = engineLock && new Date(engineLock.locked_until) > new Date();

  // Run simulation engine cycle
  const runEngineCycle = useCallback(async () => {
    if (!currentBusiness?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('predictive-dialer-engine', {
        body: {
          business_id: currentBusiness.id,
          campaign_id: selectedCampaign !== 'all' ? selectedCampaign : undefined,
        },
      });
      if (error) throw error;
      setLastEngineResult(data);
      queryClient.invalidateQueries({ queryKey: ['outbound-call-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dialer-agents'] });
      queryClient.invalidateQueries({ queryKey: ['live-call-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['engine-cycle-logs'] });
      queryClient.invalidateQueries({ queryKey: ['engine-lock'] });
    } catch (err: any) {
      console.error('Engine cycle error:', err);
    }
  }, [currentBusiness?.id, selectedCampaign, queryClient]);

  // Engine loop
  useEffect(() => {
    if (dialerState === 'running') {
      runEngineCycle();
      intervalRef.current = setInterval(runEngineCycle, 4000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [dialerState, runEngineCycle]);

  // Realtime subscription
  useEffect(() => {
    if (!currentBusiness?.id) return;
    const channel = supabase
      .channel('dialer-queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbound_call_queue' }, () => {
        queryClient.invalidateQueries({ queryKey: ['outbound-call-queue'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dialer_agent_availability' }, () => {
        queryClient.invalidateQueries({ queryKey: ['dialer-agents'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentBusiness?.id, queryClient]);

  // Watchdog recovery
  const handleWatchdog = async () => {
    if (!currentBusiness?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke('dialer-watchdog', {
        body: { business_id: currentBusiness.id },
      });
      if (error) throw error;
      const recovered = (data?.recovered_dialing || 0) + (data?.recovered_answered || 0);
      if (recovered > 0) {
        toast.success(`Watchdog recovered ${recovered} stuck calls`);
      } else {
        toast.info('No stuck calls found');
      }
      queryClient.invalidateQueries({ queryKey: ['outbound-call-queue'] });
    } catch (err: any) {
      toast.error(`Watchdog failed: ${err.message}`);
    }
  };

  const availableAgents = agents.filter(a => a.status === 'available');
  const busyAgents = agents.filter(a => a.status === 'busy');
  const wrapUpAgents = agents.filter(a => a.status === 'wrap_up');

  const queuedCount = queue.filter(q => q.status === 'queued').length;
  const dialingCount = queue.filter(q => q.status === 'dialing').length;
  const answeredCount = queue.filter(q => (q.status as string) === 'answered' || (q.status as string) === 'bridged').length;
  const voicemailCount = queue.filter(q => q.status === 'voicemail').length;
  const failedCount = queue.filter(q => q.status === 'failed' || q.status === 'no_answer').length;
  const completedCount = queue.filter(q => q.status === 'completed').length;
  const totalProcessed = answeredCount + voicemailCount + failedCount + completedCount;
  const progressPercent = queue.length > 0 ? (totalProcessed / queue.length) * 100 : 0;
  const connectRate = totalProcessed > 0 ? ((answeredCount / totalProcessed) * 100).toFixed(1) : '0';

  const lastLog = cycleLogs[0];

  const handleStartDialer = () => {
    if (availableAgents.length === 0) {
      toast.error('No agents available. Set at least one agent to "Available" first.');
      return;
    }
    if (queuedCount === 0) {
      toast.error('No calls in queue. Add stores to the queue first.');
      return;
    }
    setDialerState('running');
    toast.success(`Simulation dialer started. Processing ${queuedCount} queued calls.`);
  };

  const handlePauseDialer = () => {
    setDialerState('paused');
    toast.info('Dialer paused — active bridged sessions remain live');
  };

  const handleStopDialer = () => {
    setDialerState('idle');
    setLastEngineResult(null);
    toast.info('Dialer stopped — bridged sessions remain intact');
  };

  return (
    <div className="w-full min-h-full space-y-6">
      {/* Simulation Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">SIMULATION MODE ACTIVE — No real calls placed</p>
          <p className="text-xs text-amber-600 dark:text-amber-500">All outcomes are simulated. Twilio Voice not yet wired.</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Predictive Bulk Dialer</h2>
          <p className="text-muted-foreground">Dial hundreds → connect only to humans → zero wasted time</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.filter(c => c.status === 'active').map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {dialerState === 'idle' && (
            <Button onClick={handleStartDialer} className="gap-2 bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4" /> Start Dialer
            </Button>
          )}
          {dialerState === 'running' && (
            <>
              <Button onClick={handlePauseDialer} variant="outline" className="gap-2">
                <Pause className="h-4 w-4" /> Pause
              </Button>
              <Button onClick={handleStopDialer} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {dialerState === 'paused' && (
            <>
              <Button onClick={() => { setDialerState('running'); toast.success('Dialer resumed'); }} className="gap-2 bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4" /> Resume
              </Button>
              <Button onClick={handleStopDialer} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Engine Status Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lock Status */}
        <Card className={isLocked ? 'border-amber-500/50' : 'border-green-500/30'}>
          <CardContent className="pt-4 flex items-center gap-3">
            {isLocked ? <Lock className="h-5 w-5 text-amber-500" /> : <Unlock className="h-5 w-5 text-green-500" />}
            <div>
              <p className="text-sm font-semibold">{isLocked ? 'Engine Locked' : 'Engine Unlocked'}</p>
              <p className="text-xs text-muted-foreground">{isLocked ? 'Cycle in progress' : 'Ready for next cycle'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Last Cycle */}
        <Card>
          <CardContent className="pt-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm font-semibold">
                Last Cycle: {lastLog ? `${lastLog.claimed_count} claimed` : 'No cycles yet'}
              </p>
              {lastLog && (
                <p className="text-xs text-muted-foreground">
                  {lastLog.agents_claimed} agents bridged
                  {(lastLog.errors as any[])?.length > 0 ? ` • ${(lastLog.errors as any[]).length} errors` : ''}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Watchdog */}
        <Card>
          <CardContent className="pt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-semibold">Stuck Call Watchdog</p>
                <p className="text-xs text-muted-foreground">Recover dialing &gt;2min / answered &gt;60s</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleWatchdog} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Recover
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status Banner */}
      {dialerState !== 'idle' && (
        <Card className={dialerState === 'running' ? 'border-green-500/50 bg-green-500/5' : 'border-amber-500/50 bg-amber-500/5'}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${dialerState === 'running' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="font-semibold">
                  {dialerState === 'running' ? 'Engine Active (Simulation)' : 'Dialer Paused'}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span>Agents: <strong className="text-green-600">{availableAgents.length}</strong> avail / <strong className="text-yellow-600">{busyAgents.length}</strong> busy / <strong className="text-blue-600">{wrapUpAgents.length}</strong> wrap-up</span>
                <span>Queue: <strong>{queuedCount}</strong></span>
                <span>Dialing: <strong>{dialingCount}</strong></span>
              </div>
            </div>
            <Progress value={progressPercent} className="mt-3 h-2" />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-muted-foreground">{totalProcessed} of {queue.length} processed ({progressPercent.toFixed(0)}%)</p>
              {lastEngineResult && (
                <p className="text-xs text-muted-foreground">
                  Last cycle: {lastEngineResult.dialed || 0} dialed, {lastEngineResult.agents_claimed || 0} bridged, ideal={lastEngineResult.ideal_dials || 0}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4 text-center"><Phone className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="text-2xl font-bold">{queuedCount}</p><p className="text-xs text-muted-foreground">Queued</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><PhoneCall className="h-5 w-5 mx-auto mb-1 text-yellow-500" /><p className="text-2xl font-bold">{dialingCount}</p><p className="text-xs text-muted-foreground">Dialing</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Users className="h-5 w-5 mx-auto mb-1 text-green-500" /><p className="text-2xl font-bold">{answeredCount}</p><p className="text-xs text-muted-foreground">Connected</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><Voicemail className="h-5 w-5 mx-auto mb-1 text-purple-500" /><p className="text-2xl font-bold">{voicemailCount}</p><p className="text-xs text-muted-foreground">Voicemail</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><PhoneOff className="h-5 w-5 mx-auto mb-1 text-destructive" /><p className="text-2xl font-bold">{failedCount}</p><p className="text-xs text-muted-foreground">Failed / No Answer</p></CardContent></Card>
        <Card><CardContent className="pt-4 text-center"><BarChart3 className="h-5 w-5 mx-auto mb-1 text-blue-500" /><p className="text-2xl font-bold">{connectRate}%</p><p className="text-xs text-muted-foreground">Connect Rate</p></CardContent></Card>
      </div>

      {/* Agent + Queue + Cycle Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" /> Agent Status</CardTitle>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No agents configured</p>
            ) : (
              <div className="space-y-3">
                {agents.map(agent => (
                  <div key={agent.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${
                        agent.status === 'available' ? 'bg-green-500' :
                        agent.status === 'busy' ? 'bg-yellow-500' :
                        agent.status === 'wrap_up' ? 'bg-blue-500 animate-pulse' :
                        'bg-muted-foreground'
                      }`} />
                      <span className="text-sm font-medium">{agent.user_id.slice(0, 8)}...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{agent.status?.replace('_', ' ')}</Badge>
                      <span className="text-xs text-muted-foreground">calls: {agent.active_calls_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5" /> Call Queue</CardTitle>
              <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['outbound-call-queue'] })}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Loading queue...</p>
            ) : queue.length === 0 ? (
              <div className="text-center py-8">
                <Phone className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No calls in queue</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {queue.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.contact_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{item.phone_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {item.attempt_count > 0 ? `${item.attempt_count} attempts` : 'New'}
                        </span>
                        <Badge variant="outline" className={`text-xs ${statusConfig[item.status as QueueStatus]?.color || ''}`}>
                          {statusConfig[item.status as QueueStatus]?.label || item.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Engine Cycle Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Engine Cycle Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {cycleLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No engine cycles yet</p>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {cycleLogs.map(log => {
                    const outcomes = (log.outcomes || {}) as Record<string, number>;
                    const logErrors = (log.errors || []) as string[];
                    return (
                      <div key={log.id} className={`p-3 border rounded-lg text-xs ${logErrors.length > 0 ? 'border-destructive/30' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">
                            {log.lock_acquired ? '✅' : '🔒'} {log.claimed_count} claimed
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(log.started_at).toLocaleTimeString()}
                          </span>
                        </div>
                        {log.claimed_count > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {outcomes.bridged > 0 && <Badge variant="outline" className="text-[10px]">🔗 {outcomes.bridged}</Badge>}
                            {outcomes.voicemail > 0 && <Badge variant="outline" className="text-[10px]">📧 {outcomes.voicemail}</Badge>}
                            {outcomes.no_answer > 0 && <Badge variant="outline" className="text-[10px]">📵 {outcomes.no_answer}</Badge>}
                            {outcomes.failed > 0 && <Badge variant="outline" className="text-[10px]">❌ {outcomes.failed}</Badge>}
                            {outcomes.answered_no_agent > 0 && <Badge variant="outline" className="text-[10px]">⏳ {outcomes.answered_no_agent}</Badge>}
                          </div>
                        )}
                        {logErrors.length > 0 && (
                          <p className="text-destructive mt-1 truncate">{logErrors[0]}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
