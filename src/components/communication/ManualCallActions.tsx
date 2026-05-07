/**
 * ManualCallActions — Standalone, ad-hoc dialer surface.
 *
 * Separated from UnifiedCallActions (which is now auto-dialer only).
 * Routes ALL execution through the central engine (`va-power-dialer`)
 * and persists outcomes to `call_dispositions` + the unified call log.
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
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
  Phone, PhoneOff, PhoneCall, Loader2, Hash, ListChecks, Ban, Save,
} from 'lucide-react';

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

interface ManualCallActionsProps {
  businessUnit?: string | null;
  /** Optional pre-populated lead */
  targetLead?: {
    id?: string;
    business_name?: string | null;
    contact_name?: string | null;
    phone_number: string;
    status?: string | null;
  } | null;
  onLogged?: (leadId: string, disposition: string) => void;
}

export function ManualCallActions({
  businessUnit,
  targetLead,
  onLogged,
}: ManualCallActionsProps) {
  const { user } = useAuth();
  const { makeCall, hangUp, callStatus: deviceCallStatus } = useVoiceDevice();

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>('');
  const [manualPhone, setManualPhone] = useState(targetLead?.phone_number || '');
  const [manualName, setManualName] = useState(
    targetLead?.business_name || targetLead?.contact_name || ''
  );
  const [createTask, setCreateTask] = useState(false);
  const [activeCallLogId, setActiveCallLogId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<{
    id: string; name: string; phone: string; status?: string | null;
  } | null>(null);
  const [disposition, setDisposition] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [lastDialAt, setLastDialAt] = useState(0);

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

  // Sync UI status with browser device
  useEffect(() => {
    if (callStatus === 'dialing' && deviceCallStatus === 'in-progress') {
      setCallStatus('connected');
    }
    if (callStatus === 'connected' && (deviceCallStatus === 'closed' || deviceCallStatus === 'idle')) {
      setCallStatus('wrap-up');
    }
  }, [deviceCallStatus, callStatus]);

  // Approved phone numbers for this hub, manual mode
  const { data: phoneNumbers = [] } = useQuery({
    queryKey: ['manual-call-numbers', businessUnit],
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
        const purposeOk = !n.purpose
          || ['manual_call', 'manual', 'outbound', 'general'].includes(String(n.purpose).toLowerCase());
        return brandOk && purposeOk;
      });
    },
  });

  useEffect(() => {
    if (!selectedPhoneNumber && phoneNumbers.length > 0) {
      const def = phoneNumbers.find((n: any) => n.is_default) || phoneNumbers[0];
      setSelectedPhoneNumber(def.phone_number);
    }
  }, [phoneNumbers, selectedPhoneNumber]);

  const isLeadRestricted = RESTRICTED_STATUSES.has(
    String(targetLead?.status || '').toLowerCase()
  );

  const startCall = useCallback(async () => {
    if (!user) { toast.error('Not signed in'); return; }
    if (!selectedPhoneNumber) { toast.error('No approved numbers found for this hub'); return; }
    const phone = (manualPhone || '').trim();
    if (!phone || phone.replace(/\D/g, '').length < 7) {
      toast.error('Enter a valid phone number');
      return;
    }
    if (isLeadRestricted) {
      toast.error('Lead is marked Do-Not-Call / opted out');
      return;
    }
    const now = Date.now();
    if (now - lastDialAt < 2000) {
      toast.warning('Please wait — duplicate dial blocked');
      return;
    }
    setLastDialAt(now);

    const lead = {
      id: targetLead?.id || crypto.randomUUID(),
      name: manualName || targetLead?.business_name || targetLead?.contact_name || 'Manual Lead',
      phone,
      status: targetLead?.status || 'manual',
    };
    setActiveLead(lead);
    setCallStatus('dialing');

    const { data, error } = await supabase.functions.invoke('va-power-dialer', {
      body: {
        vaId: user.id,
        action: 'dial',
        twilioNumber: selectedPhoneNumber,
        leadId: targetLead?.id || lead.id,
        leadPhone: lead.phone,
        leadName: lead.name,
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
      await makeCall(lead.phone, {
        From: selectedPhoneNumber,
        callLogId: (data as any)?.callLogId || '',
      });
    } catch (e: any) {
      toast.error(`Browser call failed: ${e?.message || e}`);
      setCallStatus('wrap-up');
    }
  }, [user, selectedPhoneNumber, manualPhone, manualName, targetLead, lastDialAt, makeCall, isLeadRestricted]);

  const saveLog = useMutation({
    mutationFn: async () => {
      if (!disposition) throw new Error('Select a disposition');
      if (!activeLead || !user) throw new Error('No active lead');

      // 1) Disposition row
      await (supabase as any).from('call_dispositions').insert({
        call_log_id: activeCallLogId,
        business_name: activeLead.name,
        disposition_code: disposition,
        follow_up_required: createTask || !!followUpAt || disposition === 'callback',
        follow_up_scheduled_at: followUpAt || null,
        notes: notes || null,
        created_by: user.id,
      });

      // 2) Notify central engine (updates unified_call_logs)
      if (activeCallLogId) {
        await supabase.functions.invoke('va-power-dialer', {
          body: {
            vaId: user.id,
            action: 'disposition',
            callLogId: activeCallLogId,
            leadId: targetLead?.id || activeLead.id,
            disposition,
            notes: notes || undefined,
            callbackAt: followUpAt || undefined,
            mode: 'manual_call',
          },
        });
      }

      onLogged?.(activeLead.id, disposition);
    },
    onSuccess: () => {
      toast.success('Call logged');
      setDisposition(''); setNotes(''); setFollowUpAt('');
      setActiveCallLogId(null); setActiveLead(null);
      setCallStartedAt(null); setCallStatus('idle');
      setCreateTask(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save'),
  });

  const cancel = useCallback(() => {
    hangUp();
    setCallStatus('idle');
    setActiveLead(null);
    setActiveCallLogId(null);
    setDisposition(''); setNotes(''); setFollowUpAt('');
    setCallStartedAt(null);
  }, [hangUp]);

  const callElapsed = useMemo(() => {
    if (!callStartedAt) return '00:00';
    const s = Math.floor((Date.now() - callStartedAt) / 1000);
    void tick;
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, [callStartedAt, tick]);

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
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-cyan-400" />
          Manual Call
        </h2>
        <Badge className={`${headerBadge} uppercase text-[10px]`}>{callStatus}</Badge>
      </div>

      {callStatus === 'idle' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Lead Name / Business</label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="e.g. Acme Corp"
              disabled={!!targetLead?.business_name || !!targetLead?.contact_name}
              className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm text-white disabled:opacity-70"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Phone Number</label>
            <input
              type="tel"
              value={manualPhone}
              onChange={(e) => setManualPhone(e.target.value)}
              placeholder="+15551234567"
              disabled={!!targetLead?.phone_number}
              className="w-full h-9 rounded-md bg-slate-800 border border-slate-700 px-3 text-sm text-white font-mono disabled:opacity-70"
            />
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
                    No approved numbers found for this hub
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

          {isLeadRestricted && (
            <div className="flex items-center gap-2 text-rose-400 text-xs bg-rose-500/10 p-2 rounded">
              <Ban className="h-3 w-3" />
              Lead is marked {targetLead?.status} — calling is blocked.
            </div>
          )}

          <Button
            onClick={startCall}
            disabled={isLeadRestricted || !manualPhone || !selectedPhoneNumber}
            className="w-full bg-cyan-600 hover:bg-cyan-700 gap-2"
          >
            <Phone className="h-4 w-4" /> Call Now
          </Button>
        </div>
      )}

      {(callStatus === 'dialing' || callStatus === 'connected') && activeLead && (
        <div className="space-y-3">
          <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-700 flex items-start justify-between">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                {callStatus === 'dialing' ? 'Dialing…' : 'Connected'}
              </div>
              <div className="text-xl font-bold">{activeLead.name}</div>
              <div className="font-mono text-cyan-300 text-sm">{activeLead.phone}</div>
            </div>
            <div className="text-right">
              <div className={`inline-flex h-2 w-2 rounded-full mr-2 ${callStatus === 'dialing' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="font-mono text-sm text-slate-300">{callElapsed}</span>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => { hangUp(); setCallStatus('wrap-up'); }}
            className="w-full gap-2"
          >
            <PhoneOff className="h-4 w-4" /> Hang Up
          </Button>
        </div>
      )}

      {callStatus === 'wrap-up' && activeLead && (
        <div className="space-y-3">
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
            <div className="text-xs text-slate-400">Wrapping up</div>
            <div className="font-bold">{activeLead.name}</div>
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
            <label className="text-xs text-slate-400 mb-1 block">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call notes, recap, next steps…"
              className="bg-slate-800 border-slate-700 min-h-[60px]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 bg-slate-800/40 rounded-md p-2 border border-slate-700/50">
            <label className="text-xs text-slate-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={createTask}
                onChange={(e) => setCreateTask(e.target.checked)}
                className="accent-cyan-600"
              />
              Create Follow-up Task
            </label>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(e) => setFollowUpAt(e.target.value)}
              className="h-8 rounded-md bg-slate-800 border border-slate-700 px-2 text-xs text-white"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => saveLog.mutate()}
              disabled={!disposition || saveLog.isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-2"
            >
              {saveLog.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              Save Log
            </Button>
            <Button
              variant="outline"
              onClick={cancel}
              className="border-slate-700 text-slate-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default ManualCallActions;
