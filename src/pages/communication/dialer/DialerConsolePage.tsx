// Dynasty OS — DialerConsolePage — Call Center Mode — 2026-03-21
import { useState, useEffect, useCallback, useRef } from 'react';
import { CallSmsPanel } from '@/components/communication/CallSmsPanel';
import { CallCenterStatsBar } from '@/components/dialer/CallCenterStatsBar';
import { AgentCards } from '@/components/dialer/AgentCards';
import { MultiCallGrid } from '@/components/dialer/MultiCallGrid';
import { CallQueuePanel } from '@/components/dialer/CallQueuePanel';
import { useCallCenterSession } from '@/hooks/useCallCenterSession';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Phone, Play, Pause, Square, PhoneCall, PhoneOff, Voicemail,
  BarChart3, RefreshCw, AlertTriangle, Clock, User, DollarSign,
  Radio, Shield, CheckCircle2, XCircle, Headphones, MapPin,
  FileText, Ban, CalendarClock, Send, ShoppingCart, Zap, MessageSquare
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { VoiceProviderSelector } from '@/components/communication/VoiceProviderSelector';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBusiness } from '@/contexts/BusinessContext';
import { toast } from 'sonner';

type DialerState = 'idle' | 'running' | 'paused';
type AgentStatus = 'offline' | 'available' | 'busy' | 'wrap_up' | 'away';

interface DispositionCode {
  id: string;
  code: string;
  label: string;
  display_number: number | null;
  category: string;
  requires_followup: boolean;
  followup_delay_minutes: number | null;
  marks_do_not_call: boolean;
  creates_invoice_draft: boolean;
}

const agentStatusConfig: Record<AgentStatus, { label: string; color: string; icon: typeof Phone }> = {
  offline: { label: 'Offline', color: 'bg-muted text-muted-foreground', icon: PhoneOff },
  available: { label: 'Ready', color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: Phone },
  busy: { label: 'On Call', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: PhoneCall },
  wrap_up: { label: 'Wrap Up', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Clock },
  away: { label: 'Away', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30', icon: AlertTriangle },
};

export default function DialerConsolePage() {
  const { currentBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const bizId = currentBusiness?.id;

  // Call Center Session
  const callCenter = useCallCenterSession();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Legacy dialer state
  const [dialerState, setDialerState] = useState<DialerState>('idle');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [myAgentStatus, setMyAgentStatus] = useState<AgentStatus>('offline');
  const [dispositionModal, setDispositionModal] = useState<{ sessionId: string; contactName: string; storeId?: string } | null>(null);
  const [screenPopSession, setScreenPopSession] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [voiceProvider, setVoiceProvider] = useState('auto');

  const [dispForm, setDispForm] = useState({
    disposition_code_id: '',
    notes: '',
    revenue_amount: '',
    decision_maker_name: '',
    competitor_mentioned: '',
    best_call_time: '',
    custom_followup: false,
    custom_followup_at: '',
  });

  // ── Data Queries ──
  const { data: campaigns = [] } = useQuery({
    queryKey: ['console-campaigns', bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dialer_campaigns')
        .select('id, name, status')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!bizId,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['console-agents', bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dialer_agent_availability')
        .select('*')
        .eq('business_id', bizId);
      return data || [];
    },
    enabled: !!bizId,
    refetchInterval: 3000,
  });

  const { data: dispositionCodes = [] } = useQuery({
    queryKey: ['disposition-codes-console'],
    queryFn: async () => {
      const { data } = await supabase
        .from('dialer_disposition_codes')
        .select('*')
        .eq('is_current', true)
        .order('display_number', { ascending: true });
      return (data || []) as DispositionCode[];
    },
  });

  const { data: dialerSettings } = useQuery({
    queryKey: ['console-settings', bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from('dialer_settings')
        .select('*')
        .eq('business_id', bizId)
        .maybeSingle();
      return data;
    },
    enabled: !!bizId,
  });

  const { data: activeSessions = [] } = useQuery({
    queryKey: ['console-live-sessions', bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from('live_call_sessions')
        .select('*')
        .eq('business_id', bizId)
        .is('ended_at', null)
        .order('connected_at', { ascending: false });
      return data || [];
    },
    enabled: !!bizId,
    refetchInterval: 2000,
  });

  const telephonyMode = (dialerSettings as any)?.telephony_mode || 'simulation';
  const isLiveMode = telephonyMode === 'live' && (dialerSettings as any)?.twilio_enabled;

  // ── Realtime ──
  useEffect(() => {
    if (!bizId) return;
    const channel = supabase
      .channel('console-live-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_call_sessions' }, (payload) => {
        if (payload.new && (payload.new as any).business_id === bizId) {
          setScreenPopSession(payload.new);
          toast.success(`📞 Live call: ${(payload.new as any).contact_name || 'Unknown'}`, { duration: 10000 });
        }
        queryClient.invalidateQueries({ queryKey: ['console-live-sessions'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'outbound_call_queue' }, () => {
        queryClient.invalidateQueries({ queryKey: ['console-queue'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dialer_agent_availability' }, () => {
        queryClient.invalidateQueries({ queryKey: ['console-agents'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bizId, queryClient]);

  // ── Engine loop ──
  const runEngineCycle = useCallback(async () => {
    if (!bizId) return;
    try {
      await supabase.functions.invoke('predictive-dialer-engine', {
        body: { business_id: bizId, campaign_id: selectedCampaign !== 'all' ? selectedCampaign : undefined },
      });
      queryClient.invalidateQueries({ queryKey: ['console-queue'] });
      queryClient.invalidateQueries({ queryKey: ['console-agents'] });
      queryClient.invalidateQueries({ queryKey: ['console-live-sessions'] });
    } catch (err) {
      console.error('Engine cycle error:', err);
    }
  }, [bizId, selectedCampaign, queryClient]);

  useEffect(() => {
    if (dialerState === 'running') {
      runEngineCycle();
      intervalRef.current = setInterval(runEngineCycle, 4000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [dialerState, runEngineCycle]);

  // ── Agent status mutation ──
  const updateMyStatus = async (newStatus: AgentStatus) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user?.id || !bizId) return;
    const { data: existing } = await supabase
      .from('dialer_agent_availability')
      .select('id')
      .eq('user_id', userData.user.id)
      .eq('business_id', bizId)
      .maybeSingle();
    if (existing) {
      await supabase.from('dialer_agent_availability').update({
        status: newStatus,
        last_status_change: new Date().toISOString(),
        ...(newStatus === 'available' ? { last_ready_at: new Date().toISOString() } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      await supabase.from('dialer_agent_availability').insert({
        user_id: userData.user.id,
        business_id: bizId,
        status: newStatus,
        last_status_change: new Date().toISOString(),
        ...(newStatus === 'available' ? { last_ready_at: new Date().toISOString() } : {}),
      });
    }
    setMyAgentStatus(newStatus);
    queryClient.invalidateQueries({ queryKey: ['console-agents'] });
    toast.success(`Status: ${agentStatusConfig[newStatus].label}`);
  };

  // ── Disposition mutation ──
  const dispositionMutation = useMutation({
    mutationFn: async () => {
      if (!dispositionModal) throw new Error('No session');
      const { data, error } = await supabase.functions.invoke('apply-call-disposition', {
        body: {
          session_id: dispositionModal.sessionId,
          disposition_code_id: dispForm.disposition_code_id,
          notes: dispForm.notes || null,
          revenue_amount: dispForm.revenue_amount ? parseFloat(dispForm.revenue_amount) : null,
          decision_maker_name: dispForm.decision_maker_name || null,
          competitor_mentioned: dispForm.competitor_mentioned || null,
          best_call_time: dispForm.best_call_time || null,
          custom_followup_at: dispForm.custom_followup && dispForm.custom_followup_at
            ? new Date(dispForm.custom_followup_at).toISOString() : null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const msg = data?.do_not_call_flagged
        ? '⛔ Disposed — Store flagged DO NOT CALL'
        : data?.followup_id
          ? '✅ Disposed — Follow-up scheduled'
          : '✅ Call disposed';
      toast.success(msg);
      setDispositionModal(null);
      setScreenPopSession(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['console-live-sessions'] });
    },
    onError: (err: any) => toast.error(`Disposition failed: ${err.message}`),
  });

  const resetForm = () => setDispForm({
    disposition_code_id: '', notes: '', revenue_amount: '', decision_maker_name: '',
    competitor_mentioned: '', best_call_time: '', custom_followup: false, custom_followup_at: '',
  });

  const selectedDisp = dispositionCodes.find(d => d.id === dispForm.disposition_code_id);
  const availableAgents = agents.filter(a => a.status === 'available');
  const selectedSession = callCenter.sessions.find(s => s.session_id === selectedSessionId);

  return (
    <div className="w-full min-h-full space-y-4">
      {/* ── Top Control Bar ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Headphones className="h-5 w-5" /> Call Center
          </h2>
          <Badge variant="outline" className={isLiveMode ? 'border-red-500/50 text-red-600 bg-red-500/5' : 'border-amber-500/50 text-amber-600 bg-amber-500/5'}>
            <Radio className={`h-3 w-3 mr-1 ${isLiveMode ? 'animate-pulse' : ''}`} />
            {isLiveMode ? 'LIVE' : 'SIMULATION'}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.filter(c => c.status === 'active').map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <VoiceProviderSelector provider={voiceProvider} onProviderChange={setVoiceProvider} compact />

          <Select value={myAgentStatus} onValueChange={(v) => updateMyStatus(v as AgentStatus)}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['available', 'away', 'offline'] as AgentStatus[]).map(s => (
                <SelectItem key={s} value={s}>
                  <span className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${s === 'available' ? 'bg-green-500' : s === 'away' ? 'bg-orange-500' : 'bg-muted-foreground'}`} />
                    {agentStatusConfig[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {dialerState === 'idle' && (
            <Button onClick={() => {
              if (availableAgents.length === 0) { toast.error('No agents ready'); return; }
              setDialerState('running');
              toast.success('Dialer started');
            }} className="gap-2 bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4" /> Start
            </Button>
          )}
          {dialerState === 'running' && (
            <>
              <Button onClick={() => { setDialerState('paused'); toast.info('Paused'); }} variant="outline" className="gap-2">
                <Pause className="h-4 w-4" /> Pause
              </Button>
              <Button onClick={() => { setDialerState('idle'); toast.info('Stopped'); }} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
          {dialerState === 'paused' && (
            <>
              <Button onClick={() => { setDialerState('running'); toast.success('Resumed'); }} className="gap-2 bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4" /> Resume
              </Button>
              <Button onClick={() => { setDialerState('idle'); toast.info('Stopped'); }} variant="destructive" className="gap-2">
                <Square className="h-4 w-4" /> Stop
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <CallCenterStatsBar
        activeCalls={callCenter.activeSessions.length + activeSessions.length}
        maxCapacity={callCenter.getTotalMaxConcurrent()}
        queueCount={callCenter.queueLength}
        callsToday={callCenter.totalCallsToday}
        answered={callCenter.totalAnswered}
        interested={callCenter.totalInterested}
      />

      {/* ── Agent Cards ── */}
      <AgentCards
        agents={callCenter.agents}
        onUpdateMaxConcurrent={(agentId, value) => {
          callCenter.setAgents(prev => prev.map(a =>
            a.id === agentId ? { ...a, max_concurrent: Math.max(1, Math.min(20, value)) } : a
          ));
        }}
      />

      {/* ── 3-Column Layout: Queue | Multi-Call Grid | SMS Thread ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT: Call Queue */}
        <div className="lg:col-span-3">
          <CallQueuePanel
            bizId={bizId}
            isRunning={callCenter.isRunning}
            onStartSession={callCenter.startCallCenterSession}
            onStopSession={callCenter.stopSession}
          />
        </div>

        {/* CENTER: Multi-Call Grid + Legacy Live Calls */}
        <div className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PhoneCall className="h-4 w-4" /> Active Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MultiCallGrid
                activeSessions={callCenter.activeSessions}
                completedSessions={callCenter.completedSessions}
                selectedSessionId={selectedSessionId}
                onSelectSession={setSelectedSessionId}
                queueLength={callCenter.queueLength}
                isRunning={callCenter.isRunning}
              />

              {/* Legacy live call sessions from DB */}
              {activeSessions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Live Sessions (Server)</p>
                  {activeSessions.map(session => (
                    <div key={session.id} className="border-2 border-green-500/50 rounded-xl p-3 bg-green-500/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                          <span className="font-bold">{session.contact_name || 'Unknown'}</span>
                        </div>
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                          <Clock className="h-3 w-3 mr-1" />
                          {(() => {
                            const diff = Math.floor((Date.now() - new Date(session.connected_at).getTime()) / 1000);
                            return `${Math.floor(diff / 60).toString().padStart(2, '0')}:${(diff % 60).toString().padStart(2, '0')}`;
                          })()}
                        </Badge>
                      </div>
                      {(session as any).phone_number && (
                        <p className="text-xs text-muted-foreground font-mono mb-2">{(session as any).phone_number}</p>
                      )}
                      <div className="flex gap-2">
                        <Button className="flex-1 gap-2 text-xs" size="sm" onClick={() => {
                          resetForm();
                          setDispositionModal({
                            sessionId: session.id,
                            contactName: session.contact_name || 'Unknown',
                            storeId: session.store_id,
                          });
                        }}>
                          <FileText className="h-3 w-3" /> Dispose
                        </Button>
                        <Button variant="destructive" size="icon" className="h-8 w-8" onClick={async () => {
                          if (session.store_id) {
                            await supabase.from('store_master').update({ do_not_call: true }).eq('id', session.store_id);
                            toast.success('⛔ Marked DO NOT CALL');
                          }
                        }}>
                          <Ban className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: SMS Thread for Selected Call */}
        <div className="lg:col-span-4">
          {selectedSession && selectedSession.phone ? (
            <CallSmsPanel
              phone={selectedSession.phone}
              contactName={selectedSession.store_name}
              leadId={selectedSession.lead_id}
              callId={selectedSession.session_id}
            />
          ) : activeSessions.length > 0 && (activeSessions[0] as any).phone_number ? (
            <CallSmsPanel
              phone={(activeSessions[0] as any).phone_number}
              contactName={activeSessions[0].contact_name || 'Unknown'}
              callId={activeSessions[0].id}
            />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-16">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm font-medium">SMS Thread</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click an active call to view the SMS conversation
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Disposition Modal ── */}
      <Dialog open={!!dispositionModal} onOpenChange={(o) => { if (!o) setDispositionModal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" /> Dispose — {dispositionModal?.contactName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Disposition *</Label>
              <Select value={dispForm.disposition_code_id} onValueChange={v => setDispForm(f => ({ ...f, disposition_code_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {['positive', 'neutral', 'negative', 'admin'].map(cat => {
                    const items = dispositionCodes.filter(d => d.category === cat);
                    return items.map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        <span className={cat === 'positive' ? 'text-green-600' : cat === 'negative' ? 'text-red-600' : cat === 'admin' ? 'text-orange-600' : ''}>
                          {d.label}
                        </span>
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
            </div>

            {selectedDisp?.marks_do_not_call && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive font-medium">
                ⛔ Permanently flags as DO NOT CALL
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Call notes..." value={dispForm.notes} onChange={e => setDispForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> Revenue</Label>
              <Input type="number" placeholder="0.00" value={dispForm.revenue_amount} onChange={e => setDispForm(f => ({ ...f, revenue_amount: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Decision Maker</Label>
                <Input placeholder="Name..." value={dispForm.decision_maker_name} onChange={e => setDispForm(f => ({ ...f, decision_maker_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Competitor</Label>
                <Input placeholder="Brand..." value={dispForm.competitor_mentioned} onChange={e => setDispForm(f => ({ ...f, competitor_mentioned: e.target.value }))} />
              </div>
            </div>

            {selectedDisp?.requires_followup && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-2">
                  <Checkbox checked={dispForm.custom_followup} onCheckedChange={c => setDispForm(f => ({ ...f, custom_followup: !!c }))} />
                  <Label className="text-sm">Override follow-up time</Label>
                </div>
                {dispForm.custom_followup && (
                  <Input type="datetime-local" value={dispForm.custom_followup_at} onChange={e => setDispForm(f => ({ ...f, custom_followup_at: e.target.value }))} />
                )}
                {!dispForm.custom_followup && selectedDisp.followup_delay_minutes && (
                  <p className="text-xs text-muted-foreground">
                    Auto in {selectedDisp.followup_delay_minutes >= 1440
                      ? `${Math.floor(selectedDisp.followup_delay_minutes / 1440)}d`
                      : `${selectedDisp.followup_delay_minutes}m`}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDispositionModal(null)}>Cancel</Button>
            <Button
              onClick={() => dispositionMutation.mutate()}
              disabled={!dispForm.disposition_code_id || dispositionMutation.isPending}
              className={selectedDisp?.marks_do_not_call ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {dispositionMutation.isPending ? 'Processing...' : selectedDisp?.marks_do_not_call ? '⛔ Confirm DNC' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
