/**
 * INBOUND CONCIERGE — START.
 *
 * The AI fallback when no human answers (or after hours). This is a
 * CONVERSATION, not a voicemail: the caller is identified against
 * store_contacts / stores by their number, greeted by name where known,
 * and the speech loop (inbound-concierge-turn) takes messages, books
 * callbacks, records reorder intent and captures address corrections.
 *
 * State: one inbound_concierge_sessions row per CallSid.
 * Outcomes: inbound_call_outcomes rows + the communication_logs call row,
 * so a human sees exactly what happened the next morning.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, readForm, verifyTwilio, escapeXml } from "../_shared/dialer.ts";
import { matchCaller, normalizePhone, upsertCallLog } from "../_shared/gasmaskVoice.ts";
import { functionsBase, twiml } from "../_shared/inboundVoiceMain.ts";

export function defaultGreeting(companyName: string): string {
  return `Thanks for calling ${companyName}. Nobody is free this second, but I can help right now — what do you need?`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[inbound-concierge-start] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const from = normalizePhone(params.From || "");
  const to = normalizePhone(params.To || "");
  const cid = new URL(req.url).searchParams.get("cid") || "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const base = functionsBase(req);

  const { data: company } = await supabase
    .from("va_companies")
    .select("id, slug, name")
    .eq("id", cid)
    .maybeSingle();
  const { data: policy } = await supabase
    .from("inbound_policy")
    .select("ai_greeting")
    .eq("va_company_id", cid)
    .maybeSingle();

  const companyName = company?.name || "us";
  const match = await matchCaller(supabase, from);

  // Session row (idempotent on CallSid — a re-entry replaces the old state).
  const { error: sessErr } = await supabase
    .from("inbound_concierge_sessions")
    .upsert({
      call_sid: callSid,
      va_company_id: cid || null,
      from_number: from,
      to_number: to,
      store_id: match.store_id,
      store_name: match.store_name,
      contact_name: match.contact_name,
      transcript: [],
      status: "active",
      ended_at: null,
    }, { onConflict: "call_sid" });
  if (sessErr) console.error("[concierge-start] session upsert failed:", sessErr.message);

  await upsertCallLog(supabase, {
    callSid,
    from,
    to,
    status: "ai-concierge",
    brand: company?.slug || "unknown",
    summary: `AI concierge — ${match.store_name || match.contact_name || from} (${companyName})`,
    extra: {
      metadata: {
        company: company?.slug,
        concierge: true,
        store_name: match.store_name,
        contact_name: match.contact_name,
      },
    },
  });

  const greeting = (policy?.ai_greeting && policy.ai_greeting.trim()) || defaultGreeting(companyName);
  const turnUrl = `${base}/inbound-concierge-turn?cid=${encodeURIComponent(cid)}`;

  console.log(`[concierge-start] sid=${callSid} company=${company?.slug} store=${match.store_name || "?"}`);

  // The greeting sits INSIDE the Gather so the caller can barge in.
  // Two silent-turn reprompts, then a polite close.
  return twiml(`
  <Gather input="speech" action="${escapeXml(turnUrl)}" method="POST"
          timeout="6" speechTimeout="auto" language="en-US">
    <Say voice="alice">${escapeXml(greeting)}</Say>
  </Gather>
  <Gather input="speech" action="${escapeXml(turnUrl)}" method="POST"
          timeout="6" speechTimeout="auto" language="en-US">
    <Say voice="alice">Sorry, I didn't hear anything. Tell me what you need — for example, a callback, or a reorder.</Say>
  </Gather>
  <Say voice="alice">No problem — call us back any time. Goodbye.</Say>
  <Hangup/>`);
});
