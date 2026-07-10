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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  business_profile_id: z.string().uuid().optional(),
  grant_opportunity_id: z.string().uuid().optional(),
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

function evalRequirement(req: Requirement, profile: Record<string, unknown>): EvalOutcome {
  const raw = profile[req.field_name];
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

    // GR-37: only run AI for single-pair or single-business calls (cost / rate control).
    // Nightly cross-product runs skip AI to protect credits and latency.
    const aiEnabled =
      !!Deno.env.get("ANTHROPIC_API_KEY") &&
      (!!business_profile_id || !!grant_opportunity_id);
    const aiCache = new Map<string, { rec: string | null; plan: string | null; prob: number | null }>();

    for (const biz of (businesses ?? []) as Record<string, unknown>[]) {
      for (const opp of (opps ?? []) as any[]) {
        const reqs = reqsByOpp[opp.id] ?? [];
        const { status, score, met, missing, failed } = computeResult(reqs, biz);
        summary[status]++;

        let ai_recommendation: string | null = null;
        let ai_action_plan: string | null = null;
        let ai_success_probability: number | null = null;
        if (aiEnabled) {
          const key = `${(biz as any).id}::${opp.id}`;
          let cached = aiCache.get(key);
          if (!cached) {
            cached = await generateAiRecommendation({
              biz, opp: oppMetaById[opp.id] ?? { id: opp.id }, status, score, met, missing, failed,
            });
            aiCache.set(key, cached);
          }
          ai_recommendation = cached.rec;
          ai_action_plan = cached.plan;
          ai_success_probability = cached.prob;
        } else if (!Deno.env.get("ANTHROPIC_API_KEY")) {
          ai_recommendation = "AI recommendations unavailable";
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
        ai_enabled: aiEnabled,
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
