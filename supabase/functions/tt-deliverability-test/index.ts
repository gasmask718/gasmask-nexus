// Diagnostic: send SMS from GasMask 877 and poll delivery status
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  if (!sid || !token) {
    return new Response(JSON.stringify({ error: "missing twilio creds", sid: !!sid, token: !!token }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const auth = "Basic " + btoa(`${sid}:${token}`);

  const body = new URLSearchParams({
    From: "+18776818621",
    To: "+19174643048",
    Body: "TopTier outbound delivery test from GasMask 877. Reply not needed. Test ID: " + new Date().toISOString(),
  });

  const createRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const createJson = await createRes.json();
  const messageSid = createJson.sid;

  if (!messageSid) {
    return new Response(JSON.stringify({ phase: "create", status: createRes.status, response: createJson }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // poll up to 30s
  let finalJson: any = createJson;
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages/${messageSid}.json`, { headers: { Authorization: auth } });
    finalJson = await r.json();
    if (["delivered", "undelivered", "failed", "sent"].includes(finalJson.status)) {
      if (["delivered", "undelivered", "failed"].includes(finalJson.status)) break;
    }
  }

  return new Response(JSON.stringify({
    create_status: createRes.status,
    sid: messageSid,
    initial_status: createJson.status,
    final_status: finalJson.status,
    error_code: finalJson.error_code,
    error_message: finalJson.error_message,
    from: finalJson.from,
    to: finalJson.to,
  }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
