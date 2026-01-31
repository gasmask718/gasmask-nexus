import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceiptRequest {
  invoice_id: string;
  store_id: string;
  invoice_number: string;
  total_amount: number;
  store_name: string;
  phone_number?: string;
  is_historical?: boolean;
  manual_resend?: boolean;
}

/**
 * INVOICE RECEIPT AUTOMATION
 * 
 * CRITICAL RULES:
 * 1. This is a SIDE-EFFECT - failures must NEVER block invoice persistence
 * 2. Historical invoices are PERMANENTLY blocked from automation
 * 3. Missing phone numbers are logged gracefully, not thrown as errors
 * 4. Phone is sourced from: provided → store contacts → store record (in priority order)
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
    
    console.log('📧 Invoice Receipt Request:', {
      invoice_id: request.invoice_id,
      is_historical: request.is_historical,
      manual_resend: request.manual_resend,
    });

    // CRITICAL: Block ALL automation for historical invoices
    if (request.is_historical && !request.manual_resend) {
      console.log('🚫 BLOCKED: Historical invoice - no automatic receipt sent');
      
      // Log the blocked attempt for audit trail
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: request.invoice_id,
        store_id: request.store_id,
        phone_number: request.phone_number || 'N/A',
        message_body: 'BLOCKED - Historical invoice',
        delivery_status: 'blocked',
        is_historical_invoice: true,
        sent_reason: 'blocked_historical',
      });

      // Update invoice receipt status
      await supabase
        .from('invoices')
        .update({ receipt_status: 'blocked' })
        .eq('id', request.invoice_id);

      // Return SUCCESS (200) - blocking is expected behavior, not an error
      return new Response(
        JSON.stringify({
          success: true,
          blocked: true,
          reason: 'Historical invoice - automation disabled',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // PHONE NUMBER RESOLUTION - Priority order:
    // 1. Provided phone number (from caller)
    // 2. Store contacts (billing/primary contact)
    // 3. Store phone field
    let phoneNumber = request.phone_number;
    let phoneSource = 'provided';

    if (!phoneNumber) {
      // Try store_contacts first (preferred - these are actual people)
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

    if (!phoneNumber) {
      // Fallback to store record
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

    // GRACEFUL HANDLING: No phone = log and return success (not an error)
    if (!phoneNumber) {
      console.log('⚠️ No phone number found - receipt skipped (not an error)');
      
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: request.invoice_id,
        store_id: request.store_id,
        phone_number: 'MISSING',
        message_body: 'Receipt skipped - no phone number available',
        delivery_status: 'skipped',
        error_message: 'No phone number found for store contacts or store record',
        is_historical_invoice: false,
        sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
      });

      // Update invoice with skip status (not failed)
      await supabase
        .from('invoices')
        .update({ receipt_status: 'skipped' })
        .eq('id', request.invoice_id);

      // Return SUCCESS (200) - missing phone is expected in some cases, not a system failure
      return new Response(
        JSON.stringify({
          success: true,
          sent: false,
          reason: 'No phone number available - receipt skipped',
          receipt_not_sent_reason: 'missing_phone',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number to E.164
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = `+1${normalizedPhone}`;
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('09')) {
      // Philippines format
      normalizedPhone = `+63${normalizedPhone.slice(1)}`;
    } else if (normalizedPhone.startsWith('63') && normalizedPhone.length === 12) {
      normalizedPhone = `+${normalizedPhone}`;
    } else if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = `+${normalizedPhone}`;
    }

    // Compose receipt message
    const formattedTotal = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(request.total_amount);

    const messageBody = `Receipt Confirmation\n\n` +
      `Store: ${request.store_name}\n` +
      `Invoice: ${request.invoice_number}\n` +
      `Amount: ${formattedTotal}\n` +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `Thank you for your business!`;

    // Check if Twilio is configured
    if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
      console.log('⚠️ Twilio not configured - logging receipt without sending');
      
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: request.invoice_id,
        store_id: request.store_id,
        phone_number: normalizedPhone,
        message_body: messageBody,
        delivery_status: 'skipped',
        error_message: 'Twilio not configured',
        is_historical_invoice: false,
        sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
      });

      await supabase
        .from('invoices')
        .update({ receipt_status: 'skipped' })
        .eq('id', request.invoice_id);

      return new Response(
        JSON.stringify({
          success: true,
          sent: false,
          reason: 'Twilio not configured',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS via Twilio using Messaging Service
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

    if (!twilioResponse.ok) {
      console.error('❌ Twilio error:', twilioResult);
      
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: request.invoice_id,
        store_id: request.store_id,
        phone_number: normalizedPhone,
        message_body: messageBody,
        delivery_status: 'failed',
        error_message: twilioResult.message || 'Twilio send failed',
        is_historical_invoice: false,
        sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
      });

      await supabase
        .from('invoices')
        .update({ receipt_status: 'failed' })
        .eq('id', request.invoice_id);

      // Still return 200 - Twilio failure is logged but doesn't break the system
      return new Response(
        JSON.stringify({
          success: false,
          sent: false,
          error: twilioResult.message || 'Failed to send SMS',
          logged: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful send
    const messageSid = twilioResult.sid;
    console.log(`✅ Receipt sent successfully: SID=${messageSid}, phone=${normalizedPhone}, source=${phoneSource}`);
    
    await supabase.from('invoice_receipt_log').insert({
      invoice_id: request.invoice_id,
      store_id: request.store_id,
      phone_number: normalizedPhone,
      message_body: messageBody,
      message_sid: messageSid,
      delivery_status: 'sent',
      is_historical_invoice: false,
      sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
    });

    // Update invoice with receipt tracking
    await supabase
      .from('invoices')
      .update({
        receipt_sent_at: new Date().toISOString(),
        receipt_message_sid: messageSid,
        receipt_status: 'sent',
      })
      .eq('id', request.invoice_id);

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        message_sid: messageSid,
        phone: normalizedPhone,
        phone_source: phoneSource,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Send Invoice Receipt Error:', error);
    
    // Even system errors return 200 - this is a side-effect function
    // Returning 500 could cause retry storms or block dependent logic
    return new Response(
      JSON.stringify({
        success: false,
        sent: false,
        error: error instanceof Error ? error.message : String(error),
        logged: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
