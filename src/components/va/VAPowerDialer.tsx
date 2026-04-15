import { useState, useEffect, useRef, useCallback } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/components/communication/CallProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Phone, PhoneOff, Mic, MicOff, Pause, Play, X,
  SkipForward, PhoneCall, Wifi, WifiOff, Target, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { VAInvoiceModal } from './VAInvoiceModal';
import { VACoachingReport } from './VACoachingReport';
import { VAInCallModal } from './VAInCallModal';
import { useQuery } from '@tanstack/react-query';
import { Device, Call } from '@twilio/voice-sdk';

interface Lead {
  id: string;
  business_name: string;
  phone: string;
  email?: string | null;
}

type CallStatus = 'idle' | 'dialing' | 'ringing' | 'connected' | 'ended' | 'machine_detected' | 'no_answer';
type Disposition = 'closed' | 'not_interested' | 'callback' | 'no_answer' | 'voicemail' | 'dnc';
type ExcitementLevel = 'hot' | 'warm' | 'cold';

interface VAPowerDialerProps {
  leads: Lead[];
  onEndSession: () => void;
}

export function VAPowerDialer({ leads, onEndSession }: VAPowerDialerProps) {
  const { t, twilioNumber } = useVASession();
  const { user } = useAuth();
  const { setVACallMetadata, endActiveCall } = useCall();

  // Brandaro-specific Twilio Device
  const brandaroDeviceRef = useRef<Device | null>(null);
  const brandaroCallRef = useRef<Call | null>(null);
  const [brandaroDeviceState, setBrandaroDeviceState] = useState<'idle' | 'fetching' | 'ready' | 'error'>('idle');
  const [brandaroMuted, setBrandaroMuted] = useState(false);

  const [isDialing, setIsDialing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [showCoaching, setShowCoaching] = useState(false);
  const [coachingData, setCoachingData] = useState<any>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [customNumber, setCustomNumber] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustomCall, setIsCustomCall] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initRef = useRef(false);

  const currentLead = leads[currentIndex] || null;
  const nextLead = leads[currentIndex + 1] || null;

  // ── Initialize Brandaro Twilio Device ──
  const initBrandaroDevice = useCallback(async () => {
    if (initRef.current || brandaroDeviceRef.current) return;
    initRef.current = true;
    setBrandaroDeviceState('fetching');

    try {
      const { data, error } = await supabase.functions.invoke('brandaro-voice-token');
      if (error || !data?.token) {
        console.warn('[Brandaro] Token fetch failed:', error?.message || data?.error);
        setBrandaroDeviceState('error');
        initRef.current = false;
        return;
      }

      const device = new Device(data.token, {
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        logLevel: 1,
      });

      device.on('registered', () => {
        setBrandaroDeviceState('ready');
        console.log('[Brandaro] Device registered');
      });
      device.on('error', (err) => {
        console.warn('[Brandaro] Device error:', err.message);
        setBrandaroDeviceState('error');
      });
      device.on('tokenWillExpire', async () => {
        const { data: refreshData } = await supabase.functions.invoke('brandaro-voice-token');
        if (refreshData?.token) device.updateToken(refreshData.token);
      });

      await device.register();
      brandaroDeviceRef.current = device;
    } catch (err) {
      console.error('[Brandaro] Init error:', err);
      setBrandaroDeviceState('error');
    } finally {
      initRef.current = false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (brandaroDeviceRef.current) {
        brandaroDeviceRef.current.destroy();
        brandaroDeviceRef.current = null;
      }
    };
  }, []);

  // Daily goals
  const { data: goals } = useQuery({
    queryKey: ['va-daily-goals', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('va_daily_goals')
        .select('*')
        .eq('va_id', user?.id)
        .eq('goal_date', today)
        .maybeSingle();
      return data || { calls_target: 100, closes_target: 10 };
    },
    enabled: !!user,
  });

  // Today's stats
  const { data: todayStats, refetch: refetchStats } = useQuery({
    queryKey: ['va-today-stats', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await (supabase as any)
        .from('va_leaderboard_stats')
        .select('*')
        .eq('va_id', user?.id)
        .eq('session_date', today)
        .maybeSingle();
      return data || { calls_dialed: 0, calls_answered: 0, calls_closed: 0, total_talk_time_seconds: 0 };
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Timer
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Dial using Brandaro Device ──
  const dialNumber = useCallback(async (phone: string, leadId: string | null, leadName: string) => {
    if (!user) return;

    // Init device if needed
    if (!brandaroDeviceRef.current) {
      await initBrandaroDevice();
      // Wait a moment for registration
      await new Promise(r => setTimeout(r, 1500));
    }

    setCallStatus('dialing');
    setSeconds(0);
    setBrandaroMuted(false);
    setCallModalOpen(true);

    try {
      // Step 1: Server-side DNC check + call log creation
      const { data, error } = await supabase.functions.invoke('va-power-dialer', {
        body: {
          vaId: user.id,
          twilioNumber: '+19292623850',
          leadId,
          leadPhone: phone,
          leadName,
          action: 'dial',
        },
      });

      if (error) throw error;

      if (data?.skipped) {
        toast.info(`${leadName} skipped (DNC)`);
        setCallModalOpen(false);
        return 'skipped';
      }

      setCallLogId(data?.callLogId || null);

      // Step 2: Dial using Brandaro Twilio Device
      if (brandaroDeviceRef.current) {
        const call = await brandaroDeviceRef.current.connect({
          params: {
            To: phone,
            callLogId: data?.callLogId || '',
          },
        });

        brandaroCallRef.current = call;
        const sid = call.parameters?.CallSid || null;
        setCallSid(sid);
        setCallStatus('ringing');

        // Save call_sid immediately
        if (sid && data?.callLogId) {
          (supabase as any).from('va_call_logs')
            .update({ call_sid: sid })
            .eq('id', data.callLogId)
            .then(() => {});
        }

        // Set global metadata
        setVACallMetadata({
          isVACall: true,
          leadId,
          leadName,
          twilioNumber: '+19292623850',
          callLogId: data?.callLogId || null,
          direction: 'outbound',
        });

        // Listen for call events
        call.on('accept', () => setCallStatus('connected'));
        call.on('ringing', () => setCallStatus('ringing'));
        call.on('disconnect', () => {
          if (timerRef.current) clearInterval(timerRef.current);
          setCallStatus('ended');
          brandaroCallRef.current = null;
          // Trigger recording sync after a delay
          syncRecordingForCall(sid);
        });
        call.on('cancel', () => {
          setCallStatus('ended');
          brandaroCallRef.current = null;
        });
        call.on('error', (err) => {
          console.error('[Brandaro] Call error:', err);
          setCallStatus('ended');
          brandaroCallRef.current = null;
        });
      } else {
        toast.error('Brandaro voice device not ready. Retrying...');
        await initBrandaroDevice();
        setCallStatus('idle');
        setCallModalOpen(false);
        return 'failed';
      }

      refetchStats();
      return 'success';
    } catch (err: any) {
      toast.error('Call failed: ' + (err.message || 'Unknown error'));
      setCallStatus('idle');
      setCallModalOpen(false);
      return 'failed';
    }
  }, [user, initBrandaroDevice, refetchStats, setVACallMetadata]);

  // Sync recording after call ends
  const syncRecordingForCall = useCallback(async (sid: string | null) => {
    if (!sid) return;
    // Wait for Twilio to process the recording (10 seconds)
    setTimeout(async () => {
      try {
        await supabase.functions.invoke('brandaro-sync-recordings', {
          body: { call_sid: sid },
        });
        console.log('[Brandaro] Recording sync triggered for', sid);
      } catch (err) {
        console.warn('[Brandaro] Recording sync failed:', err);
      }
    }, 10000);
  }, []);

  const dialCurrent = useCallback(async () => {
    if (!currentLead) return;
    const result = await dialNumber(currentLead.phone, currentLead.id, currentLead.business_name);
    if (result === 'skipped') {
      moveToNext();
    }
  }, [currentLead, dialNumber]);

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    // Hang up Brandaro call
    if (brandaroCallRef.current) {
      brandaroCallRef.current.disconnect();
      brandaroCallRef.current = null;
    }

    setCallStatus('ended');

    // Update call log
    if (callLogId) {
      (supabase as any).from('va_call_logs')
        .update({ call_status: 'completed', duration_seconds: seconds })
        .eq('id', callLogId)
        .then(() => {});
    }

    // Trigger recording sync
    syncRecordingForCall(callSid);
    refetchStats();
  };

  const toggleMute = () => {
    if (brandaroCallRef.current) {
      const newMuted = !brandaroMuted;
      brandaroCallRef.current.mute(newMuted);
      setBrandaroMuted(newMuted);
    }
  };

  const handleDisposition = async (
    disp: Disposition,
    excitement: ExcitementLevel | null,
    notes: string,
    callbackDate: string,
  ) => {
    if (callLogId && user) {
      await supabase.functions.invoke('va-power-dialer', {
        body: {
          vaId: user.id,
          action: 'disposition',
          callLogId,
          disposition: disp,
          excitementLevel: excitement,
          notes,
          callbackAt: disp === 'callback' ? callbackDate : null,
          leadId: isCustomCall ? null : currentLead?.id,
        },
      });
    }

    refetchStats();
    setCallModalOpen(false);
    setCallStatus('idle');

    if (isCustomCall) {
      setIsCustomCall(false);
    } else if (isDialing && !isPaused) {
      setTimeout(() => moveToNext(), 1000);
    }
  };

  const moveToNext = () => {
    if (currentIndex < leads.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setCallStatus('idle');
      if (isDialing && !isPaused) {
        setTimeout(() => dialCurrent(), 500);
      }
    } else {
      toast.success('All leads dialed!');
      setIsDialing(false);
      setCallStatus('idle');
    }
  };

  const startSession = async () => {
    // Init Brandaro device first
    if (!brandaroDeviceRef.current) {
      toast.info('Initializing Brandaro softphone...');
      await initBrandaroDevice();
      await new Promise(r => setTimeout(r, 2000));
    }

    // Request mic
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      toast.error('Microphone permission required');
      return;
    }

    setIsDialing(true);
    setIsPaused(false);
    setCurrentIndex(0);
    // dialCurrent will be called via the effect or directly
    if (leads.length > 0) {
      const result = await dialNumber(leads[0].phone, leads[0].id, leads[0].business_name);
      if (result === 'skipped') moveToNext();
    }
  };

  const pauseSession = () => setIsPaused(true);
  const resumeSession = () => {
    setIsPaused(false);
    if (callStatus === 'idle') dialCurrent();
  };

  const dialCustomNumber = useCallback(async () => {
    if (!customNumber) return;
    const cleanNumber = customNumber.replace(/[^\d+]/g, '');
    if (cleanNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    const e164 = cleanNumber.startsWith('+') ? cleanNumber : `+1${cleanNumber}`;
    setIsCustomCall(true);
    const result = await dialNumber(e164, null, customName || 'Manual Call');
    if (result === 'failed') setIsCustomCall(false);
  }, [customNumber, customName, dialNumber]);

  const callsDialed = todayStats?.calls_dialed || 0;
  const callsTarget = goals?.calls_target || 100;
  const dialProgress = Math.min((callsDialed / callsTarget) * 100, 100);

  const activeLeadName = isCustomCall ? (customName || 'Manual Call') : (currentLead?.business_name || 'Unknown');
  const activeLeadPhone = isCustomCall ? customNumber : (currentLead?.phone || '');

  return (
    <div className="space-y-4">
      {/* Brandaro Device Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
        {brandaroDeviceState === 'ready' ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">Brandaro Softphone Ready</span>
          </>
        ) : brandaroDeviceState === 'fetching' ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-slate-400 animate-pulse" />
            <span className="text-xs text-slate-400">Connecting to Brandaro...</span>
          </>
        ) : brandaroDeviceState === 'error' ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs text-red-400">Connection Error</span>
            <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={initBrandaroDevice}>Retry</Button>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-xs text-slate-500">Not connected</span>
            <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-cyan-400" onClick={initBrandaroDevice}>Connect</Button>
          </>
        )}
      </div>

      {/* Daily Goal Progress */}
      <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Target className="h-3.5 w-3.5" />
            <span>Daily Goal: {callsDialed}/{callsTarget} calls</span>
          </div>
          <span className="text-xs font-mono text-cyan-400">{Math.round(dialProgress)}%</span>
        </div>
        <Progress value={dialProgress} className="h-2" />
      </div>

      {/* Session Controls */}
      <div className="flex gap-2">
        {!isDialing ? (
          <Button onClick={startSession} className="bg-emerald-600 hover:bg-emerald-700 gap-2 flex-1" disabled={leads.length === 0}>
            <Phone className="h-4 w-4" /> Start Dialing Session ({leads.length} leads)
          </Button>
        ) : (
          <>
            {isPaused ? (
              <Button onClick={resumeSession} className="bg-cyan-600 hover:bg-cyan-700 gap-2 flex-1">
                <Play className="h-4 w-4" /> Resume
              </Button>
            ) : (
              <Button onClick={pauseSession} variant="secondary" className="gap-2 flex-1">
                <Pause className="h-4 w-4" /> Pause
              </Button>
            )}
            <Button onClick={onEndSession} variant="destructive" className="gap-2">
              <X className="h-4 w-4" /> End Session
            </Button>
          </>
        )}
      </div>

      {/* Custom Manual Dial */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <PhoneCall className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-white">Manual Dial</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              placeholder="Name (optional)"
              className="bg-slate-700 border-slate-600 text-white text-sm h-9 w-36"
              disabled={callStatus !== 'idle' && callStatus !== 'ended'}
            />
            <Input
              value={customNumber}
              onChange={e => setCustomNumber(e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="bg-slate-700 border-slate-600 text-white text-sm h-9 flex-1 font-mono"
              disabled={callStatus !== 'idle' && callStatus !== 'ended'}
              onKeyDown={e => { if (e.key === 'Enter') dialCustomNumber(); }}
            />
            <Button
              onClick={dialCustomNumber}
              disabled={!customNumber || (callStatus !== 'idle' && callStatus !== 'ended')}
              className="bg-cyan-600 hover:bg-cyan-700 h-9 gap-1.5"
              size="sm"
            >
              <Phone className="h-3.5 w-3.5" /> Call
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Lead Preview (when not in call) */}
      {currentLead && callStatus === 'idle' && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white">{currentLead.business_name}</h3>
              <p className="text-sm text-slate-400 font-mono">{currentLead.phone}</p>
            </div>
            <Button onClick={dialCurrent} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
              <Phone className="h-4 w-4" /> Call
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active call indicator (when call is active but modal might be interacted with) */}
      {callStatus !== 'idle' && !callModalOpen && (
        <Card className="bg-emerald-900/30 border-emerald-500/30 cursor-pointer" onClick={() => setCallModalOpen(true)}>
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm text-emerald-400 font-medium">
                {callStatus === 'connected' ? 'Active Call' : callStatus === 'ended' ? 'Call Ended — Disposition Needed' : 'Calling...'}
              </span>
              <span className="text-sm text-white font-mono">{formatTime(seconds)}</span>
            </div>
            <span className="text-xs text-slate-400">Click to open</span>
          </CardContent>
        </Card>
      )}

      {/* Next Lead Preview */}
      {nextLead && isDialing && (
        <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
          <p className="text-xs text-slate-500 mb-1">Up next:</p>
          <p className="text-sm text-slate-300 font-medium">{nextLead.business_name}</p>
          <p className="text-xs text-slate-400 font-mono">{nextLead.phone}</p>
        </div>
      )}

      {/* In-Call Modal */}
      <VAInCallModal
        open={callModalOpen && callStatus !== 'idle'}
        leadName={activeLeadName}
        leadPhone={activeLeadPhone}
        callLogId={callLogId}
        callStatus={callStatus as any}
        seconds={seconds}
        isMuted={brandaroMuted}
        onToggleMute={toggleMute}
        onEndCall={endCall}
        onDropVoicemail={() => {
          toast.success('Voicemail dropped!');
          if (brandaroCallRef.current) {
            brandaroCallRef.current.disconnect();
            brandaroCallRef.current = null;
          }
          setCallStatus('ended');
        }}
        onSkip={() => {
          if (brandaroCallRef.current) {
            brandaroCallRef.current.disconnect();
            brandaroCallRef.current = null;
          }
          setCallModalOpen(false);
          moveToNext();
        }}
        onDisposition={handleDisposition}
        onClose={() => {
          setCallModalOpen(false);
          setCallStatus('idle');
        }}
        onCreateInvoice={() => setInvoiceOpen(true)}
        onSendSMS={() => toast.success('Follow-up SMS sent!')}
      />

      {/* Coaching Report Modal */}
      {showCoaching && coachingData && (
        <VACoachingReport data={coachingData} onClose={() => setShowCoaching(false)} />
      )}

      {/* Invoice Modal */}
      <VAInvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} lead={currentLead} />
    </div>
  );
}
