// POWER DIAL TWIML — the customer leg's instructions while AMD resolves.
// The callee hears a short greeting then hold audio. When the AMD verdict
// arrives at dialer-call-status: human → dialer-bridge-agent redirects this
// leg into the conference; machine → that handler hangs this leg up.
// Signed-request only (verifyTwilio, fail closed).

import { xmlHeaders, verifyTwilio, readForm } from "../_shared/dialer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: xmlHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    return new Response("Forbidden", { status: 403, headers: xmlHeaders });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hi, one moment please, connecting you now.</Say>
  <Play loop="6">http://twimlets.com/holdmusic?Bucket=com.twilio.music.soft-rock</Play>
  <Hangup/>
</Response>`;
  return new Response(twiml.trim(), { headers: xmlHeaders });
});
