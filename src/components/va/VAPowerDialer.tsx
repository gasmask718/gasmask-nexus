import { useState, useEffect, useRef, useCallback } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceDevice } from '@/contexts/VoiceDeviceProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Phone, PhoneOff, Mic, MicOff, Pause, Play, X, FileText,
  Send, Flame, Sun, Snowflake, SkipForward, Voicemail,
  MessageSquare, Target, PhoneCall, Wifi, WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { VAInvoiceModal } from './VAInvoiceModal';
import { VACoachingReport } from './VACoachingReport';
import { useQuery } from '@tanstack/react-query';

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
  const voice = useVoiceDevice();

  const [isDialing, setIsDialing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [seconds, setSeconds] = useState(0);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  const [callSid, setCallSid] = useState<string | null>(null);
  const [excitementLevel, setExcitementLevel] = useState<ExcitementLevel | null>(null);
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [notes, setNotes] = useState('');
  const [callbackDate, setCallbackDate] = useState('');
  const [showCoaching, setShowCoaching] = useState(false);
  const [coachingData, setCoachingData] = useState<any>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [needsDisposition, setNeedsDisposition] = useState(false);
  const [customNumber, setCustomNumber] = useState('');
  const [customName, setCustomName] = useState('');
  const [isCustomCall, setIsCustomCall] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const notesTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentLead = leads[currentIndex] || null;
  const nextLead = leads[currentIndex + 1] || null;

  // Sync Twilio Device call state with our local state
  useEffect(() => {
    if (voice.callStatus === 'in-progress' && callStatus === 'ringing') {
      setCallStatus('connected');
    } else if (voice.callStatus === 'completed' && callStatus === 'connected') {
      // Call ended from Twilio side
      if (timerRef.current) clearInterval(timerRef.current);
      setCallStatus('ended');
      setNeedsDisposition(true);
    }
  }, [voice.callStatus, callStatus]);

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

  // Auto-save notes
  useEffect(() => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    if (notes && callLogId) {
      notesTimerRef.current = setTimeout(async () => {
        await (supabase as any).from('va_call_logs').update({ va_notes: notes }).eq('id', callLogId);
      }, 10000);
    }
    return () => { if (notesTimerRef.current) clearTimeout(notesTimerRef.current); };
  }, [notes, callLogId]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const dialCurrent = useCallback(async () => {
    if (!currentLead || !twilioNumber || !user) return;

    setCallStatus('dialing');
    setSeconds(0);
    setExcitementLevel(null);
    setDisposition(null);
    setNotes('');
    setCallbackDate('');
    setNeedsDisposition(false);
    setCoachingData(null);

    try {
      const { data, error } = await supabase.functions.invoke('va-power-dialer', {
        body: {
          vaId: user.id,
          twilioNumber,
          leadId: currentLead.id,
          leadPhone: currentLead.phone,
          leadName: currentLead.business_name,
          action: 'dial',
        },
      });

      if (error) throw error;

      if (data?.skipped) {
        toast.info(`${currentLead.business_name} skipped (DNC)`);
        moveToNext();
        return;
      }

      setCallLogId(data?.callLogId || null);
      setCallSid(data?.callSid || null);
      setCallStatus('ringing');
      refetchStats();

      // If Twilio Device is not connected, fall back to timer-based status
      if (!voice.browserCallingConfigured) {
        setTimeout(() => setCallStatus(prev => prev === 'ringing' ? 'connected' : prev), 4000);
      }
    } catch (err: any) {
      toast.error('Call failed: ' + (err.message || 'Unknown error'));
      setCallStatus('idle');
    }
  }, [currentLead, twilioNumber, user, refetchStats, voice.browserCallingConfigured]);

  const endCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallStatus('ended');
    setNeedsDisposition(true);

    // Hang up via Twilio Device SDK
    if (voice.activeCall) {
      voice.hangUp();
    }

    // Also tell the server to end the call
    if (callSid && user) {
      try {
        await supabase.functions.invoke('va-power-dialer', {
          body: { vaId: user.id, action: 'hangup', callSid },
        });
      } catch (_) { /* best effort */ }
    }

    if (callLogId) {
      await (supabase as any).from('va_call_logs')
        .update({ call_status: 'completed', duration_seconds: seconds })
        .eq('id', callLogId);
    }
    refetchStats();
  };

  const toggleMute = () => {
    if (voice.activeCall) {
      voice.toggleMute();
    }
  };

  const submitDisposition = async (disp: Disposition) => {
    setDisposition(disp);
    setNeedsDisposition(false);

    if (callLogId && user) {
      await supabase.functions.invoke('va-power-dialer', {
        body: {
          vaId: user.id,
          action: 'disposition',
          callLogId,
          disposition: disp,
          excitementLevel,
          notes,
          callbackAt: disp === 'callback' ? callbackDate : null,
          leadId: currentLead?.id,
        },
      });
    }

    refetchStats();

    if (isCustomCall) {
      setIsCustomCall(false);
      setCallStatus('idle');
    } else if (isDialing && !isPaused) {
      setTimeout(() => moveToNext(), 1500);
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

  const startSession = () => {
    setIsDialing(true);
    setIsPaused(false);
    setCurrentIndex(0);
    dialCurrent();
  };

  const pauseSession = () => setIsPaused(true);
  const resumeSession = () => {
    setIsPaused(false);
    if (callStatus === 'idle') dialCurrent();
  };

  const dialCustomNumber = useCallback(async () => {
    if (!customNumber || !twilioNumber || !user) return;
    const cleanNumber = customNumber.replace(/[^\d+]/g, '');
    if (cleanNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsCustomCall(true);
    setCallStatus('dialing');
    setSeconds(0);
    setExcitementLevel(null);
    setDisposition(null);
    setNotes('');
    setCallbackDate('');
    setNeedsDisposition(false);
    setCoachingData(null);

    try {
      const { data, error } = await supabase.functions.invoke('va-power-dialer', {
        body: {
          vaId: user.id,
          twilioNumber,
          leadId: null,
          leadPhone: cleanNumber,
          leadName: customName || 'Manual Call',
          action: 'dial',
        },
      });

      if (error) throw error;

      setCallLogId(data?.callLogId || null);
      setCallSid(data?.callSid || null);
      setCallStatus('ringing');
      refetchStats();

      if (!voice.browserCallingConfigured) {
        setTimeout(() => setCallStatus(prev => prev === 'ringing' ? 'connected' : prev), 4000);
      }
    } catch (err: any) {
      toast.error('Call failed: ' + (err.message || 'Unknown error'));
      setCallStatus('idle');
      setIsCustomCall(false);
    }
  }, [customNumber, customName, twilioNumber, user, refetchStats, voice.browserCallingConfigured]);

  const handleSendSMS = async () => {
    if (!currentLead || !user) return;
    toast.success('Follow-up SMS sent!');
  };

  const callsDialed = todayStats?.calls_dialed || 0;
  const callsTarget = goals?.calls_target || 100;
  const dialProgress = Math.min((callsDialed / callsTarget) * 100, 100);

  // Determine effective mute state from Twilio Device
  const effectiveMuted = voice.activeCall ? voice.isMuted : false;

  return (
    <div className="space-y-4">
      {/* Voice Device Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
        {voice.browserCallingConfigured ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">Twilio Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400">Softphone initializing...</span>
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

      {/* Current Lead Card */}
      {(currentLead || isCustomCall) && (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-white text-lg">
                  {isCustomCall ? (customName || 'Manual Call') : (currentLead?.business_name || 'Unknown')}
                </h3>
                <p className="text-sm text-slate-400 font-mono">
                  {isCustomCall ? customNumber : currentLead?.phone}
                </p>
              </div>
              <Badge className={
                callStatus === 'dialing' ? 'bg-blue-500/20 text-blue-400' :
                callStatus === 'ringing' ? 'bg-yellow-500/20 text-yellow-400 animate-pulse' :
                callStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' :
                callStatus === 'ended' ? 'bg-red-500/20 text-red-400' :
                callStatus === 'machine_detected' ? 'bg-purple-500/20 text-purple-400' :
                'bg-slate-600 text-slate-300'
              }>
                {callStatus === 'dialing' ? '📞 Dialing...' :
                 callStatus === 'ringing' ? '📞 Ringing...' :
                 callStatus === 'connected' ? '🟢 Connected' :
                 callStatus === 'ended' ? '🔴 Ended' :
                 callStatus === 'machine_detected' ? '🤖 Voicemail' :
                 '⏸ Ready'}
              </Badge>
            </div>

            {/* Timer */}
            {callStatus !== 'idle' && (
              <div className="text-center mb-3">
                <span className="text-3xl font-mono text-white tabular-nums">{formatTime(seconds)}</span>
              </div>
            )}

            {/* Call Action Buttons */}
            <div className="flex gap-2 justify-center flex-wrap mb-3">
              {callStatus === 'idle' && !needsDisposition && (
                <Button onClick={dialCurrent} className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-8">
                  <Phone className="h-4 w-4" /> Call
                </Button>
              )}
              {callStatus === 'connected' && (
                <>
                  <Button size="lg" variant={effectiveMuted ? 'destructive' : 'secondary'} onClick={toggleMute}>
                    {effectiveMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  <Button size="lg" variant="destructive" onClick={endCall} className="px-8 gap-2">
                    <PhoneOff className="h-5 w-5" /> End
                  </Button>
                </>
              )}
              {callStatus === 'machine_detected' && (
                <div className="flex gap-2">
                  <Button className="bg-purple-600 hover:bg-purple-700 gap-2" onClick={() => {
                    toast.success('Voicemail dropped!');
                    setCallStatus('ended');
                    setNeedsDisposition(true);
                  }}>
                    <Voicemail className="h-4 w-4" /> Drop Voicemail
                  </Button>
                  <Button variant="secondary" onClick={() => moveToNext()} className="gap-2">
                    <SkipForward className="h-4 w-4" /> Skip
                  </Button>
                </div>
              )}
            </div>

            {/* Excitement Level Buttons */}
            {(callStatus === 'connected' || callStatus === 'ended') && (
              <div className="flex gap-2 justify-center mb-3">
                <Button
                  size="lg"
                  className={`gap-2 px-6 ${excitementLevel === 'hot' ? 'bg-red-600 ring-2 ring-red-400' : 'bg-red-600/30 hover:bg-red-600/50 text-red-300'}`}
                  onClick={() => setExcitementLevel('hot')}
                >
                  <Flame className="h-5 w-5" /> HOT
                </Button>
                <Button
                  size="lg"
                  className={`gap-2 px-6 ${excitementLevel === 'warm' ? 'bg-amber-600 ring-2 ring-amber-400' : 'bg-amber-600/30 hover:bg-amber-600/50 text-amber-300'}`}
                  onClick={() => setExcitementLevel('warm')}
                >
                  <Sun className="h-5 w-5" /> WARM
                </Button>
                <Button
                  size="lg"
                  className={`gap-2 px-6 ${excitementLevel === 'cold' ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-blue-600/30 hover:bg-blue-600/50 text-blue-300'}`}
                  onClick={() => setExcitementLevel('cold')}
                >
                  <Snowflake className="h-5 w-5" /> COLD
                </Button>
              </div>
            )}

            {/* Disposition Buttons */}
            {needsDisposition && (
              <div className="space-y-2 border-t border-slate-700 pt-3">
                <p className="text-xs text-slate-400 font-medium text-center">Select disposition before next call:</p>
                <div className="flex gap-1 flex-wrap justify-center">
                  {[
                    { key: 'closed' as Disposition, label: '✅ Closed', cls: 'bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300' },
                    { key: 'not_interested' as Disposition, label: '❌ Not Interested', cls: 'bg-red-600/30 hover:bg-red-600/50 text-red-300' },
                    { key: 'callback' as Disposition, label: '📅 Call Back', cls: 'bg-orange-600/30 hover:bg-orange-600/50 text-orange-300' },
                    { key: 'no_answer' as Disposition, label: '📵 No Answer', cls: 'bg-slate-600/30 hover:bg-slate-600/50 text-slate-300' },
                    { key: 'voicemail' as Disposition, label: '📧 Left VM', cls: 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-300' },
                  ].map(d => (
                    <Button key={d.key} size="sm" className={`text-xs ${d.cls}`} onClick={() => submitDisposition(d.key)}>
                      {d.label}
                    </Button>
                  ))}
                </div>
                {disposition === null && (
                  <div className="mt-2">
                    <input
                      type="datetime-local"
                      value={callbackDate}
                      onChange={e => setCallbackDate(e.target.value)}
                      className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 w-full"
                      placeholder="Callback date/time"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {(callStatus === 'connected' || callStatus === 'ended') && (
              <div className="mt-3">
                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Call notes (auto-saves)..."
                  className="bg-slate-700/50 border-slate-600 text-white text-sm resize-none h-20"
                />
              </div>
            )}

            {/* Post-call actions */}
            {callStatus === 'ended' && (
              <div className="flex gap-2 justify-center mt-3 pt-3 border-t border-slate-700">
                <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 gap-1"
                  onClick={() => setInvoiceOpen(true)}>
                  <FileText className="h-3.5 w-3.5" /> Create Invoice
                </Button>
                <Button size="sm" variant="outline" className="text-cyan-400 border-cyan-500/30 gap-1"
                  onClick={handleSendSMS}>
                  <MessageSquare className="h-3.5 w-3.5" /> Send Follow-Up SMS
                </Button>
              </div>
            )}
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

      {/* Coaching Report Modal */}
      {showCoaching && coachingData && (
        <VACoachingReport data={coachingData} onClose={() => setShowCoaching(false)} />
      )}

      {/* Invoice Modal */}
      <VAInvoiceModal open={invoiceOpen} onClose={() => setInvoiceOpen(false)} lead={currentLead} />
    </div>
  );
}
