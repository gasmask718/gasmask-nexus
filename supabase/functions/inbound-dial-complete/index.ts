/**
 * INBOUND DIAL COMPLETE — <Dial action> callback for the humans-first engine.
 *
 * Twilio posts DialCallStatus after each human-ring leg:
 *   completed              → a human (or AI DID leg) answered and the call
 *                            ended → log 'answered', <Hangup/>.
 *   no-answer/busy/failed/canceled → sequential strategy: ring the next
 *                            ring_order stage; after the last stage, fall
 *                            through to the AI fallback (concierge by default).
 *
 * Query params carried from the dial leg: cid (va_company), from, to,
 * stage (just-finished 1-based stage), total stages.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, readForm, verifyTwilio, escapeXml } from "../_shared/dialer.ts";
import { patchCallLog } from "../_shared/gasmaskVoice.ts";
import {
  InboundPolicy,
  buildRingLegs,
  clampRingSeconds,
  groupLegs,
  legsToTwiml,
  logRingLeg,
  withinPolicyHours,
} from "../_shared/inboundRouting.ts";
import { aiFallbackTwiml, functionsBase, twiml } from "../_shared/inboundVoiceMain.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[inbound-dial-complete] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const dialStatus = params.DialCallStatus || "unknown";
  const url = new URL(req.url);
  const cid = url.searchParams.get("cid") || "";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";
  const stage = parseInt(url.searchParams.get("stage") || "1", 10);
  const total = parseInt(url.searchParams.get("total") || "1", 10);

  console.log(`[inbound-dial-complete] sid=${callSid} stage=${stage}/${total} status=${dialStatus}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const base = functionsBase(req);

  // ── A human (or bridged AI) answered ──
  if (dialStatus === "completed") {
    await logRingLeg(supabase, callSid, {
      stage: `stage-${stage}`,
      legs: [],
      result: `answered (DialCallSid=${params.DialCallSid || "?"})`,
      at: new Date().toISOString(),
    });
    await patchCallLog(supabase, callSid, { status: "answered" });
    return twiml(`<Hangup/>`);
  }

  await logRingLeg(supabase, callSid, {
    stage: `stage-${stage}`,
    legs: [],
    result: dialStatus,
    at: new Date().toISOString(),
  });

  // ── Load company + policy ──
  const { data: company } = await supabase
    .from("va_companies")
    .select("id, slug, name")
    .eq("id", cid)
    .maybeSingle();
  const { data: policy } = await supabase
    .from("inbound_policy")
    .select("*")
    .eq("va_company_id", cid)
    .maybeSingle();
  const pol = (policy as InboundPolicy) || null;

  // ── Sequential: ring the next stage ──
  if (company && pol && pol.ring_strategy === "sequential" && stage < total) {
    const withinHours = withinPolicyHours(pol);
    const legs = await buildRingLegs(supabase, company.id, withinHours);
    const stages = groupLegs(legs);
    const next = stages[stage]; // 0-based: stage just finished = index stage-1
    if (next && next.length) {
      const ringSeconds = clampRingSeconds(pol.ring_seconds);
      await logRingLeg(supabase, callSid, {
        stage: `stage-${stage + 1}`,
        legs: next.map((l) => ({ label: l.label, kind: l.kind, value: l.value })),
        at: new Date().toISOString(),
      });
      const actionUrl = `${base}/inbound-dial-complete?cid=${encodeURIComponent(cid)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&stage=${stage + 1}&total=${total}`;
      return twiml(`
  <Dial answerOnBridge="true" timeout="${ringSeconds}" callerId="${escapeXml(to)}"
        action="${escapeXml(actionUrl)}" method="POST">
    ${legsToTwiml(next)}
  </Dial>`);
    }
  }

  // ── Nobody answered anywhere → AI fallback ──
  console.log(`[inbound-dial-complete] ${company?.slug || cid}: humans missed → AI fallback`);
  await patchCallLog(supabase, callSid, { status: "ai-fallback" });
  return twiml(aiFallbackTwiml({
    base,
    policy: pol,
    company: company ? { ...company, policy: pol } : null,
  }));
});
