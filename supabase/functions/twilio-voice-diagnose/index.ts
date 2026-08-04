// Temporary read-only diagnostic for Voice SDK tokenInvalid (20101).
// Verifies account status/balance, API key validity, and TwiML App existence.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const mask = (v?: string) => (!v ? 'MISSING' : `${v.slice(0, 6)}...${v.slice(-4)} (${v.length})`);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
  const AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
  const API_SID = Deno.env.get('TWILIO_API_SID') ?? '';
  const API_SECRET = Deno.env.get('TWILIO_API_SECRET') ?? '';
  const APP_SID = Deno.env.get('TWILIO_TWIML_APP_SID') ?? '';

  const out: Record<string, unknown> = {
    masked: {
      ACCOUNT_SID: mask(ACCOUNT_SID),
      AUTH_TOKEN: mask(AUTH_TOKEN),
      API_SID: mask(API_SID),
      API_SECRET: mask(API_SECRET),
      TWIML_APP_SID: mask(APP_SID),
    },
    prefixes: {
      account_ok: /^AC[a-f0-9]{32}$/i.test(ACCOUNT_SID),
      api_key_ok: /^SK[a-f0-9]{32}$/i.test(API_SID),
      app_ok: /^AP[a-f0-9]{32}$/i.test(APP_SID),
    },
  };

  const call = async (label: string, path: string, user: string, pass: string) => {
    try {
      const r = await fetch(`https://api.twilio.com${path}`, {
        headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
      });
      const text = await r.text();
      out[label] = { status: r.status, body: text.slice(0, 600) };
    } catch (e) {
      out[label] = { error: String(e) };
    }
  };

  if (ACCOUNT_SID && AUTH_TOKEN) {
    await call('account_via_authtoken', `/2010-04-01/Accounts/${ACCOUNT_SID}.json`, ACCOUNT_SID, AUTH_TOKEN);
    await call('balance_via_authtoken', `/2010-04-01/Accounts/${ACCOUNT_SID}/Balance.json`, ACCOUNT_SID, AUTH_TOKEN);
  }
  if (ACCOUNT_SID && API_SID && API_SECRET) {
    await call('account_via_apikey', `/2010-04-01/Accounts/${ACCOUNT_SID}.json`, API_SID, API_SECRET);
    await call('apikey_lookup', `/2010-04-01/Accounts/${ACCOUNT_SID}/Keys/${API_SID}.json`, API_SID, API_SECRET);
    if (APP_SID) {
      await call('twiml_app', `/2010-04-01/Accounts/${ACCOUNT_SID}/Applications/${APP_SID}.json`, API_SID, API_SECRET);
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
