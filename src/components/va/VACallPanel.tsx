import { useState, useEffect, useRef } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, X } from 'lucide-react';
import { toast } from 'sonner';
import { VAScripts } from './VAScripts';
import { VARebuttals } from './VARebuttals';
import { VAFAQs } from './VAFAQs';

interface ActiveCallLead {
  id: string;
  business_name: string;
  phone: string;
}

interface VACallPanelProps {
  lead: ActiveCallLead | null;
  onClose: () => void;
}

export function VACallPanel({ lead, onClose }: VACallPanelProps) {
  const { t, twilioNumber, sessionId } = useVASession();
  const { user } = useAuth();
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [muted, setMuted] = useState(false);
  const [onHold, setOnHold] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const callLogIdRef = useRef<string | null>(null);

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

  const initiateCall = async () => {
    if (!lead || !twilioNumber) return;
    setCallStatus('ringing');

    try {
      const { data, error } = await supabase.functions.invoke('va-initiate-call', {
        body: {
          leadPhone: lead.phone,
          fromNumber: twilioNumber,
          leadId: lead.id,
          vaId: user?.id,
        },
      });

      if (error) throw error;
      callLogIdRef.current = data?.callLogId || null;

      // Simulate connection after 3s (real Twilio would use status callbacks)
      setTimeout(() => setCallStatus('connected'), 3000);
    } catch (err: any) {
      toast.error('Call failed: ' + (err.message || 'Unknown error'));
      setCallStatus('idle');
    }
  };

  const endCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallStatus('ended');

    // Save call log
    if (callLogIdRef.current) {
      await (supabase as any)
        .from('va_call_logs')
        .update({
          call_status: 'completed',
          duration_seconds: seconds,
        })
        .eq('id', callLogIdRef.current);
    }

    toast.success(t('va.call.ended'));
  };

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
        <Phone className="h-12 w-12 text-slate-600" />
        <p className="font-medium">{t('va.call.noActiveCall')}</p>
        <p className="text-sm">{t('va.call.startCall')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Call Header */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-white text-lg">{lead.business_name}</h3>
            <p className="text-sm text-slate-400 font-mono">{lead.phone}</p>
          </div>
          <Button size="icon" variant="ghost" className="text-slate-400" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Status + Timer */}
        <div className="flex items-center justify-between mb-4">
          <Badge className={
            callStatus === 'ringing' ? 'bg-yellow-500/20 text-yellow-400' :
            callStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' :
            callStatus === 'ended' ? 'bg-red-500/20 text-red-400' :
            'bg-slate-600 text-slate-300'
          }>
            {callStatus === 'ringing' ? `📞 ${t('va.call.ringing')}` :
             callStatus === 'connected' ? `🟢 ${t('va.call.connected')}` :
             callStatus === 'ended' ? `🔴 ${t('va.call.ended')}` : 'Ready'}
          </Badge>
          {callStatus !== 'idle' && (
            <span className="text-2xl font-mono text-white tabular-nums">{formatTime(seconds)}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 justify-center">
          {callStatus === 'idle' && (
            <Button onClick={initiateCall} className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-8">
              <Phone className="h-4 w-4" /> {t('va.leads.call')}
            </Button>
          )}
          {callStatus === 'connected' && (
            <>
              <Button size="lg" variant={muted ? 'destructive' : 'secondary'} onClick={() => setMuted(!muted)}>
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button size="lg" variant={onHold ? 'default' : 'secondary'} onClick={() => setOnHold(!onHold)}>
                {onHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </Button>
              <Button size="lg" variant="destructive" onClick={endCall} className="px-8 gap-2">
                <PhoneOff className="h-5 w-5" /> {t('va.call.endCall')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contextual Tabs */}
      <Tabs defaultValue="scripts" className="bg-slate-800/50 rounded-xl border border-slate-700">
        <TabsList className="w-full bg-slate-800 rounded-t-xl rounded-b-none border-b border-slate-700">
          <TabsTrigger value="scripts" className="flex-1 text-xs">{t('va.call.scripts')}</TabsTrigger>
          <TabsTrigger value="rebuttals" className="flex-1 text-xs">{t('va.call.rebuttals')}</TabsTrigger>
          <TabsTrigger value="faqs" className="flex-1 text-xs">{t('va.call.faqs')}</TabsTrigger>
        </TabsList>
        <TabsContent value="scripts" className="p-4"><VAScripts /></TabsContent>
        <TabsContent value="rebuttals" className="p-4"><VARebuttals /></TabsContent>
        <TabsContent value="faqs" className="p-4"><VAFAQs /></TabsContent>
      </Tabs>
    </div>
  );
}
