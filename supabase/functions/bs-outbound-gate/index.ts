/**
 * bs-outbound-gate — BrightSun Solar TwiML-side enforcement point.
 *
 * SCOPE: BrightSun Solar Hub only.
 *
 * Every BrightSun outbound call is placed with `Url` pointed HERE, not at the
 * bridge. Twilio fetches this endpoint at answer time; nothing is spoken and
 * nothing is dialed until this function returns TwiML. The gate therefore runs
 * on the TwiML side — a JSON "blocked" flag in the initiating function can be
 * bypassed by anyone who can place a call, this cannot.
 *
 * Flow:
 *   1. Verify X-Twilio-Signature (fails closed, 403 = no TwiML = no audio).
 *   2. Re-run `bsOutboundGate()` against the live `To` number.
 *   3. PASS  -> <Redirect> to the real downstream TwiML (bridge / gather).
 *      REFUSE -> <Hangup/>, refusal already logged with reason + caller.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { readForm, verifyTwilio } from "../_shared/dialer.ts";
import { bsOutboundGate, decodeTarget } from "../_shared/bsOutboundGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};
const xmlHeaders = { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const q = url.searchParams;

  const isForm = (req.headers.get("content-type") || "").includes(
    "application/x-www-form-urlencoded",
  );
  const params: Record<string, string> = isForm ? await readForm(req) : {};

  // ── 1. Signature. Fails closed. ──
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[bs-outbound-gate] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const to = params.To || q.get("to") || "";
  const caller = q.get("caller") || "bs-outbound-gate";

  // ── 2. Re-run the gate against the live destination. ──
  const decision = await bsOutboundGate({
    supabase,
    phone: to,
    state: q.get("state"),
    channel: "voice",
    caller: `${caller}:twiml`,
    leadId: q.get("lead_id"),
    contactId: q.get("contact_id"),
    metadata: {
      call_sid: params.CallSid || null,
      batch_id: q.get("batch_id"),
      queue_item_id: q.get("queue_item_id"),
      enforcement: "twiml",
    },
  });

  if (!decision.allowed) {
    console.warn(`[bs-outbound-gate] hangup — ${decision.reasonCode}`);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
      { headers: xmlHeaders },
    );
  }

  // ── 3. Hand off to the real TwiML. ──
  const encoded = q.get("bs_target") || "";
  const target = encoded ? decodeTarget(encoded) : null;
  if (!target) {
    console.error("[bs-outbound-gate] missing/undecodable bs_target — refusing");
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
      { headers: xmlHeaders },
    );
  }

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${
      escapeXml(target)
    }</Redirect></Response>`,
    { headers: xmlHeaders },
  );
});
