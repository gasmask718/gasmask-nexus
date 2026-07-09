/**
 * Shared shipping-label print helper (admin surfaces).
 *
 * Mirrors the wholesaler portal's Print Label pattern
 * (WholesalerFulfillment.tsx) but writes to the generic public.audit_log
 * table because admin-side prints reference dd_shipments / shipping_labels
 * rows that live outside the fulfillment_id world used by the portal.
 *
 * Usage:
 *   await printShippingLabel({
 *     labelUrl,
 *     recordId: shipment.id,
 *     tableName: 'dd_shipments',
 *     meta: { carrier, tracking, order_id },
 *   });
 */
import { supabase } from '@/integrations/supabase/client';

export type PrintLabelArgs = {
  labelUrl: string | null | undefined;
  recordId: string;
  tableName: 'dd_shipments' | 'shipping_labels';
  meta?: Record<string, unknown>;
};

export async function printShippingLabel({
  labelUrl,
  recordId,
  tableName,
  meta,
}: PrintLabelArgs): Promise<boolean> {
  if (!labelUrl) return false;
  window.open(labelUrl, '_blank', 'noopener');

  try {
    const { data: userRes } = await supabase.auth.getUser();
    await (supabase as any).from('audit_log').insert({
      table_name: tableName,
      record_id: recordId,
      action: 'label_printed',
      actor_user_id: userRes.user?.id ?? null,
      new_data: { label_url: labelUrl, ...(meta ?? {}) },
      source: 'admin_ui',
    });
  } catch (e) {
    // Non-blocking — the label already opened.
    console.error('Failed to log label print event:', e);
  }
  return true;
}
