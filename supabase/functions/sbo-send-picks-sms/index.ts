import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const FROM_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { message, recipients, send_type = 'manual' } = await req.json();

    if (!message || !recipients?.length) {
      return new Response(JSON.stringify({ error: 'message and recipients required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
    const authHeader = 'Basic ' + btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const phone of recipients) {
      try {
        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: FROM_NUMBER, To: phone, Body: message }),
        });

        if (!response.ok) {
          const errText = await response.text();
          errors.push(`${phone}: ${errText}`);
          failed++;
        } else {
          await response.json();
          sent++;

          // Update recipient stats
          await supabase
            .from('sbo_sms_recipients')
            .update({
              last_sent_at: new Date().toISOString(),
              total_sends: supabase.rpc ? undefined : undefined,
            })
            .eq('phone_number', phone);

          // Increment total_sends via raw SQL workaround
          await supabase.rpc('increment_sms_sends', { p_phone: phone }).catch(() => {
            // If RPC doesn't exist, do a manual update
            supabase
              .from('sbo_sms_recipients')
              .update({ last_sent_at: new Date().toISOString() })
              .eq('phone_number', phone);
          });
        }
      } catch (e: any) {
        errors.push(`${phone}: ${e.message}`);
        failed++;
      }

      // 200ms delay between sends
      await new Promise(r => setTimeout(r, 200));
    }

    // Log the send
    await supabase.from('sbo_sms_sends_log').insert({
      recipient_count: recipients.length,
      message_preview: message.substring(0, 500),
      picks_included: (message.match(/Confidence:/g) || []).length,
      send_type,
      status: failed === 0 ? 'sent' : sent === 0 ? 'failed' : 'partial',
      error_message: errors.length > 0 ? errors.join('; ') : null,
    });

    return new Response(JSON.stringify({ sent, failed, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
