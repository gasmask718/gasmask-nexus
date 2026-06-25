import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, Loader2, Send, ShieldAlert } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { TemplateSelector } from '@/components/communication/TemplateSelector';

interface CommunicationLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'store' | 'wholesaler' | 'influencer';
  entityId: string;
  entityName: string;
  /** When provided and channel=sms, enables the "Send SMS via Twilio now" composer. */
  entityPhone?: string;
  onSuccess?: () => void;
}

export function CommunicationLogModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
  entityPhone,
  onSuccess,
}: CommunicationLogModalProps) {
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [followUpDate, setFollowUpDate] = useState<Date | undefined>();
  const [sendNow, setSendNow] = useState(false);
  const [optedOut, setOptedOut] = useState<boolean>(false);
  const [optOutChecking, setOptOutChecking] = useState<boolean>(false);

  // TCPA: check opt-out status whenever the SMS channel is selected for a phone.
  useEffect(() => {
    let cancelled = false;
    const normalize = (raw: string) => {
      const digits = raw.replace(/\D/g, '');
      if (!digits) return null;
      if (raw.trim().startsWith('+')) return `+${digits}`;
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      return `+${digits}`;
    };

    const check = async () => {
      if (channel !== 'sms' || !entityPhone) {
        setOptedOut(false);
        return;
      }
      setOptOutChecking(true);
      const norm = normalize(entityPhone);
      const candidates = Array.from(new Set([entityPhone, norm].filter(Boolean))) as string[];

      const [dnc, optOut] = await Promise.all([
        supabase.from('dnc_list').select('id').in('phone_number', candidates).limit(1),
        supabase.from('opt_out_events').select('id').in('phone_number', candidates).limit(1),
      ]);

      if (cancelled) return;
      const blocked = (dnc.data?.length ?? 0) > 0 || (optOut.data?.length ?? 0) > 0;
      setOptedOut(blocked);
      if (blocked) setSendNow(false);
      setOptOutChecking(false);
    };

    check();
    return () => {
      cancelled = true;
    };
  }, [channel, entityPhone]);

  const resetForm = () => {
    setChannel('');
    setNotes('');
    setFollowUpDate(undefined);
    setSendNow(false);
    setOptedOut(false);
  };


  const handleSubmit = async () => {
    if (!channel) {
      toast.error('Please select a communication method');
      return;
    }

    if (!notes.trim()) {
      toast.error('Please add notes');
      return;
    }

    if (notes.length > 1000) {
      toast.error('Notes must be less than 1000 characters');
      return;
    }

    if (channel === 'sms' && optedOut) {
      toast.error('Cannot send SMS: recipient is opted out (TCPA compliance).');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('You must be logged in to log communications');
        return;
      }

      // ── Live SMS send path ─────────────────────────────────────────
      // When the user opts to actually fire the SMS, invoke send-sms and
      // mirror the outbound into communication_logs so CommunicationTimelineCRM
      // (which subscribes to that table) updates instantly.
      const wantsLiveSend =
        sendNow && channel === 'sms' && entityType === 'store' && !!entityPhone;

      if (wantsLiveSend) {
        const idempotency_key = `manual-${entityId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { data: smsResp, error: smsErr } = await supabase.functions.invoke('send-sms', {
          body: {
            to_number: entityPhone,
            message_body: notes.trim(),
            idempotency_key,
            store_id: entityId,
            metadata: { source: 'store_profile_composer', user_id: user.id },
          },
        });

        if (smsErr) throw smsErr;
        const resp = (smsResp as any) || {};
        const ok = resp.success !== false && resp.status !== 'blocked';
        if (!ok) {
          const reason = resp.reason || resp.error_message || resp.error || 'unknown';
          const code = resp.error_code ? ` [code ${resp.error_code}]` : '';
          toast.error(`SMS not delivered${code}: ${reason}`);
          return;
        }

        // Mirror into communication_logs so the timeline reflects it now
        const { error: logErr } = await supabase.from('communication_logs').insert({
          store_id: entityId,
          channel: 'sms',
          direction: 'outbound',
          message_content: notes.trim(),
          recipient_phone: entityPhone,
          summary: 'Manual SMS from store profile',
          created_by: user.id,
          twilio_sid: resp.provider_message_id ?? null,
          delivery_status: resp.status ?? 'sent',
        });
        if (logErr) console.warn('communication_logs mirror failed:', logErr.message);

        // Partial success (Twilio accepted but flagged an error_code, e.g. 30007/30034)
        if (resp.error_code) {
          toast.warning(`SMS ${resp.status ?? 'queued'} — Twilio code ${resp.error_code}: ${resp.error_message ?? 'see logs'}`);
        } else {
          toast.success('SMS sent');
        }
        resetForm();
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      const payload: Record<string, any> = {};
      if (followUpDate) {
        payload.follow_up_date = followUpDate.toISOString();
      }


      const { error } = await supabase
        .from('communication_events')
        .insert({
          channel,
          direction: 'outbound',
          event_type: 'manual_log',
          summary: notes.trim(),
          user_id: user.id,
          linked_entity_type: entityType,
          linked_entity_id: entityId,
          store_id: entityType === 'store' ? entityId : null,
          payload: Object.keys(payload).length > 0 ? payload : null,
        });

      if (error) throw error;

      // Mirror manual log into communication_logs so CommunicationTimelineCRM
      // (which subscribes to that table) renders it immediately without a reload.
      const mirrorRow: Record<string, any> = {
        channel,
        direction: 'outbound',
        summary: notes.trim(),
        full_message: notes.trim(),
        created_by: user.id,
      };
      if (entityType === 'store') mirrorRow.store_id = entityId;
      else if (entityType === 'wholesaler') mirrorRow.wholesaler_id = entityId;
      else if (entityType === 'influencer') mirrorRow.influencer_id = entityId;
      const { error: mirrorErr } = await supabase.from('communication_logs').insert(mirrorRow as any);
      if (mirrorErr) console.warn('communication_logs mirror (manual) failed:', mirrorErr.message);


      // Create reminder if follow-up date is provided
      if (followUpDate) {
        const reminderData: any = {
          assigned_to: user.id,
          follow_up_date: format(followUpDate, 'yyyy-MM-dd'),
          notes: `Follow-up for: ${notes.trim().substring(0, 100)}`,
        };

        if (entityType === 'store') reminderData.store_id = entityId;
        else if (entityType === 'wholesaler') reminderData.wholesaler_id = entityId;
        else if (entityType === 'influencer') reminderData.influencer_id = entityId;

        const { error: reminderError } = await supabase
          .from('reminders')
          .insert(reminderData);

        if (reminderError) console.error('Error creating reminder:', reminderError);

        // Also create follow_up_queue entry for stores
        if (entityType === 'store') {
          const actionMap: Record<string, string> = {
            'call': 'manual_call',
            'sms': 'manual_text',
            'email': 'manual_text',
            'visit': 'manual_call',
          };

          const { error: followUpQueueError } = await supabase
            .from('follow_up_queue')
            .insert({
              store_id: entityId,
              reason: notes.trim().substring(0, 100),
              recommended_action: actionMap[channel] || 'manual_call',
              priority: 50,
              due_at: followUpDate.toISOString(),
              status: 'pending',
              context: { channel, notes: notes.trim() },
            });

          if (followUpQueueError) console.error('Error creating follow-up queue entry:', followUpQueueError);
        }
      }

      toast.success('Communication logged');
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error logging communication:', error);
      toast.error('Failed to log communication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-background border-border">
        <DialogHeader>
          <DialogTitle>Log Communication - {entityName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="channel">Communication Method *</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger id="channel" className="bg-background">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border z-50">
                <SelectItem value="call">Phone Call</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="visit">In-Person Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {channel === 'sms' && optedOut && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <Badge variant="destructive" className="text-xs">TCPA Compliance</Badge>
                <p className="text-sm font-medium text-destructive">
                  Cannot send SMS: User opted out (TCPA Compliance).
                </p>
                <p className="text-xs text-muted-foreground">
                  {entityPhone} replied STOP or is on the do-not-contact list. Texting is disabled until they opt back in.
                </p>
              </div>
            </div>
          )}

          {channel === 'sms' && entityType === 'store' && !optedOut && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
              <Checkbox
                id="send-now"
                checked={sendNow}
                disabled={!entityPhone || optOutChecking}
                onCheckedChange={(v) => setSendNow(v === true)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <Label htmlFor="send-now" className="flex items-center gap-1.5 cursor-pointer">
                  <Send className="h-3.5 w-3.5" />
                  Send SMS via Twilio now
                </Label>
                <p className="text-xs text-muted-foreground">
                  {entityPhone
                    ? `Will text ${entityPhone} and post to the timeline.`
                    : 'No store phone on file — add one to enable live SMS.'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="notes">Notes *</Label>
              <TemplateSelector onSelect={(template) => setNotes(template)} />
            </div>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                channel === 'sms' && optedOut
                  ? 'SMS disabled — recipient opted out.'
                  : 'Enter communication details...'
              }
              disabled={channel === 'sms' && optedOut}
              className="min-h-[120px] resize-none bg-background"
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/1000 characters
            </p>
          </div>


          <div className="space-y-2">
            <Label>Follow-up Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal bg-background',
                    !followUpDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {followUpDate ? format(followUpDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border-border z-50" align="start">
                <Calendar
                  mode="single"
                  selected={followUpDate}
                  onSelect={setFollowUpDate}
                  disabled={(date) => date < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || (channel === 'sms' && optedOut && sendNow)}
            className="bg-primary hover:bg-primary-hover"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {sendNow ? 'Sending...' : 'Logging...'}
              </>
            ) : (
              sendNow ? 'Send SMS' : 'Log Communication'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
