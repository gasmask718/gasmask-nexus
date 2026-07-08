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

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) {
    return new Response(JSON.stringify({ error: "twilio creds missing", have_sid: !!sid, have_token: !!token }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const target = "+12142394316";
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(target)}`;
  const res = await fetch(url, {
    headers: { Authorization: "Basic " + btoa(`${sid}:${token}`) },
  });
  const body = await res.text();
  let parsed: any = null;
  try { parsed = JSON.parse(body); } catch (_) {}
  const numbers = (parsed?.incoming_phone_numbers || []).map((n: any) => ({
    sid: n.sid,
    phone_number: n.phone_number,
    friendly_name: n.friendly_name,
    account_sid: n.account_sid,
    date_created: n.date_created,
    voice_url: n.voice_url,
  }));

  return new Response(JSON.stringify({
    ok: res.ok,
    status: res.status,
    query: target,
    count: numbers.length,
    numbers,
    raw_if_empty: numbers.length === 0 ? parsed : undefined,
  }, null, 2), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
