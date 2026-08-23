/**
 * HUMANS-FIRST INBOUND VOICE — the main handler shared by dc-inbound-call and
 * twilio-inbound-call (identical thin wrappers).
 *
 * Flow per call:
 *   1. Resolve To-number → va_company → inbound_policy.
 *   2. ring_humans_first + inside business hours (or !after_hours_ai_only)
 *      → <Dial> active inbound_ring_targets (browser softphones for on-shift
 *        VAs via <Client>, mobiles/desks via <Number>), simultaneous or
 *        sequential by ring_order, timeout = ring_seconds.
 *   3. No answer / after hours → AI fallback: policy.ai_agent_id (explicit
 *        Bland DID bridge) or the in-house concierge (inbound-concierge-start).
 *   4. vm=1 means this is already the AI-fallback leg of another handler
 *      (gasmask-inbound-voice) — never ring humans twice.
 *   5. Numbers with no va_company_id keep the LEGACY Bland-DID behaviour.
 *
 * Every call + every ring leg lands in communication_logs (ring_legs in
 * metadata) so the morning after shows: rang humans, who picked up, or AI.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, readForm, verifyTwilio, canonicalUrl, escapeXml } from "./dialer.ts";
import { matchCaller, normalizePhone, upsertCallLog } from "./gasmaskVoice.ts";
import {
  InboundCompany,
  InboundPolicy,
  RingLeg,
  buildRingLegs,
  clampRingSeconds,
  groupLegs,
  legsToTwiml,
  logRingLeg,
  resolveInboundCompany,
  withinPolicyHours,
} from "./inboundRouting.ts";

const ENV_FALLBACK_DID: Record<string, string | undefined> = {
  gasmask: "GASMASK_BLAND_INBOUND_NUMBER",
  unforgettable_times: "UT_BLAND_INBOUND_NUMBER",
  real_estate: "RE_BLAND_INBOUND_NUMBER",
  surplus_funds: "SF_BLAND_INBOUND_NUMBER",
  top_tier: "TT_BLAND_INBOUND_NUMBER",
  brandaro: "BRANDARO_BLAND_INBOUND_NUMBER",
  iclean: "ICLEAN_BLAND_INBOUND_NUMBER",
};

export function twiml(body: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${body}\n</Response>`,
    { headers: { ...corsHeaders, "Content-Type": "text/xml" } },
  );
}

export function functionsBase(req: Request): string {
  const u = new URL(canonicalUrl(req));
  return `${u.protocol}//${u.host}/functions/v1`;
}

/**
 * The AI fallback leg. Order:
 *   1. policy.ai_fallback === false → polite hangup (no AI, no humans).
 *   2. policy.ai_agent_id set → bridge to that AI agent DID (Bland).
 *   3. default → in-house concierge: a conversation, not a voicemail.
 */
export function aiFallbackTwiml(opts: {
  base: string;
  policy: InboundPolicy | null;
  company: InboundCompany | null;
}): string {
  const { base, policy, company } = opts;
  if (policy && policy.ai_fallback === false) {
    return `<Say voice="alice">Sorry, nobody is available to take your call right now. Please call back during business hours.</Say><Hangup/>`;
  }
  if (policy?.ai_agent_id) {
    return `<Dial answerOnBridge="true" timeout="30"><Number>${escapeXml(policy.ai_agent_id)}</Number></Dial><Say voice="alice">We were unable to connect your call. Please try again later.</Say><Hangup/>`;
  }
  const cid = company?.id ?? "";
  return `<Redirect method="POST">${escapeXml(`${base}/inbound-concierge-start?cid=${encodeURIComponent(cid)}`)}</Redirect>`;
}

/** LEGACY: Bland-DID bridge for numbers with no VA company attached. */
async function legacyAiBridge(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  params: Record<string, string>,
  from: string,
  to: string,
  callSid: string,
  bizHint: string | null,
): Promise<Response> {
  const last10 = to.replace(/\D/g, "").slice(-10);
  let business: string | null = null;
  let assignedAgentId: string | null = null;

  try {
    let { data: dirRow } = await supabase
      .from("v_phone_directory")
      .select("business, assigned_agent_id, is_active")
      .eq("phone_e164", to)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!dirRow && last10) {
      const { data: rows } = await supabase
        .from("v_phone_directory")
        .select("business, assigned_agent_id, phone_e164, is_active")
        .eq("is_active", true)
        .ilike("phone_e164", `%${last10}`)
        .limit(1);
      dirRow = rows?.[0] || null;
    }
    if (dirRow) {
      business = dirRow.business || null;
      assignedAgentId = dirRow.assigned_agent_id || null;
    }
  } catch (e) {
    console.error("[inbound] directory view unavailable:", (e as Error).message);
  }

  if (!business) business = bizHint;

  let blandDid = assignedAgentId || "";
  if (!blandDid && business) {
    const envKey = ENV_FALLBACK_DID[business];
    if (envKey) blandDid = Deno.env.get(envKey) || "";
  }
  if (!blandDid) blandDid = Deno.env.get("BLAND_INBOUND_NUMBER") || "";

  console.log(`[inbound] LEGACY path business=${business} agent=${blandDid ? "set" : "none"}`);

  if (!blandDid) {
    return twiml(`<Say voice="alice">We're sorry, this line is not yet configured. Please try again later.</Say><Hangup/>`);
  }

  supabase.from("dc_call_logs").insert({
    call_sid: callSid,
    from_number: from,
    to_number: to,
    direction: "inbound",
    status: "answered",
    agent_id: blandDid,
    business: business,
  }).then(({ error }) => { if (error) console.error("Call log error:", error.message); });

  const base = functionsBase(req);
  const vm = new URL(req.url).searchParams.get("vm") === "1" ? "1" : "0";
  const actionUrl = `${base}/gasmask-missed-call-handler?business=${encodeURIComponent(business || "")}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&vm=${vm}`;

  return twiml(`
  <Dial answerOnBridge="true" timeout="20"
        action="${escapeXml(actionUrl)}" method="POST">
    <Number>${escapeXml(blandDid)}</Number>
  </Dial>
  <Say voice="alice">We were unable to connect your call. Please try again later.</Say>
  <Hangup/>`);
}

export async function handleInboundVoice(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const params = await readForm(req);
  const v = verifyTwilio(req, params);
  if (!v.ok) {
    console.error(`[inbound] signature invalid: ${v.reason}`);
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const callSid = params.CallSid || "";
  const from = normalizePhone(params.From || "");
  const to = normalizePhone(params.To || "");
  const url = new URL(req.url);
  const bizHint = url.searchParams.get("biz");
  // vm=1: we are already the AI-fallback leg of gasmask-inbound-voice —
  // humans were already rung upstream; go straight to the AI.
  const isFallbackLeg = url.searchParams.get("vm") === "1";

  console.log(`[inbound] sid=${callSid} from=${from} to=${to} biz=${bizHint} vm=${isFallbackLeg}`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const base = functionsBase(req);

  const company = await resolveInboundCompany(supabase, to, bizHint);

  if (!company || !company.policy) {
    console.log(`[inbound] no company/policy for ${to} — legacy bridge`);
    return legacyAiBridge(req, supabase, params, from, to, callSid, bizHint);
  }

  const policy = company.policy;
  const withinHours = withinPolicyHours(policy);

  // Identify the caller up front so the log row carries the store even when
  // a human answers (the concierge re-matches on its own if it takes over).
  const match = await matchCaller(supabase, from);
  await upsertCallLog(supabase, {
    callSid,
    from,
    to,
    status: "ringing",
    brand: company.slug,
    summary: `Inbound call from ${match.store_name || match.contact_name || from} → ${company.name}`,
    extra: {
      metadata: {
        company: company.slug,
        within_hours: withinHours,
        humans_first: policy.ring_humans_first,
        fallback_leg: isFallbackLeg,
      },
    },
  });

  const humansAllowed = policy.ring_humans_first
    && !isFallbackLeg
    && (withinHours || !policy.after_hours_ai_only);

  let legs: RingLeg[] = [];
  if (humansAllowed) {
    legs = await buildRingLegs(supabase, company.id, withinHours);
  }

  if (legs.length === 0) {
    const reason = !policy.ring_humans_first
      ? "policy: humans-first off"
      : isFallbackLeg
      ? "already the fallback leg"
      : (!withinHours && policy.after_hours_ai_only)
      ? "after hours → AI only"
      : "no active ring targets";
    console.log(`[inbound] ${company.slug}: straight to AI (${reason})`);
    await logRingLeg(supabase, callSid, { stage: "ai-direct", legs: [], result: reason, at: new Date().toISOString() });
    return twiml(aiFallbackTwiml({ base, policy, company }));
  }

  const ringSeconds = clampRingSeconds(policy.ring_seconds);
  const stages = policy.ring_strategy === "sequential" ? groupLegs(legs) : [legs];

  await logRingLeg(supabase, callSid, {
    stage: "stage-1",
    legs: stages[0].map((l) => ({ label: l.label, kind: l.kind, value: l.value })),
    at: new Date().toISOString(),
  });

  const actionUrl = `${base}/inbound-dial-complete?cid=${encodeURIComponent(company.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&stage=1&total=${stages.length}`;

  console.log(`[inbound] ${company.slug}: ringing stage 1/${stages.length} (${stages[0].length} legs, ${ringSeconds}s, ${policy.ring_strategy})`);

  return twiml(`
  <Dial answerOnBridge="true" timeout="${ringSeconds}" callerId="${escapeXml(to)}"
        action="${escapeXml(actionUrl)}" method="POST">
    ${legsToTwiml(stages[0])}
  </Dial>`);
}
