// POWER DIAL TWIML — the customer leg's instructions while AMD resolves.
// The callee hears a short greeting then is HELD on the line. When the AMD
// verdict arrives at dialer-call-status: human → dialer-bridge-agent
// redirects this leg into the conference; machine → that handler hangs this
// leg up.
//
// 2026-08-24: twimlets.com hold music is dead — Twilio retired Twimlets and
// the URL 301s to a deprecation page, so <Play> failed and the call fell
// straight through to <Hangup/> ~3s after answer, BEFORE AsyncAMD could
// classify. No verdict ever fired. Hold is now <Say>/<Pause> only — no
// external audio — and the line stays up well past the AMD window. A bridge
// redirect via REST interrupts a <Pause> at any point, so holding here does
// not delay a human bridge.
// Signed-request only (verifyTwilio, fail closed).

import { xmlHeaders, verifyTwilio, readForm } from "../_shared/dialer.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: xmlHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    return new Response("Forbidden", { status: 403, headers: xmlHeaders });
  }

  const purpose = new URL(req.url).searchParams.get("purpose");

  // Live-mode unlock test: hold the line well past the AMD window so the
  // verdict lands while the call is still up, then close politely.
  const twiml = purpose === "live_mode_test"
    ? `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hi, one moment please, connecting you now.</Say>
  <Pause length="12"/>
  <Say voice="Polly.Joanna">Live mode test complete. Your dialer webhook pipeline is working. You can hang up now.</Say>
  <Pause length="5"/>
  <Hangup/>
</Response>`
    : `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">Hi, one moment please, connecting you now.</Say>
  <Pause length="3"/>
  <Say voice="Polly.Joanna">Still connecting you, thank you for holding.</Say>
  <Pause length="6"/>
  <Say voice="Polly.Joanna">One more moment please.</Say>
  <Pause length="10"/>
  <Say voice="Polly.Joanna">I'm sorry, nobody is available to take your call right now. We will call you back shortly. Goodbye.</Say>
  <Hangup/>
</Response>`;

  return new Response(twiml.trim(), { headers: xmlHeaders });
});
