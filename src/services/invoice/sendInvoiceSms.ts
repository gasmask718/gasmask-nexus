import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SendInvoiceSmsInput {
  checkoutUrl: string;
  customerPhone: string;
  customerName?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  businessId?: string;
  brand?: string;
  /** Suppress toasts; default false. */
  silent?: boolean;
}

export interface SendInvoiceSmsResult {
  success: boolean;
  shortUrl?: string;
  smsSid?: string;
  to?: string;
  error?: string;
}

/**
 * Calls the `send-invoice-sms` edge function to shorten the Stripe checkout URL
 * via TinyURL and text it to the customer through Twilio. Logs to
 * communication_logs server-side. Safe to call from the browser; credentials
 * never leave the edge function.
 */
export async function sendInvoiceSms(input: SendInvoiceSmsInput): Promise<SendInvoiceSmsResult> {
  const { silent, ...payload } = input;

  const { data, error } = await supabase.functions.invoke("send-invoice-sms", {
    body: {
      checkout_url: payload.checkoutUrl,
      customer_phone: payload.customerPhone,
      customer_name: payload.customerName,
      invoice_id: payload.invoiceId,
      invoice_number: payload.invoiceNumber,
      business_id: payload.businessId,
      brand: payload.brand,
    },
  });

  if (error || (data && (data as any).error)) {
    const message = (data as any)?.error || error?.message || "Failed to send invoice SMS";
    if (!silent) toast.error(message);
    return { success: false, error: message };
  }

  const d = data as any;
  if (!silent) toast.success(`Invoice texted to ${d.to}`);
  return { success: true, shortUrl: d.short_url, smsSid: d.sms_sid, to: d.to };
}
