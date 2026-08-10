// GEE-5 — grant-eligibility-checker
// Matches every active grant_business_profiles row against every open
// grant_opportunities row, evaluating grant_requirements with their operators,
// and upserts one row into grant_eligibility_results per (business, grant) pair.
//
// Trigger modes:
//   1. POST {}                              → check ALL active × open (nightly)
//   2. POST { business_profile_id }         → one business × all open grants
//   3. POST { grant_opportunity_id }        → all active businesses × one grant
//   4. POST { business_profile_id, grant_opportunity_id } → single pair
//
// Response: { checked, upserted, results_summary: { eligible, partially_eligible, needs_review, not_eligible } }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";
import { requireGrantsStaff, grantsAuthResponse } from "../_shared/grantsAuth.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  business_profile_id: z.string().uuid().optional(),
  grant_opportunity_id: z.string().uuid().optional(),
  // Phase 4 identity bridge: scope a run to one Funding Hub client. The client
  // resolves to its linked grant_business_profiles rows, so eligibility is always
  // calculated and stored against a single client identity.
  funding_client_id: z.string().uuid().optional(),
}).strict();

type Requirement = {
  id: string;
  field_name: string;
  operator: string;
  required_value: string | null;
  is_mandatory: boolean;
  weight: number;
  description: string;
  requirement_type: string;
};

type EvalOutcome = "met" | "missing" | "failed";

function coerce(v: unknown): { isNull: boolean; asNumber: number | null; asString: string; asBool: boolean | null } {
  const isNull = v === null || v === undefined || v === "";
  const asNumber = typeof v === "number" ? v : (typeof v === "string" && v !== "" && !isNaN(Number(v)) ? Number(v) : null);
  const asString = v == null ? "" : String(v);
  const asBool = typeof v === "boolean" ? v : null;
  return { isNull, asNumber, asString, asBool };
}

// Map QA-spec requirement field_names → actual grant_business_profiles columns.
// Derived values (is_for_profit, is_nonprofit) are computed from entity_type.
function resolveProfileField(fieldName: string, profile: Record<string, unknown>): unknown {
  if (fieldName in profile) return profile[fieldName];
  const aliases: Record<string, string> = {
    years_in_operation: "years_in_business",
    annual_revenue: "annual_revenue_current",
    revenue: "annual_revenue_current",
    revenue_current: "annual_revenue_current",
    employees: "employee_count_ft",
    employee_count: "employee_count_ft",
    state: "address_state",
    zip: "address_zip",
    city: "address_city",
    county: "address_county",
    naics: "naics_primary",
    minority_owned: "cert_mbe",
    women_owned: "cert_wbe",
    veteran_owned: "cert_veteran",
  };
  if (aliases[fieldName] && aliases[fieldName] in profile) return profile[aliases[fieldName]];
  const entity = String(profile.entity_type ?? "").toLowerCase();
  if (fieldName === "is_for_profit") return entity !== "" && entity !== "nonprofit" && entity !== "non_profit" && entity !== "501c3";
  if (fieldName === "is_nonprofit") return entity === "nonprofit" || entity === "non_profit" || entity === "501c3";
  return undefined;
}

function evalRequirement(req: Requirement, profile: Record<string, unknown>): EvalOutcome {
  const raw = resolveProfileField(req.field_name, profile);
  const { isNull, asNumber, asString, asBool } = coerce(raw);
  const rv = req.required_value;

  switch (req.operator) {
    case "is_true":
      if (asBool === true) return "met";
      if (asBool === false) return "failed";
      return "missing";
    case "is_not_null":
      return isNull ? "missing" : "met";
    case "greater_than": {
      const target = rv == null ? NaN : Number(rv);
      if (asNumber == null) return "missing";
      if (isNaN(target)) return "missing";
      return asNumber > target ? "met" : "failed";
    }
    case "less_than": {
      const target = rv == null ? NaN : Number(rv);
      if (asNumber == null) return "missing";
      if (isNaN(target)) return "missing";
      return asNumber < target ? "met" : "failed";
    }
    case "equals":
      if (isNull) return "missing";
      return asString.trim().toLowerCase() === String(rv ?? "").trim().toLowerCase() ? "met" : "failed";
    case "contains":
      if (isNull) return "missing";
      if (Array.isArray(raw)) {
        return raw.map((x) => String(x).toLowerCase()).includes(String(rv ?? "").toLowerCase()) ? "met" : "failed";
      }
      return asString.toLowerCase().includes(String(rv ?? "").toLowerCase()) ? "met" : "failed";
    default:
      return "missing";
  }
}

function computeResult(reqs: Requirement[], profile: Record<string, unknown>) {
  const met: Array<{ id: string; field_name: string; weight: number; description: string }> = [];
  const missing: Array<{ id: string; field_name: string; weight: number; is_mandatory: boolean; description: string }> = [];
  const failed: Array<{ id: string; field_name: string; weight: number; is_mandatory: boolean; description: string }> = [];

  let totalWeight = 0;
  let earnedWeight = 0;
  let mandatoryFailed = 0;
  let mandatoryMissing = 0;

  for (const r of reqs) {
    const w = r.weight ?? 5;
    totalWeight += w;
    const outcome = evalRequirement(r, profile);
    if (outcome === "met") {
      earnedWeight += w;
      met.push({ id: r.id, field_name: r.field_name, weight: w, description: r.description });
    } else if (outcome === "missing") {
      missing.push({ id: r.id, field_name: r.field_name, weight: w, is_mandatory: r.is_mandatory, description: r.description });
      if (r.is_mandatory) mandatoryMissing++;
    } else {
      failed.push({ id: r.id, field_name: r.field_name, weight: w, is_mandatory: r.is_mandatory, description: r.description });
      if (r.is_mandatory) mandatoryFailed++;
    }
  }

  // GR-36 fix: if there are NO requirements at all, we cannot claim eligibility.
  // Route to needs_review with score = 0 rather than defaulting to eligible/100.
  if (reqs.length === 0 || totalWeight === 0) {
    return { status: "needs_review" as const, score: 0, met, missing, failed };
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);
  let status: "eligible" | "partially_eligible" | "needs_review" | "not_eligible";
  if (mandatoryFailed > 0) status = "not_eligible";
  else if (mandatoryMissing > 0) status = "needs_review";
  else if (missing.length > 0 || failed.length > 0) status = "partially_eligible";
  else status = "eligible";

  return { status, score, met, missing, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const auth = await requireGrantsStaff(req);
  if (!auth.ok) return grantsAuthResponse(auth, corsHeaders);

  try {
    const raw = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: jsonHeaders },
      );
    }
    const { business_profile_id, grant_opportunity_id } = parsed.data;

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Load businesses
    let bizQuery = sb.from("grant_business_profiles").select("*").eq("is_active", true);
    if (business_profile_id) bizQuery = bizQuery.eq("id", business_profile_id);
    const { data: businesses, error: bizErr } = await bizQuery;
    if (bizErr) throw bizErr;

    // Load opportunities (open only)
    let oppQuery = sb.from("grant_opportunities").select("id, status").eq("status", "open");
    if (grant_opportunity_id) oppQuery = oppQuery.eq("id", grant_opportunity_id);
    const { data: opps, error: oppErr } = await oppQuery;
    if (oppErr) throw oppErr;

    // Load ALL requirements for the opportunities in scope (one round-trip)
    const oppIds = (opps ?? []).map((o: any) => o.id);
    const reqsByOpp: Record<string, Requirement[]> = {};
    if (oppIds.length > 0) {
      const { data: allReqs, error: reqErr } = await sb
        .from("grant_requirements")
        .select("id, grant_opportunity_id, field_name, operator, required_value, is_mandatory, weight, description, requirement_type")
        .in("grant_opportunity_id", oppIds);
      if (reqErr) throw reqErr;
      for (const r of (allReqs ?? []) as any[]) {
        (reqsByOpp[r.grant_opportunity_id] ??= []).push(r);
      }
    }

    // Preload opportunity metadata so AI prompts have context
    const oppMetaById: Record<string, any> = {};
    if (oppIds.length > 0) {
      const { data: oppMeta } = await sb
        .from("grant_opportunities")
        .select("id, grant_name, title, funder_name, funder, amount, amount_typical, deadline, category, description")
        .in("id", oppIds);
      for (const o of (oppMeta ?? []) as any[]) oppMetaById[o.id] = o;
    }

    // Evaluate cross product
    const rows: any[] = [];
    const summary = { eligible: 0, partially_eligible: 0, needs_review: 0, not_eligible: 0 };
    const nowIso = new Date().toISOString();
    const nextIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Section 5-7 (EF-02): AI must ALWAYS populate ai_recommendation,
    // ai_action_plan, ai_success_probability. When Anthropic is unavailable,
    // fall back to deterministic values with the required fallback message.
    // For nightly cross-product runs, skip live AI calls (cost) but still
    // write deterministic values instead of leaving NULL.
    const hasKey = !!Deno.env.get("LOVABLE_API_KEY") || !!Deno.env.get("ANTHROPIC_API_KEY");
    const aiLive = hasKey && (!!business_profile_id || !!grant_opportunity_id);
    const aiCache = new Map<string, { rec: string; plan: string; prob: number }>();
    const FALLBACK_MSG = hasKey
      ? "AI unavailable — heuristic score only."
      : "AI unavailable — heuristic score only. Add LOVABLE_API_KEY to Supabase Secrets to enable AI recommendations.";

    function deterministicFallback(status: string, score: number, missingLen: number, failedLen: number) {
      const plan = [
        missingLen > 0 ? `Complete ${missingLen} missing requirement(s).` : "All requirements captured.",
        failedLen > 0 ? `Resolve ${failedLen} failed requirement(s).` : "No failed requirements.",
        "Verify business profile completeness before submission.",
        "Gather supporting documents and financial statements.",
        "Draft narrative and submit before deadline.",
      ].join("\n");
      const prob = status === "eligible" ? Math.max(60, score)
        : status === "partially_eligible" ? Math.min(60, Math.max(30, score))
        : status === "needs_review" ? Math.min(45, Math.max(20, score))
        : Math.min(20, score);
      return { rec: `${FALLBACK_MSG} Status: ${status}, heuristic score: ${score}.`, plan, prob };
    }

    for (const biz of (businesses ?? []) as Record<string, unknown>[]) {
      for (const opp of (opps ?? []) as any[]) {
        const reqs = reqsByOpp[opp.id] ?? [];
        const { status, score, met, missing, failed } = computeResult(reqs, biz);
        summary[status]++;

        let ai_recommendation: string;
        let ai_action_plan: string;
        let ai_success_probability: number;
        const fb = deterministicFallback(status, score, missing.length, failed.length);

        if (aiLive) {
          const key = `${(biz as any).id}::${opp.id}`;
          let cached = aiCache.get(key);
          if (!cached) {
            const out = await generateAiRecommendation({
              biz, opp: oppMetaById[opp.id] ?? { id: opp.id }, status, score, met, missing, failed,
            });
            cached = {
              rec: out.rec ?? fb.rec,
              plan: out.plan ?? fb.plan,
              prob: out.prob ?? fb.prob,
            };
            aiCache.set(key, cached);
          }
          ai_recommendation = cached.rec;
          ai_action_plan = cached.plan;
          ai_success_probability = cached.prob;
        } else {
          ai_recommendation = fb.rec;
          ai_action_plan = fb.plan;
          ai_success_probability = fb.prob;
        }

        rows.push({
          business_profile_id: (biz as any).id,
          grant_opportunity_id: opp.id,
          eligibility_status: status,
          eligibility_score: score,
          requirements_met: met,
          requirements_missing: missing,
          requirements_failed: failed,
          ai_recommendation,
          ai_action_plan,
          ai_success_probability,
          last_checked_at: nowIso,
          next_check_at: nextIso,
        });
      }
    }

    let upserted = 0;
    if (rows.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error: upErr } = await sb
          .from("grant_eligibility_results")
          .upsert(slice, { onConflict: "business_profile_id,grant_opportunity_id" });
        if (upErr) throw upErr;
        upserted += slice.length;
      }
    }

    // GR-36 / Section 4: refresh business profile counters + last check timestamp
    const bizIdsChecked = Array.from(new Set((businesses ?? []).map((b: any) => b.id)));
    for (const bId of bizIdsChecked) {
      const { count } = await sb
        .from("grant_eligibility_results")
        .select("id", { count: "exact", head: true })
        .eq("business_profile_id", bId)
        .in("eligibility_status", ["eligible", "partially_eligible"]);
      await sb
        .from("grant_business_profiles")
        .update({
          eligible_grant_count: count ?? 0,
          last_eligibility_check_at: nowIso,
        })
        .eq("id", bId);
    }

    return new Response(
      JSON.stringify({
        businesses_checked: businesses?.length ?? 0,
        opportunities_checked: opps?.length ?? 0,
        pairs_evaluated: rows.length,
        upserted,
        results_summary: summary,
        ai_enabled: aiLive,
        ai_available: hasKey,
      }),
      { status: 200, headers: jsonHeaders },
    );
  } catch (e: any) {
    console.error("[grant-eligibility-checker]", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});

// -------- GR-37: AI recommendation via Lovable AI Gateway (fallback: Anthropic) --------
async function generateAiRecommendation(args: {
  biz: Record<string, unknown>;
  opp: Record<string, unknown>;
  status: string;
  score: number;
  met: any[];
  missing: any[];
  failed: any[];
}): Promise<{ rec: string | null; plan: string | null; prob: number | null }> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!lovableKey && !anthropicKey) return { rec: "AI recommendations unavailable", plan: null, prob: null };

  const biz = args.biz as any;
  const opp = args.opp as any;
  const missingList = args.missing.slice(0, 12).map((m: any) => `- ${m.description || m.field_name}${m.is_mandatory ? " (mandatory)" : ""}`).join("\n") || "(none)";
  const failedList = args.failed.slice(0, 12).map((m: any) => `- ${m.description || m.field_name}`).join("\n") || "(none)";

  const prompt = `You are a grant eligibility strategist. Evaluate this match and respond with STRICT JSON only:
{"recommendation":"...","action_plan":"...","success_probability":<0-100 integer>}

Business:
- Name: ${biz.business_name ?? "Unknown"}
- Entity: ${biz.entity_type ?? "?"}, NAICS: ${biz.naics_primary ?? "?"}
- Revenue: ${biz.annual_revenue_current ?? "?"}, Employees FT: ${biz.employee_count_ft ?? "?"}
- State: ${biz.address_state ?? "?"}, Years in business: ${biz.years_in_business ?? "?"}
- Profile completeness: ${biz.completeness_pct ?? 0}%

Grant:
- Name: ${opp.grant_name ?? opp.title ?? "Unknown"}
- Funder: ${opp.funder_name ?? opp.funder ?? "?"}
- Amount: ${opp.amount ?? opp.amount_typical ?? "?"}, Category: ${opp.category ?? "?"}

Evaluation:
- Status: ${args.status}, Score: ${args.score}
- Missing requirements:
${missingList}
- Failed requirements:
${failedList}

The "recommendation" is a professional, action-oriented summary (max 250 words) covering: eligibility summary, strengths, weaknesses, missing requirements, recommended next steps, suggested documents, timeline, and funding strategy.
The "action_plan" is 3-6 short bullet steps (single string with newlines).
"success_probability" is a realistic integer 0-100.`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let text = "";
    if (lovableKey) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
        }),
      }).finally(() => clearTimeout(timer));
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("[eligibility-ai] lovable non-200", resp.status, body.slice(0, 300));
        return { rec: "AI recommendations unavailable", plan: null, prob: null };
      }
      const data = await resp.json();
      text = data?.choices?.[0]?.message?.content ?? "";
    } else {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 900,
          messages: [{ role: "user", content: prompt }],
        }),
      }).finally(() => clearTimeout(timer));
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        console.error("[eligibility-ai] anthropic non-200", resp.status, body.slice(0, 300));
        return { rec: "AI recommendations unavailable", plan: null, prob: null };
      }
      const data = await resp.json();
      text = data?.content?.[0]?.text ?? "";
    }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { rec: text.slice(0, 2000) || "AI recommendations unavailable", plan: null, prob: null };
    const parsed = JSON.parse(jsonMatch[0]);
    const probRaw = Number(parsed.success_probability);
    const prob = Number.isFinite(probRaw) ? Math.max(0, Math.min(100, Math.round(probRaw))) : null;
    return {
      rec: typeof parsed.recommendation === "string" ? parsed.recommendation.slice(0, 4000) : null,
      plan: typeof parsed.action_plan === "string" ? parsed.action_plan.slice(0, 2000) : null,
      prob,
    };
  } catch (e) {
    console.error("[eligibility-ai] failure", (e as any)?.message ?? e);
    return { rec: "AI recommendations unavailable", plan: null, prob: null };
  }
}
