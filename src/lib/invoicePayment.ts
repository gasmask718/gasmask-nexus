import { supabase } from '@/integrations/supabase/client';

/**
 * Single write path for marking a store invoice (public.invoices) paid/unpaid.
 * Goes through the permission-checked set_invoice_payment_status RPC so
 * ambassadors with store access can collect, and fails closed: if the row did
 * not actually change, this throws instead of reporting success.
 */
export async function setInvoicePaymentStatus(
  invoiceId: string,
  status: 'paid' | 'unpaid',
  paymentMethod?: string | null,
) {
  const { data, error } = await (supabase as any).rpc('set_invoice_payment_status', {
    _invoice_id: invoiceId,
    _status: status,
    _payment_method: paymentMethod ?? null,
  });
  if (error) throw error;
  if (!data || data.payment_status !== status) {
    throw new Error('Invoice was not updated — please refresh and try again');
  }
  return data;
}
