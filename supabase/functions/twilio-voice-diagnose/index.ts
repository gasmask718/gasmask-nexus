// Temporary read-only diagnostic for Voice SDK tokenInvalid (20101).
// Cross-tests credential pairs to find which account each credential belongs to.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const mask = (v?: string) => (!v ? 'MISSING' : `${v.slice(0, 6)}...${v.slice(-4)} (${v.length})`);
const env = (k: string) => Deno.env.get(k) ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const accounts = {
    MAIN: env('TWILIO_ACCOUNT_SID'),
    BRANDARO: env('BRANDARO_TWILIO_ACCOUNT_SID'),
  };
  const creds: Record<string, [string, string]> = {
    MAIN_AUTHTOKEN: [env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN')],
    MAIN_APIKEY: [env('TWILIO_API_SID'), env('TWILIO_API_SECRET')],
    BRANDARO_AUTHTOKEN: [env('BRANDARO_TWILIO_ACCOUNT_SID'), env('BRANDARO_TWILIO_AUTH_TOKEN')],
    BRANDARO_APIKEY: [env('BRANDARO_TWILIO_API_KEY_SID'), env('BRANDARO_TWILIO_API_KEY_SECRET')],
  };

  const out: Record<string, unknown> = {
    masked: {
      MAIN_ACCOUNT: mask(accounts.MAIN),
      BRANDARO_ACCOUNT: mask(accounts.BRANDARO),
      MAIN_API_SID: mask(env('TWILIO_API_SID')),
      BRANDARO_API_SID: mask(env('BRANDARO_TWILIO_API_KEY_SID')),
      MAIN_TWIML_APP: mask(env('TWILIO_TWIML_APP_SID')),
      BRANDARO_TWIML_APP: mask(env('BRANDARO_TWILIO_TWIML_APP_SID')),
    },
  };

  const results: Record<string, unknown> = {};
  for (const [credName, [user, pass]] of Object.entries(creds)) {
    if (!user || !pass) { results[credName] = 'missing'; continue; }
    for (const [acctName, acct] of Object.entries(accounts)) {
      if (!acct) continue;
      try {
        const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}.json`, {
          headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}` },
        });
        const t = await r.text();
        let summary = t.slice(0, 300);
        if (r.ok) {
          const j = JSON.parse(t);
          summary = JSON.stringify({ friendly_name: j.friendly_name, status: j.status, type: j.type });
        }
        results[`${credName}__on__${acctName}`] = { status: r.status, summary };
      } catch (e) {
        results[`${credName}__on__${acctName}`] = { error: String(e) };
      }
    }
  }
  out.matrix = results;

  // If a working cred exists, pull balance + TwiML apps + keys
  const working = Object.entries(results).find(([, v]) => (v as any)?.status === 200);
  if (working) {
    const [name] = working[0].split('__on__');
    const acctName = working[0].split('__on__')[1] as keyof typeof accounts;
    const [user, pass] = creds[name];
    const acct = accounts[acctName];
    const auth = { Authorization: `Basic ${btoa(`${user}:${pass}`)}` };
    const get = async (p: string) => {
      const r = await fetch(`https://api.twilio.com${p}`, { headers: auth });
      return { status: r.status, body: (await r.text()).slice(0, 1500) };
    };
    out.working_cred = { cred: name, account: acctName };
    out.balance = await get(`/2010-04-01/Accounts/${acct}/Balance.json`);
    out.twiml_apps = await get(`/2010-04-01/Accounts/${acct}/Applications.json?PageSize=20`);
    out.keys = await get(`/2010-04-01/Accounts/${acct}/Keys.json?PageSize=20`);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
