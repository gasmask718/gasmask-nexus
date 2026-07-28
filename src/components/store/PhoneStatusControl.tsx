/**
 * PhoneStatusControl — status control shown NEXT TO the phone number on a contact.
 *
 * Source of truth: store_contacts.responsiveness_status (no store_master mirror).
 *
 * wrong_number / not_active render the number red + struck through, and offer an
 * inline "Replace number" affordance. Those two statuses are excluded from every
 * retry / follow-up / auto-outreach queue (see src/lib/phoneStatus.ts::isContactable).
 *
 * Save failures surface the REAL Supabase error text.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2, PhoneOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  PHONE_STATUSES,
  PHONE_STATUS_META,
  isBadNumber,
  normalizePhoneStatus,
  type PhoneStatus,
} from '@/lib/phoneStatus';

interface Props {
  contactId: string;
  phone?: string | null;
  status?: string | null;
  storeId: string;
  compact?: boolean;
  invalidateKeys?: unknown[][];
}

export function PhoneStatusControl({
  contactId,
  phone,
  status,
  storeId,
  compact = false,
  invalidateKeys = [],
}: Props) {
  const qc = useQueryClient();
  const current = normalizePhoneStatus(status);
  const bad = isBadNumber(current);
  const [saving, setSaving] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [newPhone, setNewPhone] = useState('');

  const invalidate = () => {
    [
      ['store-contacts', storeId],
      ['store-contacts-responsiveness', storeId],
      ['store-card-relationship-markers'],
      ['contact', contactId],
      ...invalidateKeys,
    ].forEach((key) => qc.invalidateQueries({ queryKey: key as any }));
  };

  const save = async (patch: Record<string, unknown>, successMsg: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('store_contacts')
        .update(patch as any)
        .eq('id', contactId);
      if (error) {
        // Surface the REAL error — never swallow it.
        toast.error(`Save failed: ${error.message}${error.details ? ` — ${error.details}` : ''}`);
        return false;
      }
      toast.success(successMsg);
      invalidate();
      return true;
    } finally {
      setSaving(false);
    }
  };

  const onStatusChange = async (next: PhoneStatus) => {
    await save(
      {
        responsiveness_status: next,
        responsiveness_updated_at: new Date().toISOString(),
      },
      `Phone marked "${PHONE_STATUS_META[next].label}"`
    );
  };

  const submitReplacement = async () => {
    const val = newPhone.trim();
    if (!val) return;
    const ok = await save(
      {
        phone: val,
        responsiveness_status: 'unknown',
        responsiveness_updated_at: new Date().toISOString(),
        number_verification_status: 'unverified',
        total_calls_attempted: 0,
        total_calls_answered: 0,
        total_texts_sent: 0,
        total_texts_received: 0,
      },
      'Number replaced — status reset to unknown'
    );
    if (ok) {
      setReplacing(false);
      setNewPhone('');
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? 'text-[10px]' : 'text-sm'}`}>
      {phone && (
        <span
          className={
            bad
              ? 'line-through text-red-600 font-medium'
              : compact
                ? 'text-muted-foreground'
                : 'text-muted-foreground'
          }
        >
          {phone}
        </span>
      )}

      {bad && (
        <span className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
          {current === 'not_active' ? (
            <PhoneOff className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {PHONE_STATUS_META[current].short} · needs new number
        </span>
      )}

      <Select value={current} onValueChange={(v) => onStatusChange(v as PhoneStatus)} disabled={saving}>
        <SelectTrigger
          className={`${compact ? 'h-6 text-[10px] w-[140px]' : 'h-7 text-xs w-[170px]'} ${
            bad ? 'border-red-500/40 text-red-600' : ''
          }`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {PHONE_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs">
              {PHONE_STATUS_META[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}

      {bad && !replacing && (
        <Button
          size="sm"
          variant="outline"
          className={compact ? 'h-6 px-2 text-[10px]' : 'h-7 px-2 text-xs'}
          onClick={() => setReplacing(true)}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Replace number
        </Button>
      )}

      {replacing && (
        <span className="flex items-center gap-1">
          <Input
            autoFocus
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="New number"
            className={compact ? 'h-6 w-32 text-[10px]' : 'h-7 w-40 text-xs'}
            onKeyDown={(e) => e.key === 'Enter' && submitReplacement()}
          />
          <Button
            size="sm"
            className={compact ? 'h-6 px-2 text-[10px]' : 'h-7 px-2 text-xs'}
            onClick={submitReplacement}
            disabled={saving || !newPhone.trim()}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className={compact ? 'h-6 px-2 text-[10px]' : 'h-7 px-2 text-xs'}
            onClick={() => {
              setReplacing(false);
              setNewPhone('');
            }}
          >
            Cancel
          </Button>
        </span>
      )}
    </div>
  );
}
