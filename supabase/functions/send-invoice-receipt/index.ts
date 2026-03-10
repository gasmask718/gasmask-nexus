import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  due_date?: string;
  is_historical?: boolean;
  manual_resend?: boolean;
}

/**
 * INVOICE RECEIPT AUTOMATION — Unified for both store invoices and CRM invoices
 * 
 * CRITICAL RULES:
 * 1. This is a SIDE-EFFECT - failures must NEVER block invoice persistence
 * 2. Historical invoices are PERMANENTLY blocked from automation
 * 3. Missing phone numbers are logged gracefully, not thrown as errors
 * 4. After sending, logs to messaging_messages for Conversations tab visibility
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
    
    // Determine if this is a store invoice or CRM customer invoice
    const isStoreInvoice = !!request.invoice_id && !!request.store_id;
    const isCrmInvoice = !!request.customer_invoice_id;
    const invoiceTableId = request.invoice_id || request.customer_invoice_id;

    console.log('📧 Invoice Receipt Request:', {
      invoice_id: request.invoice_id,
      customer_invoice_id: request.customer_invoice_id,
      is_historical: request.is_historical,
      manual_resend: request.manual_resend,
      type: isStoreInvoice ? 'store' : 'crm',
    });

    // CRITICAL: Block ALL automation for historical invoices
    if (request.is_historical && !request.manual_resend) {
      console.log('🚫 BLOCKED: Historical invoice - no automatic receipt sent');
      
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: request.invoice_id || request.customer_invoice_id,
        store_id: request.store_id || null,
        phone_number: request.phone_number || 'N/A',
        message_body: 'BLOCKED - Historical invoice',
        delivery_status: 'blocked',
        is_historical_invoice: true,
        sent_reason: 'blocked_historical',
      });

      if (isStoreInvoice) {
        await supabase.from('invoices').update({ receipt_status: 'blocked' }).eq('id', request.invoice_id!);
      }

      return new Response(
        JSON.stringify({ success: true, blocked: true, reason: 'Historical invoice - automation disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHONE NUMBER RESOLUTION
    let phoneNumber = request.phone_number;
    let phoneSource = 'provided';

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
        console.log(`📞 Using CRM customer phone: ${phoneNumber}`);
      }
    }

    // For store invoices, try store contacts then store record
    if (!phoneNumber && request.store_id) {
      const { data: contacts } = await supabase
        .from('store_contacts')
        .select('phone, name, role')
        .eq('store_id', request.store_id)
        .not('phone', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (contacts && contacts.length > 0 && contacts[0].phone) {
        phoneNumber = contacts[0].phone;
        phoneSource = `store_contact:${contacts[0].name || 'unknown'}`;
        console.log(`📞 Using contact phone: ${phoneNumber} (${contacts[0].role || 'no role'})`);
      }
    }

    if (!phoneNumber && request.store_id) {
      const { data: storeData } = await supabase
        .from('store_master')
        .select('phone, contact_phone')
        .eq('id', request.store_id)
        .single();

      phoneNumber = storeData?.contact_phone || storeData?.phone;
      if (phoneNumber) {
        phoneSource = 'store_record';
        console.log(`📞 Using store phone: ${phoneNumber}`);
      }
    }

    // No phone = log and return success
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

    // Normalize phone number to E.164
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = `+1${normalizedPhone}`;
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('09')) {
      normalizedPhone = `+63${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.startsWith('63') && normalizedPhone.length === 12) {
      normalizedPhone = `+${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    // Compose professional receipt message
    const formattedTotal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(request.total_amount);

    const invoiceDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const dueDateFormatted = request.due_date 
      ? new Date(request.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Net 30';

    const messageBody = `🧾 Invoice Notification\n\n` +
      `Hi ${request.store_name},\n\n` +
      `You have a new invoice from Dynasty OS:\n\n` +
      `📄 Invoice #: ${request.invoice_number}\n` +
      `💰 Amount: ${formattedTotal}\n` +
      `📅 Date: ${invoiceDate}\n` +
      `📅 Due: ${dueDateFormatted}\n\n` +
      `Payment Methods: Cash, CashApp, Zelle, Check\n\n` +
      `Thank you for your business!\n` +
      `— Dynasty OS`;

    // Check if Twilio is configured
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

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append('MessagingServiceSid', twilioMessagingServiceSid);
    formData.append('To', normalizedPhone);
    formData.append('Body', messageBody);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();
    const messageSid = twilioResult.sid || null;
    const sendSuccess = twilioResponse.ok;

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
        campaign_id: null, // Not a campaign — direct invoice receipt
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
