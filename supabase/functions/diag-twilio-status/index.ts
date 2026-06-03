// Temporary diagnostic - safe to delete after use
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TOK = Deno.env.get('TWILIO_AUTH_TOKEN');
  const FROM = Deno.env.get('TT_PHONE_NUMBER');
  const DAVID = Deno.env.get('DAVID_PHONE_NUMBER');
  if (!SID || !TOK) {
    return new Response(JSON.stringify({ error: 'missing creds', has_sid: !!SID, has_tok: !!TOK, FROM, DAVID }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json?PageSize=20`;
  const r = await fetch(url, { headers: { Authorization: `Basic ${btoa(`${SID}:${TOK}`)}` } });
  const j = await r.json();
  const slim = (j.messages || []).map((m: any) => ({
    date: m.date_created, to: m.to, from: m.from, status: m.status, error_code: m.error_code, error_message: m.error_message, body: (m.body||'').slice(0,60)
  }));
  return new Response(JSON.stringify({ FROM, DAVID_set: !!DAVID, DAVID_value: DAVID, SID_prefix: SID.slice(0,4), messages: slim }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
