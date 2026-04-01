import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const auth = 'Basic ' + btoa(TWILIO_SID + ':' + TWILIO_TOKEN);
  const twilioBase = 'https://api.twilio.com/2010-04-01';

  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return new Response(JSON.stringify({
      error: 'TWILIO_NOT_CONFIGURED',
      message: 'Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to project secrets'
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const {
      action,
      country = 'US',
      numberType = 'local',
      areaCode,
      prefix,
      phoneNumber,
      business,
      agentId,
      agentName,
      quantity = 1
    } = body;

    // STATUS CHECK
    if (action === 'status') {
      const res = await fetch(`${twilioBase}/Accounts/${TWILIO_SID}.json`, {
        headers: { Authorization: auth }
      });
      const data = await res.json();
      return new Response(JSON.stringify({
        connected: res.ok,
        accountName: data.friendly_name || 'Unknown',
        accountSid: data.sid,
        status: data.status
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // SEARCH NUMBERS
    if (action === 'search') {
      let url = '';

      if (country === 'DO') {
        const drAreaCode = areaCode || '809';
        url = `${twilioBase}/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?AreaCode=${drAreaCode}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      } else if (numberType === 'tollfree') {
        url = `${twilioBase}/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/TollFree.json?VoiceEnabled=true&SmsEnabled=true&Limit=5`;
        if (prefix) url += `&Contains=${prefix}*******`;
      } else {
        url = `${twilioBase}/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode || '929'}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      }

      const res = await fetch(url, { headers: { Authorization: auth } });
      const data = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({
          error: 'Search failed',
          details: data,
          httpStatus: res.status
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const numbers = (data.available_phone_numbers || []).map((n: any) => ({
        phoneNumber: n.phone_number,
        friendlyName: n.friendly_name,
        locality: n.locality,
        region: n.region || country,
        country: country,
        capabilities: n.capabilities,
        monthlyCost: country === 'DO' ? 5.00 : numberType === 'tollfree' ? 2.00 : 1.00
      }));

      return new Response(JSON.stringify({
        success: true,
        numbers,
        total: numbers.length
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PURCHASE NUMBER
    if (action === 'purchase') {
      if (!phoneNumber) {
        return new Response(JSON.stringify({ error: 'phoneNumber is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-inbound-call`;
      const results: any[] = [];
      const qty = parseInt(String(quantity)) || 1;
      const numbersToBuy = Array.isArray(phoneNumber) ? phoneNumber : [phoneNumber];

      for (let i = 0; i < Math.min(qty, numbersToBuy.length); i++) {
        const num = numbersToBuy[i];
        if (!num) break;

        const form = new URLSearchParams({
          PhoneNumber: num,
          FriendlyName: `${business || 'Dynasty'} — ${agentName || 'AI Agent'}${qty > 1 ? ' #' + (i + 1) : ''}`,
          VoiceUrl: webhookUrl,
          VoiceMethod: 'POST',
        });

        const res = await fetch(
          `${twilioBase}/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`,
          {
            method: 'POST',
            headers: {
              Authorization: auth,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form,
          }
        );
        const purchased = await res.json();

        if (res.ok && SUPABASE_URL && SUPABASE_KEY) {
          const monthlyCost = country === 'DO' ? 5.00 : numberType === 'tollfree' ? 2.00 : 1.00;
          await fetch(`${SUPABASE_URL}/rest/v1/dc_phone_numbers`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY!,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              business: business || 'unknown',
              phone_number: purchased.phone_number,
              twilio_sid: purchased.sid,
              assigned_agent_id: agentId || null,
              assigned_agent_name: agentName || null,
              friendly_name: purchased.friendly_name,
              is_active: true,
              monthly_cost: monthlyCost,
              number_type: country === 'DO' ? 'dr_local' : numberType,
              country: country,
            }),
          });
          results.push({ success: true, number: purchased.phone_number, sid: purchased.sid });
        } else {
          results.push({ success: false, error: purchased });
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
