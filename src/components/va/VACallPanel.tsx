import { useState, useEffect, useRef } from 'react';
import { useVASession } from '@/contexts/VASessionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceDevice } from '@/contexts/VoiceDeviceProvider';
import { useVACompanySafe } from '@/contexts/VACompanyContext';
import { useCall } from '@/components/communication/CallProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, PhoneOff, Mic, MicOff, X, FileText, Send, Wifi, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { VAScripts } from './VAScripts';
import { GasMaskStoreWorkPanel } from './GasMaskStoreWorkPanel';
import { VARebuttals } from './VARebuttals';
import { VAFAQs } from './VAFAQs';
import { VAServicesPricing } from './VAServicesPricing';
import { VAInvoiceModal } from './VAInvoiceModal';
import { VALiveAnalysisModal } from './VALiveAnalysisModal';
import { VACallWrapUpModal } from './VACallWrapUpModal';
import { useQuery } from '@tanstack/react-query';
import { History, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveCallLead {
  id: string;
  business_name: string;
  phone: string;
  /** store_master id when the dial came from the GasMask store book */
  store_id?: string | null;
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
  const vaCompany = useVACompanySafe();
  const { setVACallMetadata, endActiveCall } = useCall();
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'connected' | 'ended'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceCreated, setInvoiceCreated] = useState(false);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // GasMask VAs work store accounts, not service quotes.
  const isGasMask = vaCompany?.activeCompany?.slug === 'gasmask_grabba';

  // Fetch the most recent prior wrap-up for this lead so the VA never starts from scratch
  const { data: priorContext } = useQuery({
    queryKey: ['va-prior-context', lead?.id],
    queryFn: async () => {
      if (!lead?.id) return null;
      const { data } = await (supabase as any)
        .from('va_call_logs')
        .select('id, called_at, follow_up_status, call_summary, next_call_context, follow_up_at')
        .eq('lead_id', lead.id)
        .not('wrap_up_completed_at', 'is', null)
        .order('called_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!lead?.id,
  });

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
      if (!callStartedAt) setCallStartedAt(Date.now());
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus, callStartedAt]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const initiateCall = async () => {
    if (!lead) return;
    if (!twilioNumber) {
      const companyName = vaCompany?.activeCompany?.name ?? 'This company';
      toast.error(`${companyName} has no phone number assigned. Add one before calling.`);
      return;
    }


    // Request mic permission directly from the user gesture (must be synchronous chain)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (err: any) {
      if (err?.name === 'NotAllowedError') {
        toast.error('Microphone blocked. Enable mic access in your browser settings, then retry.');
      } else if (err?.name === 'NotFoundError') {
        toast.error('No microphone detected on this device.');
      } else if (err?.name === 'NotReadableError') {
        toast.error('Microphone is in use by another application.');
      } else {
        toast.error('Microphone unavailable: ' + (err?.message || 'unknown error'));
      }
      setCallStatus('idle');
      return;
    }

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

      // Use custom param "CallerId" — Twilio overwrites "From" with the SDK identity,
      // so the user-selected number must travel under a non-reserved key.
      const call = await voice.makeCall(lead.phone, { Record: "true", CallerId: twilioNumber, callLogId: data?.callLogId || "" });

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
          // Server-side dial succeeded; browser audio leg unavailable — keep ringing UI
          setTimeout(() => setCallStatus(prev => prev === 'ringing' ? 'connected' : prev), 4000);
        } else {
          // Provider already shows a specific toast — just reset UI
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
    // Open wrap-up immediately so VA captures status + next-call context
    if (callLogId) setWrapUpOpen(true);
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

      {/* Prior call context — never start from scratch */}
      {priorContext && (priorContext.next_call_context || priorContext.call_summary) && (
        <div className="rounded-xl border border-gasmask/30 bg-gasmask/5 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <History className="h-3.5 w-3.5 text-gasmask-glow" />
            <span className="text-xs font-semibold text-gasmask-glow">Where you left off last time</span>
            {priorContext.follow_up_status && (
              <Badge className="bg-gasmask/20 text-gasmask-glow text-[10px]">{priorContext.follow_up_status.replace(/_/g, ' ')}</Badge>
            )}
            <span className="ml-auto text-[10px] text-slate-500">
              {priorContext.called_at ? new Date(priorContext.called_at).toLocaleString() : ''}
            </span>
          </div>
          {priorContext.next_call_context && (
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{priorContext.next_call_context}</p>
          )}
          {!priorContext.next_call_context && priorContext.call_summary && (
            <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed italic">{priorContext.call_summary}</p>
          )}
        </div>
      )}

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

      {/* Live Claude Analysis Modal — auto opens during call */}
      <VALiveAnalysisModal
        active={callStatus === 'connected'}
        callLogId={callLogId}
        leadId={lead.id}
        leadName={lead.business_name}
        startedAt={callStartedAt ?? undefined}
      />

      {/* Contextual Tabs */}
      <div className="glass-card rounded-2xl border border-border/50 overflow-hidden">
        <Tabs defaultValue={isGasMask ? 'account' : 'services'}>
          <TabsList className="w-full bg-accent/30 rounded-none border-b border-border/30 h-10">
            {isGasMask && (
              <TabsTrigger value="account" className="flex-1 text-xs data-[state=active]:bg-background/50">Account</TabsTrigger>
            )}
            {!isGasMask && (
              <TabsTrigger value="services" className="flex-1 text-xs data-[state=active]:bg-background/50">Services & Pricing</TabsTrigger>
            )}
            <TabsTrigger value="faqs" className="flex-1 text-xs data-[state=active]:bg-background/50">{t('va.call.faqs')}</TabsTrigger>
            <TabsTrigger value="scripts" className="flex-1 text-xs data-[state=active]:bg-background/50">{t('va.call.scripts')}</TabsTrigger>
            <TabsTrigger value="rebuttals" className="flex-1 text-xs data-[state=active]:bg-background/50">{t('va.call.rebuttals')}</TabsTrigger>
          </TabsList>
          {isGasMask && (
            <TabsContent value="account" className="p-4">
              <GasMaskStoreWorkPanel storeId={lead.store_id ?? lead.id} />
            </TabsContent>
          )}
          {!isGasMask && <TabsContent value="services" className="p-4"><VAServicesPricing /></TabsContent>}
          <TabsContent value="faqs" className="p-4"><VAFAQs /></TabsContent>
          <TabsContent value="scripts" className="p-4">
            <VAScripts
              companySlug={vaCompany?.activeCompany?.slug}
              companyName={vaCompany?.activeCompany?.name}
            />
          </TabsContent>
          <TabsContent value="rebuttals" className="p-4">
            <VARebuttals companySlug={vaCompany?.activeCompany?.slug} />
          </TabsContent>
        </Tabs>
      </div>

      <VAInvoiceModal open={invoiceOpen} onClose={handleInvoiceClose} lead={lead} />

      {/* Manual reopen if VA dismissed */}
      {callStatus === 'ended' && callLogId && !wrapUpOpen && (
        <div className="flex justify-center">
          <Button size="sm" variant="outline" className="gap-1.5 text-gasmask-glow border-gasmask/40" onClick={() => setWrapUpOpen(true)}>
            <RotateCcw className="h-3.5 w-3.5" /> Open call wrap-up
          </Button>
        </div>
      )}

      <VACallWrapUpModal
        open={wrapUpOpen}
        onClose={() => setWrapUpOpen(false)}
        callLogId={callLogId}
        leadName={lead.business_name}
        leadId={lead.id}
        durationSeconds={seconds}
      />
    </motion.div>
  );
}
