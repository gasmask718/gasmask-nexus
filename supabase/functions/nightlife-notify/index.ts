import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { request_id, action, counter_price, counter_details, promoter_name } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch the request
    const { data: request, error } = await supabase
      .from('nightlife_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (error || !request) {
      return new Response(JSON.stringify({ error: 'Request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userName = request.user_name;
    let smsBody = '';

    switch (action) {
      case 'accepted':
        smsBody = `🎉 ${userName}, your VIP request for ${request.venue || request.city} on ${request.date} has been ACCEPTED${promoter_name ? ` by ${promoter_name}` : ''}! A booking has been created. We'll be in touch with details.`;
        break;
      case 'declined':
        smsBody = `Hi ${userName}, unfortunately your VIP request for ${request.venue || request.city} on ${request.date} could not be accommodated. Please reach out if you'd like to explore alternatives.`;
        break;
      case 'counter_offer':
        smsBody = `💬 ${userName}, we have a counter offer for your VIP request at ${request.venue || request.city}! Proposed: $${counter_price || 'TBD'}. ${counter_details || ''} Reply to confirm.`;
        break;
      default:
        smsBody = `Update on your VIP nightlife request: Status is now "${action}".`;
    }

    const results: any = { sms: null, email: null };

    // Send SMS via Twilio
    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_FROM = Deno.env.get('TWILIO_PHONE_NUMBER') || Deno.env.get('TWILIO_FROM_NUMBER');

    if (request.phone && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      try {
        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: TWILIO_FROM,
              To: request.phone,
              Body: smsBody,
            }),
          }
        );
        const twilioData = await twilioRes.json();
        results.sms = twilioRes.ok ? 'sent' : { error: twilioData };
        console.log('SMS result:', twilioRes.ok ? 'sent' : 'failed');
      } catch (e) {
        console.error('SMS error:', e);
        results.sms = 'error';
      }
    } else {
      results.sms = 'skipped_no_phone_or_credentials';
    }

    // Also notify admin
    const ADMIN_PHONE = Deno.env.get('DAVID_PHONE_NUMBER') || Deno.env.get('YOUR_PHONE_NUMBER');
    if (ADMIN_PHONE && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              From: TWILIO_FROM,
              To: ADMIN_PHONE,
              Body: `🌙 NIGHTLIFE UPDATE: ${userName}'s request was ${action}. Venue: ${request.venue || 'TBD'}, City: ${request.city}, Date: ${request.date}`,
            }),
          }
        );
      } catch (e) {
        console.error('Admin SMS error:', e);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Nightlife notify error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
