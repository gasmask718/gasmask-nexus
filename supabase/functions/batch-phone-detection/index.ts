import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!TWILIO_SID || !TWILIO_TOKEN) {
      return new Response(JSON.stringify({
        error: 'Twilio credentials not configured',
        processed: 0,
        remaining: -1,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get stores with undetected phone types — small batch to avoid rate limits
    const { data: stores } = await supabase
      .from('store_master')
      .select('id, phone')
      .not('phone', 'is', null)
      .neq('phone', '')
      .or('phone_type.is.null,phone_type.eq.unknown')
      .limit(25);

    let processed = 0;

    for (const store of stores || []) {
      try {
        const normalized = (store.phone || '').replace(/\D/g, '');
        if (normalized.length < 10) continue;

        const e164 = normalized.startsWith('1') ? `+${normalized}` : `+1${normalized}`;
        const lookupUrl = `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(e164)}?Type=carrier`;

        const response = await fetch(lookupUrl, {
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          },
        });

        if (response.ok) {
          const data = await response.json();
          const lineType = data.carrier?.type || 'unknown';
          const smsCapable = lineType === 'mobile' || lineType === 'voip';

          await supabase
            .from('store_master')
            .update({
              phone_type: lineType,
              sms_capable: smsCapable,
              phone_verified_at: new Date().toISOString(),
            })
            .eq('id', store.id);

          processed++;
        }

        // Rate limit: 1 second between lookups
        await new Promise(r => setTimeout(r, 1000));
      } catch {
        // Continue on individual errors
      }
    }

    const { count: remaining } = await supabase
      .from('store_master')
      .select('*', { count: 'exact', head: true })
      .not('phone', 'is', null)
      .neq('phone', '')
      .or('phone_type.is.null,phone_type.eq.unknown');

    return new Response(JSON.stringify({
      processed,
      remaining: remaining || 0,
      message: (remaining || 0) > 0 ? 'Run again to continue' : 'All phones classified',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Batch phone detection error:', e);
    return new Response(JSON.stringify({
      error: e instanceof Error ? e.message : 'Unknown error',
      processed: 0,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
