/**
 * UnifiedCallActions — Reusable calling surface for the Dynasty Connect
 * Unified Calling Engine. Supports three modes: 'manual', 'va_auto_dialer',
 * and 'bland_ai'. This file implements the va_auto_dialer mode end-to-end.
 *
 * Architecture: ALL call execution routes through the central engine
 * (supabase edge function `va-power-dialer`) plus the browser SDK
 * (VoiceDeviceProvider) for audio. No direct Twilio REST calls from here.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceDevice } from '@/contexts/VoiceDeviceProvider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Phone, PhoneOff, PhoneCall, Loader2, AlertTriangle, ArrowRight,
  Megaphone, Hash, ListChecks, Ban,
} from 'lucide-react';

type Mode = 'manual' | 'va_auto_dialer' | 'bland_ai';
type CallStatus = 'idle' | 'dialing' | 'connected' | 'wrap-up';

const RESTRICTED_STATUSES = new Set([
  'do-not-call', 'do_not_call', 'dnc',
  'wrong-number', 'wrong_number',
  'opted-out', 'opt-out', 'opted_out',
]);

const DISPOSITIONS: Array<{ code: string; label: string; followUp?: boolean }> = [
  { code: 'connected_interested', label: 'Connected — Interested', followUp: true },
  { code: 'connected_not_interested', label: 'Connected — Not Interested' },
  { code: 'callback', label: 'Callback Scheduled', followUp: true },
  { code: 'voicemail', label: 'Voicemail Left' },
  { code: 'no_answer', label: 'No Answer' },
  { code: 'wrong_number', label: 'Wrong Number' },
  { code: 'do_not_call', label: 'Do Not Call' },
  { code: 'closed', label: 'Closed / Won' },
];

interface UnifiedCallActionsProps {
  mode?: Mode;
  /** Business unit / hub slug (e.g. "brandaro"). Falls back to "general". */
  businessUnit?: string | null;
  onLeadComplete?: (leadId: string, disposition: string) => void;
  /** For manual mode: pre-populate the target lead. */
  targetLead?: {
    id?: string;
    business_name?: string | null;
    contact_name?: string | null;
    phone_number: string;
    status?: string | null;
  } | null;
}

interface QueueLead {
  id: string;
  business_name: string | null;
  contact_name: string | null;
  phone_number: string;
  state: string | null;
  status: string;
  source_table: string | null;
  source_lead_id: string | null;
}

export function UnifiedCallActions({
  mode: initialMode = 'va_auto_dialer',
  businessUnit,
  onLeadComplete,
  targetLead,
}: UnifiedCallActionsProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { makeCall, hangUp, callStatus: deviceCallStatus, activeCall } = useVoiceDevice();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [currentLead, setCurrentLead] = useState<QueueLead | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeCallLogId, setActiveCallLogId] = useState<string | null>(null);
  const [disposition, setDisposition] = useState<string>('');
  const [followUpNotes, setFollowUpNotes] = useState<string>('');
  const [followUpAt, setFollowUpAt] = useState<string>('');
  const [lastDialAt, setLastDialAt] = useState<number>(0);

  // Manual mode: free-form target
  const [manualPhone, setManualPhone] = useState<string>(targetLead?.phone_number || '');
  const [manualName, setManualName] = useState<string>(
    targetLead?.business_name || targetLead?.contact_name || ''
  );
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (callStatus !== 'connected') return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [callStatus]);

  useEffect(() => {
    if (targetLead?.phone_number) setManualPhone(targetLead.phone_number);
    if (targetLead?.business_name || targetLead?.contact_name) {
      setManualName(targetLead.business_name || targetLead.contact_name || '');
    }
  }, [targetLead]);


  // ─── Sync UI status with browser device ───
  useEffect(() => {
    if (callStatus === 'dialing' && deviceCallStatus === 'in-progress') {
      setCallStatus('connected');
    }
    if (callStatus === 'connected' && (deviceCallStatus === 'closed' || deviceCallStatus === 'idle')) {
      setCallStatus('wrap-up');
    }
  }, [deviceCallStatus, callStatus]);

  // ─── Fetch campaigns scoped to the VA's hub ───
  const { data: campaigns = [] } = useQuery({
    queryKey: ['unified-campaigns', businessUnit],
    queryFn: async () => {
      let q = supabase
        .from('dynasty_call_campaigns' as any)
        .select('id, campaign_name, business_unit, status, leads_remaining, total_leads')
        .in('status', ['active', 'pending', 'running']);
      if (businessUnit) q = q.in('business_unit', [businessUnit, 'general']);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // ─── Fetch approved phone numbers (active + twilio + va_auto_dialer + matching hub) ───
  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['unified-phone-numbers', businessUnit, mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brandaro_phone_numbers' as any)
        .select('*')
        .eq('is_active', true)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return ((data as any[]) || []).filter((n) => {
        const brandOk = !businessUnit
          || !n.brand
          || n.brand === businessUnit
          || String(n.brand).toLowerCase() === 'general';
        // Approximate "allowed_modes" via purpose field until column exists
        const purposeOk = !n.purpose
          || (mode === 'manual'
            ? ['manual_call', 'manual', 'outbound', 'general'].includes(String(n.purpose).toLowerCase())
            : ['va_auto_dialer', 'outbound', 'dialer', 'general'].includes(String(n.purpose).toLowerCase()));
        return brandOk && purposeOk;
      });
    },
  });

  // Auto-select default number
  useEffect(() => {
    if (!selectedPhoneNumber && phoneNumbers.length > 0) {
      const def = phoneNumbers.find((n: any) => n.is_default) || phoneNumbers[0];
      setSelectedPhoneNumber(def.phone_number);
    }
  }, [phoneNumbers, selectedPhoneNumber]);

  // ─── Pull next lead from queue ───
  const fetchNextLead = useCallback(async (campaignId: string): Promise<QueueLead | null> => {
    // Pull oldest pending lead — campaign association via assignment_notes/source for now.
    const { data, error } = await (supabase as any)
      .from('dynasty_call_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('queue fetch error', error);
      return null;
    }
    return (data as QueueLead) || null;
  }, []);

  // ─── Start dialer session ───
  const startSession = useMutation({
    mutationFn: async () => {
      if (!selectedCampaign) throw new Error('Missing Campaign');
      if (!selectedPhoneNumber) throw new Error('Missing Number');
      if (!user) throw new Error('Not signed in');

      // Create session record (best-effort; falls back gracefully)
      const { data: sess } = await (supabase as any)
        .from('brandaro_va_call_sessions')
        .insert({
          va_user_id: user.id,
          twilio_number: selectedPhoneNumber,
        })
        .select('id')
        .maybeSingle();
      const sessionId = sess?.id || crypto.randomUUID();
      setActiveSessionId(sessionId);

      const next = await fetchNextLead(selectedCampaign);
      if (!next) throw new Error('Empty Queue');
      return next;
    },
    onSuccess: async (lead) => {
      setCurrentLead(lead);
      await dialLead(lead);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to start dialer');
    },
  });

  // ─── Dial action (routes through central engine) ───
  const dialLead = useCallback(async (lead: QueueLead) => {
    if (!user) return;

    // Compliance guardrails
    if (RESTRICTED_STATUSES.has(String(lead.status).toLowerCase())) {
      toast.error('Restricted Lead — skipping');
      await advanceQueue(lead.id, 'skipped_restricted');
      const next = await fetchNextLead(selectedCampaign);
      if (next) { setCurrentLead(next); return dialLead(next); }
      setCallStatus('idle'); setCurrentLead(null);
      toast.message('Queue complete');
      return;
    }

    // Rapid-dial guard
    const now = Date.now();
    if (now - lastDialAt < 2000) {
      toast.warning('Please wait — duplicate dial blocked');
      return;
    }
    setLastDialAt(now);

    setCallStatus('dialing');

    // Hit central engine to log + DNC check
    const { data, error } = await supabase.functions.invoke('va-power-dialer', {
      body: {
        vaId: user.id,
        action: 'dial',
        twilioNumber: selectedPhoneNumber,
        leadId: lead.source_lead_id || lead.id,
        leadPhone: lead.phone_number,
        leadName: lead.business_name || lead.contact_name,
      },
    });

    if (error) {
      toast.error(`Dial failed: ${error.message}`);
      setCallStatus('wrap-up');
      return;
    }

    if ((data as any)?.skipped) {
      toast.warning('Lead on DNC list — skipped');
      await advanceQueue(lead.id, 'dnc_skipped');
      const next = await fetchNextLead(selectedCampaign);
      if (next) { setCurrentLead(next); return dialLead(next); }
      setCallStatus('idle'); setCurrentLead(null);
      return;
    }

    setActiveCallLogId((data as any)?.callLogId || null);

    // Browser-side dial via central voice provider
    try {
      await makeCall(lead.phone_number, {
        From: selectedPhoneNumber,
        callLogId: (data as any)?.callLogId || '',
      });
    } catch (e: any) {
      toast.error(`Browser call failed: ${e?.message || e}`);
      setCallStatus('wrap-up');
    }
  }, [user, selectedPhoneNumber, selectedCampaign, makeCall, lastDialAt, fetchNextLead]);

  // ─── Update queue row ───
  const advanceQueue = async (queueId: string, status: string) => {
    await (supabase as any)
      .from('dynasty_call_queue')
      .update({ status, completed_at: new Date().toISOString() })
      .eq('id', queueId);
  };

  // ─── Save disposition + next lead ───
  const saveAndNext = useMutation({
    mutationFn: async () => {
      if (!disposition) throw new Error('Select a disposition');
      if (!currentLead || !user) throw new Error('No active lead');

      // Write disposition row
      await (supabase as any).from('call_dispositions').insert({
        call_log_id: activeCallLogId,
        business_name: currentLead.business_name,
        disposition_code: disposition,
        follow_up_required: !!followUpAt || disposition === 'callback',
        follow_up_scheduled_at: followUpAt || null,
        notes: followUpNotes || null,
        created_by: user.id,
      });

      // Update central call log via engine
      if (activeCallLogId) {
        await supabase.functions.invoke('va-power-dialer', {
          body: {
            vaId: user.id,
            action: 'disposition',
            callLogId: activeCallLogId,
            leadId: currentLead.source_lead_id || currentLead.id,
            disposition,
            notes: followUpNotes || undefined,
            callbackAt: followUpAt || undefined,
          },
        });
      }

      // Mark queue row complete
      await advanceQueue(currentLead.id, 'completed');

      onLeadComplete?.(currentLead.id, disposition);

      // Pull next
      return await fetchNextLead(selectedCampaign);
    },
    onSuccess: async (next) => {
      setDisposition('');
      setFollowUpNotes('');
      setFollowUpAt('');
      setActiveCallLogId(null);
      qc.invalidateQueries({ queryKey: ['unified-campaigns'] });

      if (next) {
        setCurrentLead(next);
        await dialLead(next);
      } else {
        toast.success('Queue complete!');
        setCurrentLead(null);
        setCallStatus('idle');
      }
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save'),
  });

  const endSession = useCallback(() => {
    if (activeCall) hangUp();
    setCallStatus('idle');
    setCurrentLead(null);
    setActiveSessionId(null);
    setActiveCallLogId(null);
    setDisposition('');
    setFollowUpNotes('');
    setFollowUpAt('');
  }, [activeCall, hangUp]);

  // ─── Manual Call: ad-hoc, single lead, no queue ───
  const startManualCall = useCallback(async () => {
    if (!user) { toast.error('Not signed in'); return; }
    if (!selectedPhoneNumber) { toast.error('No approved numbers found for this hub'); return; }
    const phone = (manualPhone || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      toast.error('Enter a valid phone number');
      return;
    }
    const status = String(targetLead?.status || '').toLowerCase();
    if (RESTRICTED_STATUSES.has(status)) {
      toast.error('Lead is marked Do-Not-Call / opted out');
      return;
    }
    const now = Date.now();
    if (now - lastDialAt < 2000) {
      toast.warning('Please wait — duplicate dial blocked');
      return;
    }
    setLastDialAt(now);

    const lead: QueueLead = {
      id: targetLead?.id || crypto.randomUUID(),
      business_name: manualName || targetLead?.business_name || null,
      contact_name: targetLead?.contact_name || null,
      phone_number: phone,
      state: null,
      status: targetLead?.status || 'manual',
      source_table: 'manual',
      source_lead_id: targetLead?.id || null,
    };
    setCurrentLead(lead);
    setCallStatus('dialing');

    const { data, error } = await supabase.functions.invoke('va-power-dialer', {
      body: {
        vaId: user.id,
        action: 'dial',
        twilioNumber: selectedPhoneNumber,
        leadId: lead.source_lead_id || lead.id,
        leadPhone: lead.phone_number,
        leadName: lead.business_name || lead.contact_name,
        mode: 'manual_call',
      },
    });
    if (error) {
      toast.error(`Network execution failed: ${error.message}`);
      setCallStatus('wrap-up');
      return;
    }
    if ((data as any)?.skipped) {
      toast.error('Lead is on DNC list');
      setCallStatus('wrap-up');
      return;
    }
    setActiveCallLogId((data as any)?.callLogId || null);
    setCallStartedAt(Date.now());
    try {
      await makeCall(lead.phone_number, {
        From: selectedPhoneNumber,
        callLogId: (data as any)?.callLogId || '',
      });
    } catch (e: any) {
      toast.error(`Browser call failed: ${e?.message || e}`);
      setCallStatus('wrap-up');
    }
  }, [user, selectedPhoneNumber, manualPhone, manualName, targetLead, lastDialAt, makeCall]);

  const saveManualDisposition = useMutation({
    mutationFn: async () => {
      if (!disposition) throw new Error('Select a disposition');
      if (!currentLead || !user) throw new Error('No active lead');
      await (supabase as any).from('call_dispositions').insert({
        call_log_id: activeCallLogId,
        business_name: currentLead.business_name,
        disposition_code: disposition,
        follow_up_required: !!followUpAt || disposition === 'callback',
        follow_up_scheduled_at: followUpAt || null,
        notes: followUpNotes || null,
        created_by: user.id,
      });
      if (activeCallLogId) {
        await supabase.functions.invoke('va-power-dialer', {
          body: {
            vaId: user.id,
            action: 'disposition',
            callLogId: activeCallLogId,
            leadId: currentLead.source_lead_id || currentLead.id,
            disposition,
            notes: followUpNotes || undefined,
            callbackAt: followUpAt || undefined,
          },
        });
      }
      onLeadComplete?.(currentLead.id, disposition);
    },
    onSuccess: () => {
      toast.success('Call logged');
      setDisposition(''); setFollowUpNotes(''); setFollowUpAt('');
      setActiveCallLogId(null); setCurrentLead(null);
      setCallStartedAt(null); setCallStatus('idle');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save'),
  });

  const callElapsed = useMemo(() => {
    if (!callStartedAt) return '00:00';
    const s = Math.floor((Date.now() - callStartedAt) / 1000);
    void tick;
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, [callStartedAt, tick]);

  const isLeadRestricted = RESTRICTED_STATUSES.has(String(targetLead?.status || '').toLowerCase());

  // ─── Renders ───
  const headerBadge = useMemo(() => {
    const map: Record<CallStatus, string> = {
      idle: 'bg-slate-700 text-slate-300',
      dialing: 'bg-amber-500/20 text-amber-300',
      connected: 'bg-emerald-500/20 text-emerald-300',
      'wrap-up': 'bg-cyan-500/20 text-cyan-300',
    };
    return map[callStatus];
  }, [callStatus]);

  return (
    <Card className="bg-slate-900 border-slate-700 text-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-cyan-400" />
          Unified Call Actions
        </h2>
        <div className="flex items-center gap-2">
          {callStatus === 'idle' && (
            <div className="flex rounded-md border border-slate-700 overflow-hidden text-[10px]">
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`px-2 py-1 uppercase ${mode === 'manual' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >Manual</button>
              <button
                type="button"
                onClick={() => setMode('va_auto_dialer')}
                className={`px-2 py-1 uppercase ${mode === 'va_auto_dialer' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
              >Auto</button>
            </div>
          )}
          <Badge className={`${headerBadge} uppercase text-[10px]`}>{callStatus}</Badge>
        </div>
      </div>

      {callStatus === 'idle' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <Megaphone className="h-3 w-3" /> Campaign
            </label>
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Select campaign…" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No active campaigns for this hub
                  </div>
                )}
                {campaigns.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.campaign_name}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({c.leads_remaining ?? '—'} left)
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <Hash className="h-3 w-3" /> Caller ID (Twilio)
            </label>
            <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue placeholder="Select number…" />
              </SelectTrigger>
              <SelectContent>
                {phoneNumbers.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    No approved numbers for this hub
                  </div>
                )}
                {phoneNumbers.map((n: any) => (
                  <SelectItem key={n.id} value={n.phone_number}>
                    <span className="font-mono">{n.phone_number}</span>
                    <span className="text-xs text-muted-foreground ml-2">{n.friendly_name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              if (!selectedCampaign) { toast.error('Missing Campaign'); return; }
              if (!selectedPhoneNumber) { toast.error('Missing Number'); return; }
              startSession.mutate();
            }}
            disabled={startSession.isPending}
            className="w-full bg-cyan-600 hover:bg-cyan-700 gap-2"
          >
            {startSession.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Phone className="h-4 w-4" />}
            Start VA Dialer
          </Button>
        </div>
      )}

      {(callStatus === 'dialing' || callStatus === 'connected') && currentLead && (
        <div className="space-y-3">
          <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700">
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Now Calling</div>
            <div className="text-xl font-bold">
              {currentLead.business_name || currentLead.contact_name || 'Lead'}
            </div>
            <div className="font-mono text-cyan-300 text-sm">{currentLead.phone_number}</div>
            {currentLead.state && (
              <div className="text-xs text-slate-500 mt-1">State: {currentLead.state}</div>
            )}
          </div>

          <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/50 text-sm text-slate-300">
            <div className="text-xs text-slate-500 mb-1 uppercase">Script Preview</div>
            Hi {currentLead.contact_name || 'there'}, this is your VA calling on behalf of the
            team about {currentLead.business_name || 'your business'}…
          </div>

          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => { hangUp(); setCallStatus('wrap-up'); }}
              className="flex-1 gap-2"
            >
              <PhoneOff className="h-4 w-4" /> End Call
            </Button>
            <Button
              variant="outline"
              onClick={endSession}
              className="border-slate-700 text-slate-300"
            >
              Stop Dialer
            </Button>
          </div>
        </div>
      )}

      {callStatus === 'wrap-up' && currentLead && (
        <div className="space-y-3">
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400">Wrapping up</div>
            <div className="font-bold">{currentLead.business_name || currentLead.contact_name}</div>
          </div>

          <div>
            <label className="text-xs text-slate-400 flex items-center gap-1 mb-1">
              <ListChecks className="h-3 w-3" /> Disposition
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DISPOSITIONS.map((d) => (
                <Button
                  key={d.code}
                  variant={disposition === d.code ? 'default' : 'outline'}
                  onClick={() => setDisposition(d.code)}
                  className={
                    disposition === d.code
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-xs h-auto py-2'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800 text-xs h-auto py-2'
                  }
                >
                  {d.code === 'do_not_call' && <Ban className="h-3 w-3 mr-1" />}
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Follow-Up Task / Notes</label>
            <Textarea
              value={followUpNotes}
              onChange={(e) => setFollowUpNotes(e.target.value)}
              placeholder="Notes or follow-up task description…"
              className="bg-slate-800 border-slate-700 min-h-[60px]"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Follow-Up Date (optional)</label>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm text-white"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => saveAndNext.mutate()}
              disabled={!disposition || saveAndNext.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {saveAndNext.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <ArrowRight className="h-4 w-4" />}
              Save & Next
            </Button>
            <Button
              variant="outline"
              onClick={endSession}
              className="border-slate-700 text-slate-300"
            >
              End Session
            </Button>
          </div>
        </div>
      )}

      {callStatus === 'idle' && phoneNumbers.length === 0 && campaigns.length === 0 && (
        <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 p-2 rounded">
          <AlertTriangle className="h-3 w-3" />
          No campaigns or phone numbers configured for this hub yet.
        </div>
      )}
    </Card>
  );
}

export default UnifiedCallActions;
