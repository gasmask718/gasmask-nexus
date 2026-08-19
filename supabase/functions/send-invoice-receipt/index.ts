import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { sendSms as sendCanonicalSms } from "../_shared/sendSms.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ReceiptRequest {
  invoice_id?: string;
  customer_invoice_id?: string;
  customer_id?: string;
  store_id?: string;
  invoice_number: string;
  total_amount: number;
  store_name: string;
  phone_number?: string;
  recipient_phone?: string;
  custom_message?: string;
  due_date?: string;
  is_historical?: boolean;
  manual_resend?: boolean;
}

/**
 * INVOICE RECEIPT AUTOMATION — Unified for both store invoices and CRM invoices
 * Sends via Twilio and logs to messaging_messages for Conversations tab visibility.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioMessagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID');

    const request: ReceiptRequest = await req.json();
    
    const isStoreInvoice = !!request.invoice_id && !!request.store_id;
    const isCrmInvoice = !!request.customer_invoice_id;
    const invoiceTableId = request.invoice_id || request.customer_invoice_id;

    console.log('📧 Invoice Receipt Request:', {
      invoice_id: request.invoice_id,
      customer_invoice_id: request.customer_invoice_id,
      is_historical: request.is_historical,
      type: isStoreInvoice ? 'store' : 'crm',
      recipient_phone: request.recipient_phone || 'auto-resolve',
    });

    // Block historical invoices
    if (request.is_historical && !request.manual_resend) {
      console.log('🚫 BLOCKED: Historical invoice');
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: invoiceTableId,
        store_id: request.store_id || null,
        phone_number: 'N/A',
        message_body: 'BLOCKED - Historical invoice',
        delivery_status: 'blocked',
        is_historical_invoice: true,
        sent_reason: 'blocked_historical',
      });
      if (isStoreInvoice) {
        await supabase.from('invoices').update({ receipt_status: 'blocked' }).eq('id', request.invoice_id!);
      }
      return new Response(
        JSON.stringify({ success: true, blocked: true, reason: 'Historical invoice' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHONE NUMBER RESOLUTION — Priority: recipient_phone > phone_number > auto-resolve
    let phoneNumber = request.recipient_phone || request.phone_number;
    let phoneSource = request.recipient_phone ? 'recipient_input' : (request.phone_number ? 'provided' : 'auto');

    // For CRM invoices, resolve phone from crm_customers
    if (!phoneNumber && isCrmInvoice && request.customer_id) {
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('phone, name')
        .eq('id', request.customer_id)
        .single();
      if (customer?.phone) {
        phoneNumber = customer.phone;
        phoneSource = `crm_customer:${customer.name || 'unknown'}`;
      }
    }

    // For store invoices: only a billing-appropriate contact may receive a
    // receipt. The old "oldest contact with a phone" fallback sent 21 receipts
    // to store workers whose numbers were captured for ops/visits, not billing
    // (audit 2026-08-19). Anything that is not the owner/billing/primary contact
    // is skipped and we fall through to the store's own line.
    const BILLING_ROLES = ['owner', 'billing', 'manager', 'accounting'];
    if (!phoneNumber && request.store_id) {
      const { data: contacts } = await supabase
        .from('store_contacts')
        .select('phone, name, role, is_primary')
        .is('deleted_at', null)
        .eq('store_id', request.store_id)
        .not('phone', 'is', null)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      const eligible = (contacts || []).find(
        (c: { role?: string | null; is_primary?: boolean | null }) =>
          c.is_primary === true || BILLING_ROLES.includes(String(c.role || '').toLowerCase()),
      );
      if (eligible?.phone) {
        phoneNumber = eligible.phone;
        phoneSource = `store_contact:${eligible.name || 'unknown'}`;
      } else if ((contacts || []).length > 0) {
        console.log('ℹ️ store_contacts present but none billing-eligible — skipping contact fallback');
      }
    }

    if (!phoneNumber && request.store_id) {
      const { data: storeData } = await supabase
        .from('store_master')
        .select('phone')
        .eq('id', request.store_id)
        .single();
      phoneNumber = storeData?.phone;
      if (phoneNumber) phoneSource = 'store_record';
    }


    if (!phoneNumber) {
      console.log('⚠️ No phone number found - receipt skipped');
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: invoiceTableId,
        store_id: request.store_id || null,
        phone_number: 'MISSING',
        message_body: 'Receipt skipped - no phone number available',
        delivery_status: 'skipped',
        error_message: 'No phone number found',
        is_historical_invoice: false,
        sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
      });
      if (isStoreInvoice) {
        await supabase.from('invoices').update({ receipt_status: 'skipped' }).eq('id', request.invoice_id!);
      }
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: 'No phone number available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone to E.164
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = `+1${normalizedPhone}`;
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('1')) {
      normalizedPhone = `+${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    // Compose receipt message
    const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(request.total_amount);
    const invoiceDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dueDateFormatted = request.due_date
      ? new Date(request.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Net 30';

    // Owner self-serve portal link — placed in every receipt so the next
    // reorder happens in-app instead of via phone tag.
    const portalBase = Deno.env.get('PUBLIC_APP_URL') || 'https://gasmask-os-nexus.lovable.app';
    const portalLink = request.store_id
      ? `${portalBase}/portal/store?invite=${request.store_id}`
      : `${portalBase}/portal/store`;
    const reorderLine = `\n🛒 Reorder anytime: ${portalLink}\n`;

    // Build message — use custom_message if provided, otherwise default template
    let messageBody: string;
    if (request.custom_message && request.custom_message.trim()) {
      messageBody = `🧾 Invoice Notification\n\n` +
        `Hi ${request.store_name},\n\n` +
        `📄 Invoice #: ${request.invoice_number}\n` +
        `💰 Amount: ${formattedTotal}\n` +
        `📅 Due: ${dueDateFormatted}\n\n` +
        `${request.custom_message.trim()}\n\n` +
        `Payment Methods: Cash, CashApp, Zelle, Check\n` +
        reorderLine +
        `— GasMask`;
    } else {
      messageBody = `🧾 Invoice Notification\n\n` +
        `Hi ${request.store_name},\n\n` +
        `You have a new invoice from GasMask:\n\n` +
        `📄 Invoice #: ${request.invoice_number}\n` +
        `💰 Amount: ${formattedTotal}\n` +
        `📅 Date: ${invoiceDate}\n` +
        `📅 Due: ${dueDateFormatted}\n\n` +
        `Payment Methods: Cash, CashApp, Zelle, Check\n` +
        reorderLine +
        `\nThank you for your business!\n` +
        `— GasMask`;
    }

    // Check Twilio config
    if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
      console.log('⚠️ Twilio not configured - logging receipt without sending');
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: invoiceTableId,
        store_id: request.store_id || null,
        phone_number: normalizedPhone,
        message_body: messageBody,
        delivery_status: 'skipped',
        error_message: 'Twilio not configured',
        is_historical_invoice: false,
        sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
      });
      if (isStoreInvoice) {
        await supabase.from('invoices').update({ receipt_status: 'skipped' }).eq('id', request.invoice_id!);
      }
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: 'Twilio not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via Twilio (Group C, transactional).
    const sent = await sendCanonicalSms({
      to: normalizedPhone,
      body: messageBody,
      sendClass: 'transactional',
      purpose: 'invoice_receipt',
      idempotencyKey: `invoice-receipt-${invoiceTableId ?? request.invoice_id}-${normalizedPhone}${request.manual_resend ? `-resend-${Date.now()}` : ''}`,
      skipCooldown: true,
      storeId: request.store_id ?? null,
      metadata: { invoice_id: invoiceTableId, store_id: request.store_id ?? null, phone_source: phoneSource },
    });
    const twilioResult = { sid: sent.providerMessageId, message: sent.errorMessage };
    const messageSid = sent.providerMessageId;
    const sendSuccess = sent.success;

    // Log to invoice_receipt_log
    await supabase.from('invoice_receipt_log').insert({
      invoice_id: invoiceTableId,
      store_id: request.store_id || null,
      phone_number: normalizedPhone,
      message_body: messageBody,
      message_sid: messageSid,
      delivery_status: sendSuccess ? 'sent' : 'failed',
      error_message: sendSuccess ? null : (twilioResult.message || 'Twilio send failed'),
      is_historical_invoice: false,
      sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
    });

    // Update invoice receipt tracking
    if (isStoreInvoice) {
      await supabase.from('invoices').update({
        receipt_sent_at: sendSuccess ? new Date().toISOString() : null,
        receipt_message_sid: messageSid,
        receipt_status: sendSuccess ? 'sent' : 'failed',
      }).eq('id', request.invoice_id!);
    }

    // LOG TO messaging_messages — makes invoice receipts visible in Conversations tab
    try {
      await supabase.from('messaging_messages').insert({
        direction: 'outbound',
        body: messageBody,
        phone: normalizedPhone,
        status: sendSuccess ? 'sent' : 'failed',
        twilio_sid: messageSid,
        store_id: request.store_id || null,
        campaign_id: null,
        ai_generated: false,
      });
      console.log('📝 Logged invoice receipt to messaging_messages');
    } catch (logErr) {
      console.error('⚠️ Failed to log to messaging_messages (non-blocking):', logErr);
    }

    if (!sendSuccess) {
      console.error('❌ Twilio error:', twilioResult);
      return new Response(
        JSON.stringify({ success: false, sent: false, error: twilioResult.message || 'Failed to send SMS', logged: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Receipt sent: SID=${messageSid}, phone=${normalizedPhone}, source=${phoneSource}`);

    return new Response(
      JSON.stringify({ success: true, sent: true, message_sid: messageSid, phone: normalizedPhone, phone_source: phoneSource }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Send Invoice Receipt Error:', error);
    return new Response(
      JSON.stringify({ success: false, sent: false, error: error instanceof Error ? error.message : String(error), logged: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
