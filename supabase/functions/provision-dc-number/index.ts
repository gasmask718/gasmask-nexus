const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const getEnvValue = (...names: string[]) => {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const TWILIO_SID = getEnvValue('TWILIO_ACCOUNT_SID', 'TWILIO_SID', 'VITE_TWILIO_ACCOUNT_SID');
  const TWILIO_TOKEN = getEnvValue('TWILIO_AUTH_TOKEN', 'TWILIO_TOKEN', 'VITE_TWILIO_AUTH_TOKEN');
  const TWILIO_CONNECTOR_KEY = getEnvValue('TWILIO_API_KEY');
  const LOVABLE_API_KEY = getEnvValue('LOVABLE_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const twilioBase = 'https://api.twilio.com/2010-04-01';
  const twilioGateway = 'https://connector-gateway.lovable.dev/twilio';
  const hasConnectorAuth = Boolean(LOVABLE_API_KEY && TWILIO_CONNECTOR_KEY);
  const hasDirectAuth = Boolean(TWILIO_SID && TWILIO_TOKEN);
  const authMode = hasDirectAuth ? 'direct' : hasConnectorAuth ? 'connector' : 'none';

  if (!hasConnectorAuth && !hasDirectAuth) {
    return new Response(JSON.stringify({
      error: 'TWILIO_NOT_CONFIGURED',
      message: 'Twilio credentials are not set in project secrets.',
    }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const callTwilio = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (hasDirectAuth) {
      headers.set('Authorization', 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`));
      return fetch(`${twilioBase}/Accounts/${TWILIO_SID}${path}`, { ...init, headers });
    }
    if (hasConnectorAuth) {
      headers.set('Authorization', `Bearer ${LOVABLE_API_KEY}`);
      headers.set('X-Connection-Api-Key', TWILIO_CONNECTOR_KEY!);
      return fetch(`${twilioGateway}${path}`, { ...init, headers });
    }
    throw new Error('No auth configured');
  };

  try {
    const body = await req.json();
    const {
      action, country = 'US', numberType = 'local', areaCode, prefix,
      phoneNumber, business, agentId, agentName, quantity = 1
    } = body;

    // STATUS CHECK
    if (action === 'status') {
      try {
        const res = hasDirectAuth
          ? await fetch(`${twilioBase}/Accounts/${TWILIO_SID}.json`, {
              headers: { Authorization: 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`) }
            })
          : await callTwilio('/IncomingPhoneNumbers.json?PageSize=1');
        const data = await res.json().catch(() => ({}));
        return new Response(JSON.stringify({
          connected: res.ok,
          accountName: authMode === 'connector' ? 'Twilio Connector' : data.friendly_name || 'Twilio',
          accountSid: authMode === 'connector' ? null : data.sid,
          status: res.ok ? 'connected' : 'not_connected',
          authMode,
          error: res.ok ? null : data,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({
          connected: false, status: 'error', error: String(e), authMode,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // SYNC — Pull all active numbers from Twilio into dc_phone_numbers
    if (action === 'sync') {
      const res = await callTwilio('/IncomingPhoneNumbers.json?PageSize=50');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return new Response(JSON.stringify({
          error: 'Sync failed', details: data, httpStatus: res.status
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const numbers = data.incoming_phone_numbers || [];
      const saved: string[] = [];

      for (const num of numbers) {
        const pn = num.phone_number || '';
        const isTollFree = /^\+1(800|888|877|866|855|844|833)/.test(pn);
        const isDR = /^\+1(809|829|849)/.test(pn);

        if (SUPABASE_URL && SUPABASE_KEY) {
          await fetch(`${SUPABASE_URL}/rest/v1/dc_phone_numbers`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
            },
            body: JSON.stringify({
              phone_number: pn,
              twilio_sid: num.sid,
              friendly_name: num.friendly_name,
              is_active: true,
              monthly_cost: isDR ? 5.00 : isTollFree ? 2.00 : 1.00,
              business: 'unassigned',
            }),
          });
        }
        saved.push(pn);
      }

      return new Response(JSON.stringify({
        success: true, synced: saved.length, numbers: saved
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // SEARCH NUMBERS
    if (action === 'search') {
      let path = '';
      if (country === 'DO') {
        const drAreaCode = areaCode || '809';
        path = `/AvailablePhoneNumbers/US/Local.json?AreaCode=${drAreaCode}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      } else if (numberType === 'tollfree') {
        path = '/AvailablePhoneNumbers/US/TollFree.json?VoiceEnabled=true&SmsEnabled=true&Limit=5';
        if (prefix) path += `&Contains=${prefix}*******`;
      } else {
        path = `/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode || '929'}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      }

      const res = await callTwilio(path);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return new Response(JSON.stringify({
          error: 'Search failed', details: data, httpStatus: res.status
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const numbers = (data.available_phone_numbers || []).map((n: any) => ({
        phoneNumber: n.phone_number,
        friendlyName: n.friendly_name,
        locality: n.locality,
        region: n.region || country,
        country,
        capabilities: n.capabilities,
        monthlyCost: country === 'DO' ? 5.00 : numberType === 'tollfree' ? 2.00 : 1.00,
      }));

      return new Response(JSON.stringify({ success: true, numbers, total: numbers.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
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

        const res = await callTwilio('/IncomingPhoneNumbers.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form,
        });
        const purchased = await res.json().catch(() => ({}));

        if (res.ok && SUPABASE_URL && SUPABASE_KEY) {
          const monthlyCost = country === 'DO' ? 5.00 : numberType === 'tollfree' ? 2.00 : 1.00;
          await fetch(`${SUPABASE_URL}/rest/v1/dc_phone_numbers`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates,return=minimal',
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

    // ASSIGN — Update business/agent for existing number
    if (action === 'assign') {
      const { phoneNumberId, business: biz, agentId: aid, agentName: aname } = body;
      if (!phoneNumberId) {
        return new Response(JSON.stringify({ error: 'phoneNumberId required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (SUPABASE_URL && SUPABASE_KEY) {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/dc_phone_numbers?id=eq.${phoneNumberId}`,
          {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              business: biz || 'unassigned',
              assigned_agent_id: aid || null,
              assigned_agent_name: aname || null,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.text();
          return new Response(JSON.stringify({ error: 'Assign failed', details: err }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
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
