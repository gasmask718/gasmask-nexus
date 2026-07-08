// One-shot read-only Twilio lookup for T7c-A Phase 1.
// Fetches the IncomingPhoneNumber SID for +12142394316 (BRANDARO DALLAS 1)
// so the Phase 1 backfill migration can insert with a real twilio_sid.
// DELETE after T7c-A closes.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Check BOTH Twilio accounts: primary (DC) and Brandaro-dedicated.
  const accounts = [
    { label: "primary", sid: Deno.env.get("TWILIO_ACCOUNT_SID"), token: Deno.env.get("TWILIO_AUTH_TOKEN") },
    { label: "brandaro", sid: Deno.env.get("BRANDARO_TWILIO_ACCOUNT_SID"), token: Deno.env.get("BRANDARO_TWILIO_AUTH_TOKEN") },
  ];

  const target = "+12142394316";
  const results: any[] = [];
  for (const acct of accounts) {
    if (!acct.sid || !acct.token) {
      results.push({ account: acct.label, skipped: "creds missing", have_sid: !!acct.sid, have_token: !!acct.token });
      continue;
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${acct.sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(target)}`;
    const res = await fetch(url, { headers: { Authorization: "Basic " + btoa(`${acct.sid}:${acct.token}`) } });
    const body = await res.text();
    let parsed: any = null;
    try { parsed = JSON.parse(body); } catch (_) {}
    const numbers = (parsed?.incoming_phone_numbers || []).map((n: any) => ({
      sid: n.sid, phone_number: n.phone_number, friendly_name: n.friendly_name,
      account_sid: n.account_sid, date_created: n.date_created, voice_url: n.voice_url,
    }));
    results.push({
      account: acct.label,
      account_sid_prefix: acct.sid.slice(0, 8),
      http_status: res.status,
      count: numbers.length,
      numbers,
    });
  }

  return new Response(JSON.stringify({ query: target, results }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
