import { useState, useEffect, useRef } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceDevice } from '@/contexts/VoiceDeviceProvider';
import { useCall } from '@/components/communication/CallProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, PhoneOff, Mic, MicOff, X, FileText, Send, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { VAScripts } from './VAScripts';
import { VARebuttals } from './VARebuttals';
import { VAFAQs } from './VAFAQs';
import { VAInvoiceModal } from './VAInvoiceModal';

interface ActiveCallLead {
  id: string;
  business_name: string;
  phone: string;
}

interface VACallPanelProps {
  lead: ActiveCallLead | null;
  onClose: () => void;
  onSendInvoice?: (lead: ActiveCallLead) => void;
}

export function VACallPanel({ lead, onClose, onSendInvoice }: VACallPanelProps) {
  const { t, twilioNumber, sessionId } = useVASession();
  const { user } = useAuth();
  const voice = useVoiceDevice();
  const { setVACallMetadata } = useCall();
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState(false);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync Twilio Device state → local state
  useEffect(() => {
    const vs = voice.callStatus;
    if (vs === 'ringing' && callStatus === 'ringing') {
      // stay ringing
    } else if (vs === 'in-progress' && (callStatus === 'ringing')) {
      setCallStatus('connected');
    } else if ((vs === 'completed' || vs === 'cancelled' || vs === 'failed') && callStatus === 'connected') {
      if (timerRef.current) clearInterval(timerRef.current);
      setCallStatus('ended');
    }
  }, [voice.callStatus, callStatus]);

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
    setSeconds(0);

    try {
      // Create call log on server
      const { data, error } = await supabase.functions.invoke('va-power-dialer', {
        body: {
          vaId: user?.id,
          twilioNumber,
          leadId: lead.id,
          leadPhone: lead.phone,
          leadName: lead.business_name,
          action: 'dial',
        },
      });

      if (error) throw error;
      setCallLogId(data?.callLogId || null);

      // Place the call from the browser using Twilio Voice SDK
      const call = await voice.makeCall(lead.phone, { Record: "true" });
      
      // Set global VA call metadata
      setVACallMetadata({
        isVACall: true,
        leadId: lead.id,
        leadName: lead.business_name,
        twilioNumber,
        callLogId: data?.callLogId || null,
        direction: 'outbound',
      });

      if (!call) {
        // Fallback: if SDK not ready, use server-initiated call
        if (data?.callSid) {
          setTimeout(() => setCallStatus(prev => prev === 'ringing' ? 'connected' : prev), 4000);
        } else {
          toast.error('Could not place call — check microphone permissions');
          setCallStatus('idle');
        }
      }
      // If call succeeded, state updates happen via voice.callStatus sync
    } catch (err: any) {
      toast.error(t('va.call.callFailed') + ': ' + (err.message || 'Unknown error'));
      setCallStatus('idle');
    }
  };

  const endCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallStatus('ended');

    // Disconnect via global provider
    endActiveCall();

    // Update call log
    if (callLogId) {
      await (supabase as any)
        .from('va_call_logs')
        .update({
          call_status: 'completed',
          duration_seconds: seconds,
        })
        .eq('id', callLogId);
    }

    toast.success(t('va.call.ended'));
  };

  const handleInvoiceClose = () => {
    setInvoiceOpen(false);
    setInvoiceCreated(true);
  };

  const effectiveMuted = voice.activeCall ? voice.isMuted : false;

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
      {/* Voice Status */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
        {voice.deviceState === 'registered' ? (
          <>
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-400">Softphone Ready</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400">Connecting to Twilio...</span>
          </>
        )}
      </div>

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
        <div className="flex gap-2 justify-center flex-wrap">
          {callStatus === 'idle' && (
            <Button onClick={initiateCall} className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-8">
              <Phone className="h-4 w-4" /> {t('va.leads.call')}
            </Button>
          )}
          {callStatus === 'connected' && (
            <>
              <Button size="lg" variant={effectiveMuted ? 'destructive' : 'secondary'} onClick={() => voice.toggleMute()}>
                {effectiveMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button size="lg" variant="destructive" onClick={endCall} className="px-8 gap-2">
                <PhoneOff className="h-5 w-5" /> {t('va.call.endCall')}
              </Button>
            </>
          )}
        </div>

        {/* Invoice buttons during/after call */}
        {(callStatus === 'connected' || callStatus === 'ended') && (
          <div className="flex gap-2 justify-center mt-3 pt-3 border-t border-slate-700">
            <Button
              size="sm"
              variant="outline"
              className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 gap-1"
              onClick={() => setInvoiceOpen(true)}
            >
              <FileText className="h-3.5 w-3.5" /> {t('va.leads.createInvoice')}
            </Button>
            {invoiceCreated && onSendInvoice && (
              <Button
                size="sm"
                variant="outline"
                className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 gap-1"
                onClick={() => onSendInvoice(lead)}
              >
                <Send className="h-3.5 w-3.5" /> {t('va.leads.sendInvoice')}
              </Button>
            )}
          </div>
        )}
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

      {/* Invoice Modal */}
      <VAInvoiceModal
        open={invoiceOpen}
        onClose={handleInvoiceClose}
        lead={lead}
      />
    </div>
  );
}
