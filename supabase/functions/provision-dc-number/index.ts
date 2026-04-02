const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')?.trim();
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')?.trim();
const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')?.trim();
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')?.trim();
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
const twilioBase = 'https://api.twilio.com/2010-04-01';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const inferMonthlyCost = (phoneNumber: string) => {
  if (/^\+1(800|888|877|866|855|844|833)/.test(phoneNumber)) return 2.0;
  return 1.0;
};

const getAuthHeader = () => 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

const twilioFetch = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Authorization', getAuthHeader());
  return fetch(`${twilioBase}/Accounts/${TWILIO_ACCOUNT_SID}${path}`, { ...init, headers });
};

const upsertPhoneNumber = async (payload: Record<string, unknown>) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_BACKEND_NOT_CONFIGURED');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/dc_phone_numbers`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`DB_UPSERT_FAILED:${await response.text()}`);
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return json({
      error: 'TWILIO_NOT_CONFIGURED',
      message: 'Twilio credentials are not configured.',
      checkedSecretNames: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
    }, 401);
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
      quantity = 1,
      phoneNumberId,
      phoneNumberValue,
      twilioSid,
      businessName,
    } = body ?? {};

    if (action === 'status') {
      const res = await fetch(`${twilioBase}/Accounts/${TWILIO_ACCOUNT_SID}.json`, {
        headers: { Authorization: getAuthHeader() },
      });
      const data = await res.json().catch(() => ({}));
      return json({
        connected: res.ok,
        accountName: data.friendly_name || 'Twilio',
        accountSid: data.sid || null,
        error: res.ok ? null : data,
      });
    }

    if (action === 'sync') {
      const res = await twilioFetch('/IncomingPhoneNumbers.json?PageSize=100');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return json({ error: 'Sync failed', details: data, httpStatus: res.status }, 400);
      }

      const numbers = data.incoming_phone_numbers || [];
      const saved: Array<{ number: string; name: string; sid: string }> = [];

      for (const num of numbers) {
        await upsertPhoneNumber({
          phone_number: num.phone_number,
          twilio_sid: num.sid,
          friendly_name: num.friendly_name,
          is_active: true,
          business: 'unassigned',
          monthly_cost: inferMonthlyCost(num.phone_number || ''),
        });

        saved.push({
          number: num.phone_number,
          name: num.friendly_name,
          sid: num.sid,
        });
      }

      return json({ success: true, synced: saved.length, numbers: saved });
    }

    if (action === 'search') {
      let path = '';

      if (country === 'DO') {
        path = `/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode || '809'}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      } else if (numberType === 'tollfree') {
        path = '/AvailablePhoneNumbers/US/TollFree.json?VoiceEnabled=true&SmsEnabled=true&Limit=5';
        if (prefix) path += `&Contains=${prefix}*******`;
      } else {
        path = `/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode || '929'}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      }

      const res = await twilioFetch(path);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return json({ error: 'Search failed', details: data, httpStatus: res.status }, 400);
      }

      const numbers = (data.available_phone_numbers || []).map((n: any) => ({
        phoneNumber: n.phone_number,
        friendlyName: n.friendly_name,
        locality: n.locality,
        region: n.region || country,
        country,
        capabilities: n.capabilities,
        monthlyCost: country === 'DO' ? 5.0 : numberType === 'tollfree' ? 2.0 : 1.0,
      }));

      return json({ success: true, numbers, total: numbers.length });
    }

    if (action === 'purchase') {
      if (!phoneNumber) return json({ error: 'phoneNumber is required' }, 400);
      if (!SUPABASE_URL) return json({ error: 'SUPABASE_BACKEND_NOT_CONFIGURED' }, 500);

      const numbersToBuy = Array.isArray(phoneNumber) ? phoneNumber : [phoneNumber];
      const results = [];
      const webhookUrl = `${SUPABASE_URL}/functions/v1/twilio-inbound-call`;
      const qty = parseInt(String(quantity), 10) || 1;

      for (let i = 0; i < Math.min(qty, numbersToBuy.length); i += 1) {
        const numberToBuy = numbersToBuy[i];
        if (!numberToBuy) break;

        const form = new URLSearchParams({
          PhoneNumber: numberToBuy,
          FriendlyName: `${business || 'Dynasty'} — ${agentName || 'AI Agent'}${qty > 1 ? ` #${i + 1}` : ''}`,
          VoiceUrl: webhookUrl,
          VoiceMethod: 'POST',
        });

        const res = await twilioFetch('/IncomingPhoneNumbers.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form,
        });
        const purchased = await res.json().catch(() => ({}));

        if (!res.ok) {
          results.push({ success: false, error: purchased });
          continue;
        }

        const monthlyCost = country === 'DO' ? 5.0 : numberType === 'tollfree' ? 2.0 : 1.0;
        await upsertPhoneNumber({
          phone_number: purchased.phone_number,
          twilio_sid: purchased.sid,
          friendly_name: purchased.friendly_name,
          is_active: true,
          business: business || 'unassigned',
          assigned_agent_id: agentId || null,
          assigned_agent_name: agentName || null,
          monthly_cost: monthlyCost,
        });

        results.push({ success: true, number: purchased.phone_number, sid: purchased.sid });
      }

      return json({ success: true, results });
    }

    if (action === 'assign') {
      if (!phoneNumberId) return json({ error: 'phoneNumberId required' }, 400);
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'SUPABASE_BACKEND_NOT_CONFIGURED' }, 500);

      const res = await fetch(`${SUPABASE_URL}/rest/v1/dc_phone_numbers?id=eq.${phoneNumberId}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          business: business || 'unassigned',
          assigned_agent_id: agentId || null,
          assigned_agent_name: agentName || null,
        }),
      });

      if (!res.ok) {
        return json({ error: 'Assign failed', details: await res.text() }, 400);
      }

      return json({ success: true });
    }

    if (action === 'import_to_elevenlabs') {
      if (!ELEVENLABS_API_KEY) return json({ error: 'ELEVENLABS_NOT_CONFIGURED' }, 400);
      if (!phoneNumberValue || !twilioSid || !agentId) return json({ error: 'phoneNumberValue, twilioSid, and agentId are required' }, 400);

      const res = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          label: `${businessName || business || 'Business'} - ${agentName || 'AI Agent'}`,
          phone_number: phoneNumberValue,
          sid: twilioSid,
          token: TWILIO_AUTH_TOKEN,
          type: 'twilio',
          agent_id: agentId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return json({ error: 'ElevenLabs import failed', details: data, httpStatus: res.status }, 400);
      }

      return json({ success: true, data });
    }

    return json({ error: 'Invalid action' }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
