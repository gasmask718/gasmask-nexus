import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Phone, PhoneOff, SkipForward, X, Loader2, PlayCircle, AlertTriangle, PhoneCall, BookOpen,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { BrandaroCallScript } from './BrandaroCallScript';
import { useVoiceDevice } from '@/contexts/VoiceDeviceProvider';
import { useCall } from '@/components/communication/CallProvider';
import { useVASession } from '@/contexts/VASessionContext';
import { useVACompany } from '@/contexts/VACompanyContext';
import { getVACompanyConfig } from '@/config/vaCompanies';
import { VALiveAnalysisModal } from './VALiveAnalysisModal';
import { VACallWrapUpModal } from './VACallWrapUpModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VAScripts } from './VAScripts';
import { VARebuttals } from './VARebuttals';
import { VAFAQs } from './VAFAQs';
import { VAServicesPricing } from './VAServicesPricing';
import { GasMaskStoreWorkPanel, type NumbersProgress } from './GasMaskStoreWorkPanel';

// ─────────────────────────────────────────────────────────────────────────────
// VA Auto Dialer — Sequential Lead Processing State Machine
//
// Phases:
//   idle            → setup screen (campaign + number selection)
//   fetching_lead   → pulling next queue item
//   dialing         → call trigger sent, waiting for connect
//   connected       → live call
//   wrap_up         → disposition capture
//
// Backend trigger: reuses `va-power-dialer` edge function (action: "dial" /
// "disposition"). Compliance (DNC) is enforced server-side.
// ─────────────────────────────────────────────────────────────────────────────

type CallPhase = 'idle' | 'fetching_lead' | 'dialing' | 'connected' | 'wrap_up' | 'account_review';

interface Campaign {
  id: string;
  name: string;
  status: string;
}
interface PhoneNumber {
  id: string;
  phone_number: string;
  friendly_name: string | null;
  business: string | null;
  number_type: string | null;
}
interface Disposition {
  id: string;
  code: string;
  label: string;
  category: string | null;
  marks_do_not_call: boolean;
}

// Dispositions are sourced from dialer_disposition_codes (canonical UPPER_SNAKE).
// The wrap-up modal (VACallWrapUpModal) owns the picker; this component only
// receives the resolved code back via the onSaved callback.
interface QueueLead {
  queue_id: string;
  store_id: string;
  business_name: string;
  phone: string;
  notes: string | null;
  do_not_call: boolean;
  attempt_number: number;
}

export interface DialerListLead {
  id?: string;
  name: string;
  phone: string;
}

interface VAPowerDialerProps {
  // legacy prop kept for VADashboard compatibility — ignored by auto dialer
  leads?: any[];
  /** Optional explicit lead list — bypasses campaign queue, dials these in order. */
  leadList?: DialerListLead[];
  /** Optional pre-selected caller-ID (E.164) to seed the picker. */
  initialCallerId?: string;
  onEndSession: () => void;
}

export function VAPowerDialer({ onEndSession, leadList, initialCallerId }: VAPowerDialerProps) {
  const { user } = useAuth();
  const voice = useVoiceDevice();
  const { setVACallMetadata, endActiveCall } = useCall();
  const { twilioNumber: sessionNumber } = useVASession();
  const { activeCompany } = useVACompany();

  // ── Initialization data ─────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [dispositions, setDispositions] = useState<Disposition[]>([]);
  const [initLoading, setInitLoading] = useState(true);

  // ── Selections ──────────────────────────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedNumber, setSelectedNumber] = useState<string>(initialCallerId || sessionNumber || '');

  // Keep dialer caller-ID in sync with the live VA-session active number.
  // When the VA picks a different number from the topbar switcher, the
  // campaign immediately uses it for the next dial.
  useEffect(() => {
    if (sessionNumber && sessionNumber !== selectedNumber) {
      setSelectedNumber(sessionNumber);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionNumber]);

  // ── Session state ───────────────────────────────────────────────────
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [currentLead, setCurrentLead] = useState<QueueLead | null>(null);
  const [callLogId, setCallLogId] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);

  // ── Account completion gate ─────────────────────────────────────────
  // An account is only finished once EVERY number on it has been worked.
  // The work panel reports its own canonical progress here.
  const [numbersProgress, setNumbersProgress] = useState<NumbersProgress | null>(null);
  const [pendingAccount, setPendingAccount] = useState<{ lead: QueueLead; disposition: string | null } | null>(null);
  const [confirmingDone, setConfirmingDone] = useState(false);

  // ── Wrap-up form ────────────────────────────────────────────────────
  const [dispositionCode, setDispositionCode] = useState<string>('');
  const [vaNotes, setVaNotes] = useState<string>('');

  // ── Quick-dial (manual number) ──────────────────────────────────────
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [manualDialing, setManualDialing] = useState(false);

  // List-mode pointer (when leadList prop is provided)
  const [leadIndex, setLeadIndex] = useState(0);
  const listMode = !!leadList && leadList.length > 0;

  // Stop flag (lets us break out of the auto-loop cleanly)
  const stopFlagRef = useRef(false);
  // Guards finishWrapUp against double-fire (e.g., onSaved + backdrop dismiss).
  const wrapUpInFlightRef = useRef(false);

  // UI: reference modal (Scripts / FAQs / Rebuttals / Services & Pricing)
  const [referenceOpen, setReferenceOpen] = useState(false);
  // UI: post-call summary modal (parity with Active Call wrap-up)
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLead, setSummaryLead] = useState<QueueLead | null>(null);
  const [summaryCallLogId, setSummaryCallLogId] = useState<string | null>(null);
  const [summaryDuration, setSummaryDuration] = useState(0);

  // ── Phase 1: Initialization ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitLoading(true);
      try {
        // Campaigns are scoped to the businesses the ACTIVE VA company calls for.
        // Without this a caller on one brand can see (and dial) another brand's
        // campaigns. No company / no configured businesses = no campaigns.
        const businessSlugs = getVACompanyConfig(activeCompany?.slug).businessSlugs;
        let campaignBusinessIds: string[] = [];
        if (businessSlugs.length > 0) {
          const { data: bizRows, error: bizErr } = await (supabase as any)
            .from('businesses')
            .select('id, slug')
            .in('slug', businessSlugs);
          if (bizErr) console.warn('[AutoDialer] businesses:', bizErr);
          campaignBusinessIds = (bizRows || []).map((b: any) => b.id);
        }

        let campaignQuery = (supabase as any)
          .from('dialer_campaigns')
          .select('id, name, status')
          .eq('status', 'active')
          .is('archived_at', null)
          .order('created_at', { ascending: false });
        campaignQuery = campaignBusinessIds.length > 0
          ? campaignQuery.in('business_id', campaignBusinessIds)
          // Nothing resolvable to scope by — return no campaigns rather than all.
          : campaignQuery.eq('business_id', '00000000-0000-0000-0000-000000000000');

        const [campRes, numRes, dispRes] = await Promise.all([
          campaignQuery,
          // Pull from /communication/provision-numbers source of truth (dc_phone_numbers).
          // Exclude toll-free numbers and Brandaro AI Agent numbers per business rule.
          (supabase as any)
            .from('dc_phone_numbers')
            .select('id, phone_number, friendly_name, business, number_type')
            .eq('is_active', true)
            .eq('number_type', 'local')
            .not('friendly_name', 'ilike', '%AI Agent%')
            .order('phone_number'),
          // Dispositions are owned by the wrap-up modal now; fetch here only to
          // pre-warm and expose the resolved list for any consumers that still
          // read `dispositions` state (e.g. DNC stamping reference).
          (supabase as any)
            .from('dialer_disposition_codes')
            .select('id, code, label, display_number, category, marks_do_not_call')
            .eq('is_current', true)
            .order('display_number', { ascending: true }),
        ]);
        if (cancelled) return;
        setCampaigns(campRes.data || []);
        setNumbers(numRes.data || []);
        setDispositions((dispRes.data || []) as Disposition[]);
        if (campRes.error) console.warn('[AutoDialer] campaigns:', campRes.error);
        if (numRes.error) console.warn('[AutoDialer] numbers:', numRes.error);
        if (dispRes.error) console.warn('[AutoDialer] dispositions:', dispRes.error);
      } catch (err: any) {
        toast.error('Failed to load dialer config: ' + err.message);
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompany?.slug]);

  // ── Simulated call-drop timer (no live Twilio Device wired here) ────
  // The backend trigger is fire-and-forget; we surface a "Mark call ended"
  // button so the VA can advance to wrap-up the moment the call drops.
  useEffect(() => {
    if (phase === 'dialing') {
      // Auto-promote dialing → connected after a short ring window so the UI
      // reflects the actual conversation phase. Real connection events come
      // from Twilio webhooks → callLogs (out of scope for this component).
      const t = setTimeout(() => {
        setPhase((p) => (p === 'dialing' ? 'connected' : p));
        setCallStartedAt(Date.now());
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [phase]);

  // One writer for queue-item state changes (outbound_call_queue — the table
  // the call-list builder fills). Kept in one place so status columns stay
  // consistent across skip / DNC / no-number / completed paths.
  const markQueueItem = useCallback(async (queueId: string, status: 'skipped' | 'completed') => {
    if (!queueId) return;
    const { error } = await (supabase as any)
      .from('outbound_call_queue')
      .update({ status, ended_at: new Date().toISOString(), last_attempt_at: new Date().toISOString() })
      .eq('id', queueId);
    if (error) console.warn('[AutoDialer] queue update failed:', error.message);
  }, []);

  // ── Core loop: fetch next lead ──────────────────────────────────────
  const leadIndexRef = useRef(0);
  useEffect(() => { leadIndexRef.current = leadIndex; }, [leadIndex]);

  const fetchNextLead = useCallback(async (): Promise<QueueLead | null> => {
    setPhase('fetching_lead');

    // ── List mode: explicit lead array (no queue) ─────────────────────
    if (listMode) {
      const idx = leadIndexRef.current;
      if (!leadList || idx >= leadList.length) {
        toast.success('Lead list complete');
        setSessionRunning(false);
        setPhase('idle');
        return null;
      }
      const item = leadList[idx];
      const cleaned = (item.phone || '').replace(/[^\d+]/g, '');
      const digits = cleaned.replace(/\D/g, '');
      const e164 = !cleaned ? '' : (cleaned.startsWith('+') ? cleaned : `+1${digits}`);
      const lead: QueueLead = {
        queue_id: '',
        store_id: item.id || '',
        business_name: item.name || 'Unknown',
        phone: e164,
        notes: null,
        do_not_call: false,
        attempt_number: 0,
      };
      setCurrentLead(lead);
      return lead;
    }

    if (!selectedCampaign) return null;

    // Pull the highest-priority queued item for the selected campaign.
    // Queue table = outbound_call_queue: the SAME table the call-list builder
    // (dialer-call-list-builder) writes into. campaign_call_queue is empty and
    // has no writer, which is why the auto-loop found nothing to dial.
    const { data, error } = await (supabase as any)
      .from('outbound_call_queue')
      .select('id, store_id, phone_number, contact_name, notes, attempt_count, status')
      .eq('campaign_id', selectedCampaign)
      .eq('status', 'queued')
      .order('priority_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      toast.error('Queue fetch error: ' + error.message);
      setPhase('idle');
      return null;
    }
    if (!data) {
      toast.info('Queue empty for this campaign');
      setSessionRunning(false);
      setPhase('idle');
      return null;
    }

    // Resolve the canonical store record so the workspace opens on the exact
    // account being dialed (queue rows only carry store_id + phone).
    let store: any = null;
    if ((data as any).store_id) {
      const { data: st } = await (supabase as any)
        .from('store_master')
        .select('id, store_name, phone, notes, do_not_call')
        .eq('id', (data as any).store_id)
        .maybeSingle();
      store = st;
    }
    if (!store && !(data as any).phone_number) {
      toast.error('Queue item has no store and no number — skipping');
      await markQueueItem(data.id, 'skipped');
      return null;
    }
    const lead: QueueLead = {
      queue_id: data.id,
      store_id: store?.id || (data as any).store_id || '',
      business_name: store?.store_name || (data as any).contact_name || 'Unknown',
      phone: (data as any).phone_number || store?.phone || '',
      notes: store?.notes || (data as any).notes || null,
      do_not_call: !!store?.do_not_call,
      attempt_number: (data as any).attempt_count || 0,
    };
    setCurrentLead(lead);
    return lead;
  }, [selectedCampaign, listMode, leadList]);

  // ── Trigger call via central backend ────────────────────────────────
  const triggerCall = useCallback(async (lead: QueueLead) => {
    if (!user) return false;
    if (!selectedNumber) {
      toast.error('Missing caller-ID number');
      return false;
    }
    if (lead.do_not_call) {
      toast.warning(`${lead.business_name} is marked Do-Not-Call — skipping`);
      if (lead.queue_id) {
        await markQueueItem(lead.queue_id, 'skipped');
      }
      return false;
    }
    if (!lead.phone) {
      toast.warning(`${lead.business_name} has no phone — skipping`);
      if (lead.queue_id) {
        await markQueueItem(lead.queue_id, 'skipped');
      }
      return false;
    }

    setPhase('dialing');
    try {
      const { data, error } = await supabase.functions.invoke('va-power-dialer', {
        body: {
          vaId: user.id,
          twilioNumber: selectedNumber,
          leadId: lead.store_id || null,
          leadPhone: lead.phone,
          leadName: lead.business_name,
          action: 'dial',
        },
      });
      if (error) throw error;
      if (data?.skipped) {
        toast.info(`${lead.business_name} skipped (${data.reason})`);
        if (lead.queue_id) {
          await markQueueItem(lead.queue_id, 'skipped');
        }
        return false;
      }
      setCallLogId(data?.callLogId || null);
      // mark queue item in-flight (auto-loop only)
      if (lead.queue_id) {
        await (supabase as any).from('outbound_call_queue')
          .update({
            status: 'dialing',
            dialing_started_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            attempt_count: lead.attempt_number + 1,
          })
          .eq('id', lead.queue_id);
      }

      // ── Place the actual browser-audio call (parity with Quick Dial) ──
      // Mic permission must be requested in the user gesture chain that
      // started the campaign. Pass the user-selected caller-ID under
      // "CallerId" — Twilio overwrites the reserved "From" param.
      try {
        const placed = await voice.makeCall(lead.phone, {
          Record: 'true',
          CallerId: selectedNumber,
          callLogId: data?.callLogId || '',
        });
        setVACallMetadata({
          isVACall: true,
          leadId: lead.store_id || null,
          leadName: lead.business_name,
          twilioNumber: selectedNumber,
          callLogId: data?.callLogId || null,
          direction: 'outbound',
        });
        if (!placed && !data?.callSid) {
          // Browser SDK not ready — surface and skip
          toast.error('Browser softphone unavailable — call not placed');
          setPhase('idle');
          return false;
        }
      } catch (err: any) {
        toast.error('Failed to dial: ' + (err?.message || 'unknown'));
        setPhase('idle');
        return false;
      }

      return true;
    } catch (err: any) {
      toast.error('Network error triggering call: ' + (err.message || 'unknown'));
      setPhase('idle');
      return false;
    }
  }, [user, selectedNumber, voice, setVACallMetadata]);

  // ── Run one cycle of the loop ───────────────────────────────────────
  const runCycle = useCallback(async () => {
    if (stopFlagRef.current) return;
    const lead = await fetchNextLead();
    if (!lead) return;
    const ok = await triggerCall(lead);
    if (!ok && sessionRunning && !stopFlagRef.current) {
      // skipped — advance list pointer (if any) and immediately try the next one
      if (listMode) setLeadIndex((i) => i + 1);
      setTimeout(() => runCycle(), 600);
    }
  }, [fetchNextLead, triggerCall, sessionRunning, listMode]);

  // ── Start / stop ────────────────────────────────────────────────────
  const startDialerSession = useCallback(async () => {
    if (!user) { toast.error('Not signed in'); return; }
    if (!listMode && !selectedCampaign) { toast.error('Select a campaign first'); return; }
    if (!selectedNumber)   { toast.error('Select a Twilio number first'); return; }

    stopFlagRef.current = false;
    setLeadIndex(0);
    setSessionRunning(true);
    setActiveSessionId(`session_${Date.now()}_${user.id.slice(0, 8)}`);
    toast.success(listMode ? `Calling list of ${leadList!.length} leads` : 'Auto dialer session started');
    runCycle();
  }, [user, listMode, leadList, selectedCampaign, selectedNumber, runCycle]);

  const stopDialer = useCallback(() => {
    stopFlagRef.current = true;
    setSessionRunning(false);
    setPhase('idle');
    setCurrentLead(null);
    setCallLogId(null);
    try { voice.hangUp(); } catch (_) { /* no active call */ }
    try { endActiveCall(); } catch (_) { /* no active call */ }
    toast.info('Auto dialer stopped');
  }, [voice, endActiveCall]);

  // ── Manual transitions ──────────────────────────────────────────────
  const handleCallDrop = () => {
    try { voice.hangUp(); } catch (_) { /* no active call */ }
    try { endActiveCall(); } catch (_) { /* no active call */ }
    // Single unified wrap-up surface — open the modal directly with whatever
    // call_log row exists. The modal owns disposition + summary + AI + save.
    wrapUpInFlightRef.current = false;
    setSummaryLead(currentLead);
    setSummaryCallLogId(callLogId);
    setSummaryDuration(callStartedAt ? Math.round((Date.now() - callStartedAt) / 1000) : 0);
    setSummaryOpen(true);
    setPhase('wrap_up');
  };

  // Fired after the unified VACallWrapUpModal saves successfully (or is
  // skipped). Handles queue close, DNC stamping, and advancing the loop.
  // The modal already wrote disposition + summary + follow-up to va_call_logs.
  /**
   * Closes the account out and advances the loop. Called only once the caller
   * has confirmed the account is done (or when there is no store account to
   * work, e.g. a manual number).
   */
  const settleAccount = useCallback(async (lead: QueueLead | null, resolvedDisposition: string | null) => {
    try {
      // Close the queue item (auto-loop only)
      if (lead?.queue_id) {
        await markQueueItem(lead.queue_id, 'completed');
      }

      // Stamp DNC if disposition demands
      if (resolvedDisposition === 'DO_NOT_CALL' && lead?.store_id) {
        await (supabase as any).from('stores')
          .update({ do_not_call: true })
          .eq('id', lead.store_id);
      }
    } catch (err: any) {
      toast.error('Post-wrap-up sync failed: ' + (err.message || 'unknown'));
    } finally {
      setCallLogId(null);
      setCurrentLead(null);
      setCallStartedAt(null);
      setSummaryLead(null);
      setSummaryCallLogId(null);
      setPendingAccount(null);
      setNumbersProgress(null);

      if (listMode) setLeadIndex((i) => i + 1);
      if (sessionRunning && !stopFlagRef.current) {
        setTimeout(() => runCycle(), 300);
      } else {
        setPhase('idle');
      }
    }
  }, [markQueueItem, sessionRunning, runCycle, listMode]);

  const finishWrapUp = useCallback(async (resolvedDisposition: string | null) => {
    if (!user) return;
    // Idempotency: ignore subsequent calls until the next wrap-up begins.
    if (wrapUpInFlightRef.current) return;
    wrapUpInFlightRef.current = true;
    const lead = summaryLead;
    const logId = summaryCallLogId;

    // Fallback insert: if no call_log existed yet, persist a minimal row
    // so the disposition the VA picked is never lost.
    try {
      if (!logId && lead && resolvedDisposition) {
        await (supabase as any).from('va_call_logs').insert({
          va_id: user.id,
          lead_id: lead.store_id || null,
          twilio_number: selectedNumber || 'unknown',
          disposition: resolvedDisposition,
          call_status: 'completed',
          duration_seconds: summaryDuration,
          direction: 'outbound',
          wrap_up_completed_at: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      toast.error('Could not save the disposition: ' + (err.message || 'unknown'));
    }

    // Account completion gate: a store account stays open until the caller
    // has worked every number on it and confirmed it done.
    if (lead?.store_id) {
      setPendingAccount({ lead, disposition: resolvedDisposition });
      setCurrentLead(lead);
      setPhase('account_review');
      wrapUpInFlightRef.current = false;
      return;
    }

    await settleAccount(lead, resolvedDisposition);
  }, [user, summaryLead, summaryCallLogId, summaryDuration, selectedNumber, settleAccount]);

  /** Caller presses "Confirm account done" — only enabled when 0 numbers remain. */
  const confirmAccountDone = useCallback(async () => {
    if (!pendingAccount) return;
    setConfirmingDone(true);
    const { lead, disposition } = pendingAccount;
    try {
      if (lead.store_id) {
        await (supabase as any).from('store_master')
          .update({
            last_contacted_at: new Date().toISOString(),
          })
          .eq('id', lead.store_id);
      }
    } catch (_) { /* stamping is best-effort; never block the queue */ }
    setConfirmingDone(false);
    await settleAccount(lead, disposition);
  }, [pendingAccount, settleAccount, user]);


  const skipCurrent = async () => {
    if (!currentLead) return;
    if (currentLead.queue_id) {
      await markQueueItem(currentLead.queue_id, 'skipped');
    }
    setCallLogId(null);
    setCurrentLead(null);
    if (listMode) setLeadIndex((i) => i + 1);
    if (sessionRunning && !stopFlagRef.current) setTimeout(() => runCycle(), 300);
    else setPhase('idle');
  };

  // ── Quick-dial: place a single call to a typed-in number ────────────
  const dialManualNumber = useCallback(async () => {
    if (!user) { toast.error('Not signed in'); return; }
    if (!selectedNumber) { toast.error('Select a Caller-ID number first'); return; }
    const cleaned = manualPhone.replace(/[^\d+]/g, '');
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('Enter a valid phone number (10+ digits)'); return; }
    const e164 = cleaned.startsWith('+') ? cleaned : `+1${digits}`;

    setManualDialing(true);
    const lead: QueueLead = {
      queue_id: '',                     // no queue — manual call
      store_id: '',                     // no store — manual call
      business_name: manualName.trim() || 'Manual Dial',
      phone: e164,
      notes: null,
      do_not_call: false,
      attempt_number: 0,
    };
    setCurrentLead(lead);
    stopFlagRef.current = true;          // ensure no auto-loop
    setSessionRunning(false);
    const ok = await triggerCall(lead);
    setManualDialing(false);
    if (ok) {
      setManualPhone('');
      setManualName('');
    } else {
      setCurrentLead(null);
      setPhase('idle');
    }
  }, [user, selectedNumber, manualPhone, manualName, triggerCall]);

  // ── Cleanup on unmount ──────────────────────────────────────────────
  useEffect(() => () => { stopFlagRef.current = true; }, []);

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  if (initLoading) {
    return (
      <Card className="bg-slate-900/60 border-slate-700">
        <CardContent className="p-8 flex items-center gap-3 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dialer config…
        </CardContent>
      </Card>
    );
  }

  // ── Pre-call: Setup ─────────────────────────────────────────────────
  if (phase === 'idle' && !sessionRunning) {
    return (
      <Card className="bg-slate-900/60 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-gasmask-glow" /> VA Auto Dialer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {listMode ? (
            <div className="rounded-lg border border-gasmask/30 bg-gasmask/5 p-3">
              <div className="text-xs uppercase tracking-wide text-gasmask-glow font-semibold mb-1">
                Lead-List Campaign
              </div>
              <div className="text-sm text-white">
                {leadList!.length} lead{leadList!.length === 1 ? '' : 's'} queued from your leads table
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Same dial logic · disposition required after each call · DNC enforced server-side
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Campaign Queue</label>
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select a campaign…" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 && (
                    <SelectItem value="__none" disabled>No active campaigns</SelectItem>
                  )}
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Caller-ID Number <span className="text-slate-500">(Twilio · active)</span>
            </label>
            <Select value={selectedNumber} onValueChange={setSelectedNumber}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Select a phone number…" />
              </SelectTrigger>
              <SelectContent>
                {numbers.length === 0 && (
                  <SelectItem value="__none" disabled>No approved numbers</SelectItem>
                )}
                {numbers.map(n => (
                  <SelectItem key={n.id} value={n.phone_number}>
                    {n.phone_number}{n.business ? ` · ${n.business}` : ''}{n.friendly_name ? ` · ${n.friendly_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={startDialerSession}
            disabled={(listMode ? false : !selectedCampaign) || !selectedNumber}
            className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            <Phone className="h-4 w-4" />
            {listMode ? `Start Calling ${leadList!.length} Leads` : 'Start VA Dialer'}
          </Button>

          {/* ── Quick Dial: type any number and call ─────────────────── */}
          <div className="pt-2 border-t border-slate-700/60">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-2">
              <PhoneCall className="h-3 w-3 text-gasmask-glow" /> Quick Dial · Manual Number
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Input
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value.replace(/[^\d+\-\s()]/g, ''))}
                placeholder="+1 (555) 123-4567"
                className="bg-slate-800 border-slate-700 text-white font-mono"
                inputMode="tel"
              />
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Contact name (optional)"
                className="bg-slate-800 border-slate-700 text-white"
              />
              <Button
                onClick={dialManualNumber}
                disabled={!selectedNumber || !manualPhone || manualDialing}
                className="w-full bg-gasmask hover:bg-gasmask-glow gap-2"
              >
                {manualDialing
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Dialing…</>
                  : <><PhoneCall className="h-4 w-4" /> Dial Number</>}
              </Button>
              <p className="text-[10px] text-slate-500">
                Uses the selected Caller-ID. Logged in va_call_logs · disposition required after the call.
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="w-full text-slate-400" onClick={onEndSession}>
            Exit dialer view
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Account completion gate ─────────────────────────────────────────
  // After the disposition is saved the account stays on screen until every
  // number on it has been worked and the caller confirms it done.
  if (phase === 'account_review' && pendingAccount) {
    const open = numbersProgress?.open ?? 0;
    const total = numbersProgress?.total ?? 0;
    const ready = numbersProgress !== null && open === 0;
    return (
      <Card className="bg-slate-900/60 border-slate-700">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            Finish this account
          </CardTitle>
          <Badge className={ready
            ? 'bg-emerald-500/20 text-emerald-300 text-[10px]'
            : 'bg-amber-500/20 text-amber-300 text-[10px]'}>
            {ready ? `ALL ${total} NUMBERS WORKED` : `${open} NUMBER${open === 1 ? '' : 'S'} LEFT`}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-white font-semibold">{pendingAccount.lead.business_name}</div>
          {!ready && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
              <p className="font-semibold">Still to work on this account:</p>
              <ul className="font-mono space-y-0.5">
                {(numbersProgress?.openNumbers || []).map((n) => <li key={n}>{n}</li>)}
              </ul>
              <p className="text-amber-300/80">
                Call or mark each number below (Good / No answer / Wrong # / Dead line) before finishing.
              </p>
            </div>
          )}

          <GasMaskStoreWorkPanel
            storeId={pendingAccount.lead.store_id}
            onNumbersProgress={setNumbersProgress}
          />

          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-500"
              disabled={!ready || confirmingDone}
              onClick={confirmAccountDone}
            >
              {confirmingDone ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm account done · next account
            </Button>
            <Button
              variant="ghost"
              className="text-slate-400"
              onClick={() => settleAccount(pendingAccount.lead, pendingAccount.disposition)}
            >
              Leave open, next account
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Active call view ────────────────────────────────────────────────

  if (phase === 'fetching_lead' || phase === 'dialing' || phase === 'connected') {
    return (
      <Card className="bg-slate-900/60 border-slate-700">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${
              phase === 'connected' ? 'bg-emerald-400 animate-pulse' :
              phase === 'dialing'   ? 'bg-gasmask animate-pulse'    :
                                      'bg-amber-400 animate-pulse'
            }`} />
            {phase === 'fetching_lead' ? 'Fetching next lead…' :
             phase === 'dialing'       ? 'Dialing…'            :
                                         'Connected'}
          </CardTitle>
          <Badge className="bg-slate-700 text-slate-300 text-[10px]">
            {listMode ? `LEAD ${Math.min(leadIndex + 1, leadList!.length)} / ${leadList!.length}` : (sessionRunning ? 'AUTO-LOOP' : 'PAUSED')}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentLead ? (
            <div className="space-y-2 text-sm">
              <div className="text-white font-semibold">{currentLead.business_name}</div>
              <div className="font-mono text-gasmask-glow">{currentLead.phone}</div>
              {currentLead.notes && (
                <div className="text-xs text-slate-400 bg-slate-800/60 rounded p-2 border border-slate-700">
                  {currentLead.notes}
                </div>
              )}
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                Attempt #{currentLead.attempt_number + 1}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading lead…
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={handleCallDrop} className="bg-amber-600 hover:bg-amber-700 gap-2 flex-1">
              <PhoneOff className="h-4 w-4" /> End Call → Wrap-up
            </Button>
            <Button onClick={skipCurrent} variant="outline" className="gap-2">
              <SkipForward className="h-4 w-4" /> Skip
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setReferenceOpen(true)}
              variant="outline"
              size="sm"
              className="flex-1 gap-2 border-gasmask/40 text-gasmask-glow hover:text-gasmask"
            >
              <BookOpen className="h-4 w-4" /> Scripts · FAQs · Rebuttals · Pricing
            </Button>
          </div>

          <Button onClick={stopDialer} variant="ghost" size="sm" className="w-full text-red-400 hover:text-red-300 gap-2">
            <X className="h-4 w-4" /> Stop Dialer
          </Button>

          {/* Canonical account workspace for the store being dialed.
              Same component the Active Call surface uses — store identity,
              address, every contact/number with its verification status and
              the existing verify/dead/add actions, notes and call history.
              No second phone-verification system, no Store Profile clone. */}
          {currentLead?.store_id && (
            <div className="pt-1">
              <GasMaskStoreWorkPanel storeId={currentLead.store_id} onNumbersProgress={setNumbersProgress} />
            </div>
          )}

          {/* Live 8-Stage Brandaro Sales Script */}
          <div className="pt-2">
            <BrandaroCallScript businessName={currentLead?.business_name} />
          </div>
        </CardContent>

        {/* AI Live Coach — auto-opens while connected (parity with Active Call) */}
        <VALiveAnalysisModal
          active={phase === 'connected'}
          callLogId={callLogId}
          leadId={currentLead?.store_id || null}
          leadName={currentLead?.business_name}
          startedAt={callStartedAt ?? undefined}
        />

        {/* Reference modal */}
        <ReferenceModal open={referenceOpen} onOpenChange={setReferenceOpen} />
      </Card>
    );
  }

  // ── Wrap-up ─────────────────────────────────────────────────────────
  // Single unified surface: VACallWrapUpModal owns disposition (via status),
  // notes (via summary/next-context), AI summary, recording playback, and
  // follow-up scheduling. The thin Card behind it just shows context while
  // the modal is open so the dialer view stays grounded.
  return (
    <Card className="bg-slate-900/60 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" /> Wrap-up in progress…
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-slate-400">
          {summaryLead?.business_name || currentLead?.business_name} ·{' '}
          {summaryLead?.phone || currentLead?.phone}
          {summaryDuration ? (
            <span className="ml-2 font-mono text-slate-500">({summaryDuration}s)</span>
          ) : null}
        </div>
        <p className="text-xs text-slate-500">
          Capture the call outcome in the wrap-up modal to continue.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => setSummaryOpen(true)}
            variant="outline"
            className="gap-2 text-gasmask-glow border-gasmask/40 flex-1"
          >
            Re-open wrap-up
          </Button>
          <Button onClick={stopDialer} variant="outline" className="gap-2 text-red-400">
            <X className="h-4 w-4" /> Stop
          </Button>
        </div>
      </CardContent>

      {/* Reference modal also available during wrap-up */}
      <ReferenceModal open={referenceOpen} onOpenChange={setReferenceOpen} />

      {/* THE wrap-up surface (single source of truth). */}
      <VACallWrapUpModal
        open={summaryOpen}
        onClose={() => {
          setSummaryOpen(false);
          // Treat dismiss as "skip" — still advance the loop so the dialer
          // doesn't get stuck on a finished call.
          finishWrapUp(null);
        }}
        onSaved={(disp) => {
          setSummaryOpen(false);
          finishWrapUp(disp);
        }}
        callLogId={summaryCallLogId}
        leadName={summaryLead?.business_name || ''}
        leadId={summaryLead?.store_id || ''}
        durationSeconds={summaryDuration}
      />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference Modal — Scripts · FAQs · Rebuttals · Services & Pricing
// Single source of truth: same DB-backed components used in the Active Call.
// ─────────────────────────────────────────────────────────────────────────────
function ReferenceModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-slate-900 border-slate-700 text-white max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-gasmask-glow flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> Call Reference
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="services" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 bg-slate-800 border border-slate-700">
            <TabsTrigger value="services" className="flex-1 text-xs">Services & Pricing</TabsTrigger>
            <TabsTrigger value="faqs" className="flex-1 text-xs">FAQs</TabsTrigger>
            <TabsTrigger value="scripts" className="flex-1 text-xs">Scripts</TabsTrigger>
            <TabsTrigger value="rebuttals" className="flex-1 text-xs">Rebuttals</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-y-auto px-5 pb-5 mt-3">
            <TabsContent value="services" className="mt-0"><VAServicesPricing /></TabsContent>
            <TabsContent value="faqs" className="mt-0"><VAFAQs /></TabsContent>
            <TabsContent value="scripts" className="mt-0"><VAScripts /></TabsContent>
            <TabsContent value="rebuttals" className="mt-0"><VARebuttals /></TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
