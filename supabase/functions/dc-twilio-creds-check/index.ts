// Read-only diagnostic: verifies the TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
// pair by calling Twilio's Account fetch endpoint. Returns format info + status.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sid = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
  const token = Deno.env.get('TWILIO_AUTH_TOKEN') || '';

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
  if (sid && token) {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      { headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` } }
    );
    const body = await r.text();
    twilio = {
      status: r.status,
      ok: r.ok,
      body_snippet: body.slice(0, 400),
    };
  }

  return new Response(JSON.stringify({ diag, twilio }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
