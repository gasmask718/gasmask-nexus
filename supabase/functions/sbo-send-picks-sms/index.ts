import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendSms, smsContentHash } from '../_shared/sendSms.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
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

    const today = new Date().toISOString().split('T')[0];
    const bodyHash = await smsContentHash(message);
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER') || undefined;

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const phone of recipients) {
      const result = await sendSms({
        to: phone,
        body: message,
        idempotencyKey: `sbo-picks-${today}-${bodyHash}-${phone}`,
        from: fromNumber,
        purpose: 'sbo_picks_broadcast',
        metadata: { send_type },
      });

      if (!result.success) {
        // Suppressed numbers are an expected skip, not a provider failure.
        errors.push(`${phone}: ${result.status}${result.errorMessage ? ` — ${result.errorMessage}` : ''}`);
        failed++;
      } else {
        sent++;

        // Update recipient stats
        await supabase
          .from('sbo_sms_recipients')
          .update({ last_sent_at: new Date().toISOString() })
          .eq('phone_number', phone);

        // Increment total_sends via RPC when available
        await supabase.rpc('increment_sms_sends', { p_phone: phone }).catch(() => {
          /* RPC absent — last_sent_at update above is the fallback */
        });
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
