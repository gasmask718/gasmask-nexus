// Read-only diagnostic for the Brandaro Twilio account.
// Verifies BRANDARO_TWILIO_ACCOUNT_SID + BRANDARO_TWILIO_AUTH_TOKEN against
// Twilio's Account fetch endpoint and surfaces account status (active / suspended).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sid = Deno.env.get('BRANDARO_TWILIO_ACCOUNT_SID') || '';
  const token = Deno.env.get('BRANDARO_TWILIO_AUTH_TOKEN') || '';

  const diag = {
    sid_present: !!sid,
    sid_prefix: sid.slice(0, 4),
    sid_length: sid.length,
    sid_starts_with_AC: sid.startsWith('AC'),
    sid_has_whitespace: /\s/.test(sid),
    token_present: !!token,
    token_length: token.length,
    token_has_whitespace: /\s/.test(token),
  };

  let twilio: any = { skipped: 'no creds' };
  let balance: any = null;
  if (sid && token) {
    const auth = `Basic ${btoa(`${sid}:${token}`)}`;
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      { headers: { Authorization: auth } }
    );
    const body = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(body); } catch { /* noop */ }
    twilio = {
      status: r.status,
      ok: r.ok,
      account_status: parsed?.status ?? null,
      account_type: parsed?.type ?? null,
      friendly_name: parsed?.friendly_name ?? null,
      body_snippet: body.slice(0, 400),
    };

    // Balance is the funding-state signal (suspended/unfunded accounts often show $0 + status!=active)
    const br = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`,
      { headers: { Authorization: auth } }
    );
    const bbody = await br.text();
    let bparsed: any = null;
    try { bparsed = JSON.parse(bbody); } catch { /* noop */ }
    balance = {
      status: br.status,
      ok: br.ok,
      balance: bparsed?.balance ?? null,
      currency: bparsed?.currency ?? null,
      body_snippet: bbody.slice(0, 200),
    };
  }

  return new Response(JSON.stringify({ diag, twilio, balance }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
