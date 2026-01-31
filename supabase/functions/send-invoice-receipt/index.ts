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
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    const request: ReceiptRequest = await req.json();
    
    console.log('Invoice Receipt Request:', {
      invoice_id: request.invoice_id,
      is_historical: request.is_historical,
      manual_resend: request.manual_resend,
    });

    // CRITICAL: Block ALL automation for historical invoices
    if (request.is_historical && !request.manual_resend) {
      console.log('BLOCKED: Historical invoice - no automatic receipt sent');
      
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

      return new Response(
        JSON.stringify({
          success: true,
          blocked: true,
          reason: 'Historical invoice - automation disabled',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get phone number from store if not provided
    let phoneNumber = request.phone_number;
    if (!phoneNumber) {
      // Try to get phone from store contacts
      const { data: storeData } = await supabase
        .from('store_master')
        .select('phone, contact_phone')
        .eq('id', request.store_id)
        .single();

      phoneNumber = storeData?.contact_phone || storeData?.phone;

      // Try store_contacts as fallback
      if (!phoneNumber) {
        const { data: contacts } = await supabase
          .from('store_contacts')
          .select('phone')
          .eq('store_id', request.store_id)
          .limit(1);
        
        phoneNumber = contacts?.[0]?.phone;
      }
    }

    if (!phoneNumber) {
      console.log('No phone number found for store');
      
      await supabase.from('invoice_receipt_log').insert({
        invoice_id: request.invoice_id,
        store_id: request.store_id,
        phone_number: 'MISSING',
        message_body: 'No phone number available',
        delivery_status: 'failed',
        error_message: 'No phone number found for store',
        is_historical_invoice: false,
        sent_reason: request.manual_resend ? 'manual_resend' : 'auto_live',
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: 'No phone number found for store',
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Normalize phone number to E.164
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = `+1${normalizedPhone}`;
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('09')) {
      // Philippines format
      normalizedPhone = `+63${normalizedPhone.slice(1)}`;
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
    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.log('Twilio not configured - logging receipt without sending');
      
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

      // Update invoice with receipt status
      await supabase
        .from('invoices')
        .update({
          receipt_status: 'skipped',
        })
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

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append('From', twilioPhoneNumber);
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
      console.error('Twilio error:', twilioResult);
      
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
        .update({
          receipt_status: 'failed',
        })
        .eq('id', request.invoice_id);

      return new Response(
        JSON.stringify({
          success: false,
          error: twilioResult.message || 'Failed to send SMS',
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Log successful send
    const messageSid = twilioResult.sid;
    
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

    console.log('Receipt sent successfully:', { messageSid, phone: normalizedPhone });

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        message_sid: messageSid,
        phone: normalizedPhone,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Send Invoice Receipt Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
