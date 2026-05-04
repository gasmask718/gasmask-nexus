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
import { VAServicesPricing } from './VAServicesPricing';
import { VAInvoiceModal } from './VAInvoiceModal';
import { motion, AnimatePresence } from 'framer-motion';

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
  const { setVACallMetadata, endActiveCall } = useCall();
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState(false);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const vs = voice.callStatus;
    if (vs === 'ringing' && callStatus === 'ringing') {
      // stay ringing
    } else if (vs === 'in-progress' && callStatus === 'ringing') {
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

      const call = await voice.makeCall(lead.phone, { Record: "true" });

      setVACallMetadata({
        isVACall: true,
        leadId: lead.id,
        leadName: lead.business_name,
        twilioNumber,
        callLogId: data?.callLogId || null,
        direction: 'outbound',
      });

      if (!call) {
        if (data?.callSid) {
          setTimeout(() => setCallStatus(prev => prev === 'ringing' ? 'connected' : prev), 4000);
        } else {
          toast.error('Could not place call — check microphone permissions');
          setCallStatus('idle');
        }
      }
    } catch (err: any) {
      toast.error(t('va.call.callFailed') + ': ' + (err.message || 'Unknown error'));
      setCallStatus('idle');
    }
  };

  const endCall = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallStatus('ended');
    endActiveCall();

    if (callLogId) {
      await (supabase as any)
        .from('va_call_logs')
        .update({ call_status: 'completed', duration_seconds: seconds })
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
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center">
          <Phone className="h-9 w-9 text-muted-foreground/40" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-medium text-muted-foreground">{t('va.call.noActiveCall')}</p>
          <p className="text-sm text-muted-foreground/60">{t('va.call.startCall')}</p>
        </div>
      </div>
    );
  }

  const statusConfig = {
    idle: { label: 'Ready', bg: 'bg-muted/30', text: 'text-muted-foreground', pulse: false },
    ringing: { label: `📞 ${t('va.call.ringing')}`, bg: 'bg-yellow-500/15', text: 'text-yellow-400', pulse: true },
    connected: { label: `🟢 ${t('va.call.connected')}`, bg: 'bg-emerald-500/15', text: 'text-emerald-400', pulse: true },
    ended: { label: `🔴 ${t('va.call.ended')}`, bg: 'bg-destructive/15', text: 'text-destructive', pulse: false },
  };

  const currentStatus = statusConfig[callStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Voice Status */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/30 border border-border/50">
        {voice.deviceState === 'registered' ? (
          <>
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Softphone Ready</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs text-amber-400">Connecting to Twilio...</span>
          </>
        )}
      </div>

      {/* Call Header */}
      <div className="glass-card rounded-2xl p-5 border border-border/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-foreground text-lg">{lead.business_name}</h3>
            <p className="text-sm text-muted-foreground font-mono">{lead.phone}</p>
          </div>
          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Status + Timer */}
        <div className="flex items-center justify-between mb-5">
          <Badge variant="outline" className={`border-transparent ${currentStatus.bg} ${currentStatus.text} ${currentStatus.pulse ? 'animate-pulse' : ''}`}>
            {currentStatus.label}
          </Badge>
          {callStatus !== 'idle' && (
            <span className="text-3xl font-mono text-foreground tabular-nums tracking-tight">{formatTime(seconds)}</span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center flex-wrap">
          {callStatus === 'idle' && (
            <Button onClick={initiateCall} size="lg" className="gap-2 px-8 rounded-xl">
              <Phone className="h-4 w-4" /> {t('va.leads.call')}
            </Button>
          )}
          {callStatus === 'connected' && (
            <>
              <Button
                size="lg"
                variant={effectiveMuted ? 'destructive' : 'secondary'}
                onClick={() => voice.toggleMute()}
                className="rounded-xl"
              >
                {effectiveMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              <Button size="lg" variant="destructive" onClick={endCall} className="px-8 gap-2 rounded-xl">
                <PhoneOff className="h-5 w-5" /> {t('va.call.endCall')}
              </Button>
            </>
          )}
        </div>

        {/* Invoice actions */}
        <AnimatePresence>
          {(callStatus === 'connected' || callStatus === 'ended') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 justify-center mt-4 pt-4 border-t border-border/30"
            >
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 rounded-lg"
                style={{ color: "hsl(var(--success))", borderColor: "hsl(var(--success) / 0.3)" }}
                onClick={() => setInvoiceOpen(true)}
              >
                <FileText className="h-3.5 w-3.5" /> {t('va.leads.createInvoice')}
              </Button>
              {invoiceCreated && onSendInvoice && (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 rounded-lg"
                  style={{ color: "hsl(var(--hud-amber))", borderColor: "hsl(var(--hud-amber) / 0.3)" }}
                  onClick={() => onSendInvoice(lead)}
                >
                  <Send className="h-3.5 w-3.5" /> {t('va.leads.sendInvoice')}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Contextual Tabs */}
      <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
        <Tabs defaultValue="services">
          <TabsList className="w-full bg-accent/30 rounded-none border-b border-border/30 h-10">
            <TabsTrigger value="services" className="flex-1 text-xs data-[state=active]:bg-background/50">Services & Pricing</TabsTrigger>
            <TabsTrigger value="faqs" className="flex-1 text-xs data-[state=active]:bg-background/50">{t('va.call.faqs')}</TabsTrigger>
            <TabsTrigger value="scripts" className="flex-1 text-xs data-[state=active]:bg-background/50">{t('va.call.scripts')}</TabsTrigger>
            <TabsTrigger value="rebuttals" className="flex-1 text-xs data-[state=active]:bg-background/50">{t('va.call.rebuttals')}</TabsTrigger>
          </TabsList>
          <TabsContent value="services" className="p-4"><VAServicesPricing /></TabsContent>
          <TabsContent value="faqs" className="p-4"><VAFAQs /></TabsContent>
          <TabsContent value="scripts" className="p-4"><VAScripts /></TabsContent>
          <TabsContent value="rebuttals" className="p-4"><VARebuttals /></TabsContent>
        </Tabs>
      </div>

      <VAInvoiceModal open={invoiceOpen} onClose={handleInvoiceClose} lead={lead} />
    </motion.div>
  );
}
