/**
 * Shared shipping-label print helper (admin surfaces).
 *
 * Mirrors the wholesaler portal's Print Label pattern
 * (WholesalerFulfillment.tsx) but writes to the general-purpose
 * public.audit_logs table because admin-side prints reference
 * dd_shipments / shipping_labels rows that live outside the
 * fulfillment_id world used by the portal's shipping_label_events.
 */
import { supabase } from '@/integrations/supabase/client';

export type PrintLabelArgs = {
  labelUrl: string | null | undefined;
  recordId: string;
  entityType: 'dd_shipments' | 'shipping_labels';
  meta?: Record<string, unknown>;
};

export async function printShippingLabel({
  labelUrl,
  recordId,
  entityType,
  meta,
}: PrintLabelArgs): Promise<boolean> {
  if (!labelUrl) return false;
  window.open(labelUrl, '_blank', 'noopener');

  try {
    const { data: userRes } = await supabase.auth.getUser();
    await (supabase as any).from('audit_logs').insert({
      user_id: userRes.user?.id ?? null,
      action: 'shipping_label_printed',
      entity_type: entityType,
      entity_id: recordId,
      metadata: { label_url: labelUrl, ...(meta ?? {}) },
    });
  } catch (e) {
    // Non-blocking — the label already opened.
    console.error('Failed to log label print event:', e);
  }
  return true;
}
