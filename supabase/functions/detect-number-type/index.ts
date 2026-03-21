import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { phone, store_id, lead_id } = await req.json();
    if (!phone) {
      return new Response(JSON.stringify({ error: 'Phone required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');

    const normalized = phone.replace(/\D/g, '');
    const e164 = normalized.startsWith('1') ? `+${normalized}` : `+1${normalized}`;

    let lineType = 'unknown';
    let smsCapable: boolean | null = null;
    let carrierName: string | null = null;

    // Use Twilio Lookup API if credentials available
    if (TWILIO_SID && TWILIO_TOKEN) {
      try {
        const lookupUrl = `https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(e164)}?Type=carrier`;
        const response = await fetch(lookupUrl, {
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          },
        });

        if (response.ok) {
          const data = await response.json();
          lineType = data.carrier?.type || 'unknown';
          smsCapable = lineType === 'mobile' || lineType === 'voip';
          carrierName = data.carrier?.name || null;
        } else {
          const errText = await response.text();
          console.error('Twilio lookup error:', response.status, errText);
        }
      } catch (lookupErr) {
        console.error('Twilio lookup failed:', lookupErr);
      }
    } else {
      console.warn('Twilio credentials not configured, returning unknown type');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update relevant records
    const updatePayload = {
      phone_type: lineType,
      sms_capable: smsCapable,
      phone_verified_at: new Date().toISOString(),
    };

    if (store_id) {
      await supabase.from('store_master').update(updatePayload).eq('id', store_id);
    }
    if (lead_id) {
      await supabase.from('outreach_leads').update(updatePayload).eq('id', lead_id);
    }

    // Log to instinct log
    await supabase.from('ai_instinct_log').insert({
      action_type: 'phone_type_detected',
      reasoning: `${phone} detected as ${lineType} — SMS ${smsCapable ? 'capable' : 'not capable'}`,
      input_data: { phone, store_id, lead_id },
      decision_path: { line_type: lineType, sms_capable: smsCapable, carrier: carrierName },
      confidence_score: 0.95,
    });

    return new Response(
      JSON.stringify({ phone, e164, type: lineType, sms_capable: smsCapable, carrier: carrierName }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Number detection error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error', type: 'unknown', sms_capable: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
