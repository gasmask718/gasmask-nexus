/**
 * StoreContactActions — Per-contact one-tap actions for the VA/CRM contact rows.
 *
 * Reuses existing infrastructure:
 *   - Call:  useCall().initiateCall  (same path CommunicationRuntimeContext.startCall uses)
 *   - Text:  useMessage().initiateMessage → send-sms edge function
 *
 * Adds (compliance-safe):
 *   - Mark responsive by CALL   → sets only responsive_by_call + last_responded_at
 *   - Mark responsive by TEXT   → sets only responsive_by_text + last_responded_at
 *   - Opt-in (verbal on call)   → AlertDialog confirm → writes consent fields + audit note
 *   - Opt-in (text confirmed)   → AlertDialog confirm → writes consent fields + audit note
 *
 * responsiveness_status is NOT hardcoded here — it stays under whatever computed logic
 * or trigger already governs it. A contact can be text-responsive without being
 * call-responsive.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/components/communication/CallProvider';
import { useMessage } from '@/components/communication/MessageProvider';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Phone, MessageSquare, PhoneCall, MessageCircle, ShieldCheck, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ContactLike {
  id: string;
  name: string;
  phone: string | null;
  can_receive_sms: boolean | null;
  responsive_by_call?: boolean | null;
  responsive_by_text?: boolean | null;
  sms_opt_in_status?: string | null;
}

interface StoreContactActionsProps {
  contact: ContactLike;
  storeId: string;
  /** Query keys to invalidate after any write. */
  invalidateKeys?: unknown[][];
  /** Compact renders as a tight row of icon buttons. */
  compact?: boolean;
}

type OptInVariant = 'va_verbal_call' | 'va_text_confirm';

export function StoreContactActions({
  contact,
  storeId,
  invalidateKeys = [],
  compact = false,
}: StoreContactActionsProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { initiateCall } = useCall();
  const { initiateMessage } = useMessage();
  const [optInPending, setOptInPending] = useState<OptInVariant | null>(null);
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['store-contacts-responsiveness', storeId] });
    qc.invalidateQueries({ queryKey: ['store-contacts', storeId] });
    qc.invalidateQueries({ queryKey: ['store-owner', storeId] });
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };

  const handleCall = () => {
    if (!contact.phone) return toast.error('No phone number');
    initiateCall({
      destinationPhone: contact.phone,
      entityType: 'customer',
      entityId: contact.id,
      entityName: contact.name,
    });
  };

  const handleText = () => {
    if (!contact.phone) return toast.error('No phone number');
    initiateMessage({
      destinationPhone: contact.phone,
      entityType: 'customer',
      entityId: contact.id,
      storeId,
      entityName: contact.name,
      channel: 'sms',
    });
  };

  const markResponsive = async (channel: 'call' | 'text') => {
    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        last_responded_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      if (channel === 'call') patch.responsive_by_call = true;
      else patch.responsive_by_text = true;

      const { error } = await supabase
        .from('store_contacts')
        .update(patch as any)
        .eq('id', contact.id);
      if (error) throw error;

      toast.success(`${contact.name} marked responsive by ${channel}`);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setBusy(false);
    }
  };

  const confirmOptIn = async () => {
    if (!optInPending) return;
    const source = optInPending;
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('store_contacts')
        .update({
          can_receive_sms: true,
          sms_opt_in_status: 'opted_in',
          sms_opt_in_source: source,
          sms_opt_in_at: nowIso,
          verified_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        } as any)
        .eq('id', contact.id);
      if (error) throw error;

      // Audit trail — defensible consent record
      const label =
        source === 'va_verbal_call'
          ? 'Verbal opt-in captured on call'
          : 'Opt-in confirmed via text reply';
      await supabase
        .from('account_notes' as any)
        .insert({
          entity_type: 'store_contact',
          entity_id: contact.id,
          note_type: 'consent',
          note_body: `${label} for ${contact.name}${contact.phone ? ` (${contact.phone})` : ''}. Source: ${source}. Verified by ${user?.email || user?.id || 'unknown'}.`,
          created_by: user?.email || user?.id || 'system',
        } as any);

      toast.success(`${contact.name} opted in to SMS`);
      setOptInPending(null);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to record opt-in');
    } finally {
      setBusy(false);
    }
  };

  const alreadyOptedIn = contact.sms_opt_in_status === 'opted_in' || contact.can_receive_sms === true;
  const btnSize = compact ? 'icon' : 'sm';

  const rowGap = compact ? 'gap-1' : 'gap-1.5';
  const btnH = compact ? 'h-7' : 'h-8';
  const btnPad = compact ? 'px-2' : 'px-2.5';

  return (
    <>
      <div className="space-y-1.5">
        {/* Row 1 — primary communication */}
        <div className={`flex flex-wrap items-center ${rowGap}`}>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCall}
            disabled={!contact.phone}
            title="Call contact"
            className={`${btnH} ${btnPad} gap-1 text-xs`}
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Call</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleText}
            disabled={!contact.phone || contact.can_receive_sms === false}
            title={contact.can_receive_sms === false ? 'SMS off for this contact' : 'Send SMS'}
            className={`${btnH} ${btnPad} gap-1 text-xs`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Text</span>
          </Button>
        </div>

        {/* Row 2 — responsiveness flags */}
        <div className={`flex flex-wrap items-center ${rowGap}`}>
          <Button
            size="sm"
            variant={contact.responsive_by_call ? 'secondary' : 'ghost'}
            onClick={() => markResponsive('call')}
            disabled={busy}
            title="Mark responsive by call"
            className={`${btnH} ${btnPad} gap-1 text-[10px] uppercase tracking-wider`}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Resp · Call</span>
          </Button>
          <Button
            size="sm"
            variant={contact.responsive_by_text ? 'secondary' : 'ghost'}
            onClick={() => markResponsive('text')}
            disabled={busy}
            title="Mark responsive by text"
            className={`${btnH} ${btnPad} gap-1 text-[10px] uppercase tracking-wider`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>Resp · Text</span>
          </Button>
        </div>

        {/* Row 3 — opt-in (only if not already opted in) */}
        {!alreadyOptedIn && (
          <div className={`flex flex-wrap items-center ${rowGap}`}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOptInPending('va_verbal_call')}
              disabled={busy}
              title="Contact verbally agreed on a call"
              className={`${btnH} ${btnPad} gap-1 text-[10px] uppercase tracking-wider text-emerald-600 hover:text-emerald-700`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Opt-in · Verbal</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOptInPending('va_text_confirm')}
              disabled={busy}
              title="Contact confirmed opt-in via text reply"
              className={`${btnH} ${btnPad} gap-1 text-[10px] uppercase tracking-wider text-emerald-600 hover:text-emerald-700`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Opt-in · Text</span>
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={!!optInPending} onOpenChange={(o) => !o && setOptInPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm SMS opt-in</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm <span className="font-semibold text-foreground">{contact.name}</span>{' '}
              {optInPending === 'va_verbal_call'
                ? 'verbally agreed on the call'
                : 'confirmed via text reply'}{' '}
              to receive automated messages? This is recorded to the compliance audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOptIn} disabled={busy}>
              {busy ? 'Saving…' : 'Confirm opt-in'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
