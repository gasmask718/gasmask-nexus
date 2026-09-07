/**
 * VerificationStamp — "Confirmed · Verified by <user> · <exact date/time>".
 *
 * Reads the canonical contact record only:
 *   public.v_store_contact_verification  (store_contacts + profiles + latest event)
 * History comes from public.store_contact_verification_events, which the
 * BEFORE-UPDATE trigger trg_stamp_contact_verification writes on every
 * verification status change — so re-verifying updates the visible stamp while
 * every earlier event stays on record.
 *
 * No writes. No duplicate contact records. No second verification system.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { History } from 'lucide-react';

interface Props {
  contactId: string;
  /** Pass the live status so the stamp refreshes the moment it changes. */
  statusKey?: string | null;
  className?: string;
}

const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

export function VerificationStamp({ contactId, statusKey, className }: Props) {
  const { data } = useQuery({
    queryKey: ['contact-verification-stamp', contactId, statusKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_store_contact_verification' as any)
        .select('status, verified_at, verified_by_label, verified_method')
        .eq('contact_id', contactId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!contactId,
    staleTime: 15_000,
  });

  const history = useQuery({
    queryKey: ['contact-verification-history', contactId, statusKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_contact_verification_events' as any)
        .select('id, status, previous_status, verified_by_label, verified_at, method')
        .eq('contact_id', contactId)
        .order('verified_at', { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!contactId,
    staleTime: 15_000,
  });

  const when = fmt(data?.verified_at);
  if (!data?.status || !when) return null;

  const who = data.verified_by_label || 'Unknown user';
  const count = history.data?.length || 0;

  return (
    <div className={`flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground ${className || ''}`}>
      <span className="font-semibold capitalize text-foreground/80">{data.status}</span>
      <span>·</span>
      <span>Verified by {who}</span>
      <span>·</span>
      <span>{when}</span>
      {count > 1 && (
        <Popover>
          <PopoverTrigger className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground">
            <History className="h-3 w-3" />
            {count} events
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-popover z-50 p-3">
            <p className="text-xs font-semibold mb-2">Verification history</p>
            <ul className="space-y-1.5 max-h-64 overflow-auto">
              {history.data?.map((e) => (
                <li key={e.id} className="text-[11px] leading-tight">
                  <span className="font-medium capitalize">{e.status}</span>
                  {e.previous_status ? (
                    <span className="text-muted-foreground"> (was {e.previous_status})</span>
                  ) : null}
                  <br />
                  <span className="text-muted-foreground">
                    {e.verified_by_label || 'Unknown user'} · {fmt(e.verified_at)} · {e.method}
                  </span>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
