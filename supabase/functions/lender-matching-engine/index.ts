// supabase/functions/lender-matching-engine/index.ts
//
// Deterministic lender matching. Every lender in funding_lender_database is
// evaluated and returned with an explicit verdict — nothing is silently dropped
// and nothing is reported as qualified unless every mandatory rule passes.
//
// Verdicts:
//   MATCHED               every evaluable rule passed, prerequisites complete
//   REQUIRES_PREREQUISITE rules pass but business-foundation items are missing
//   MANUAL_REVIEW         a required client data point is unknown (cannot decide)
//   NOT_MATCHED           at least one hard rule failed
//
// Runs with the service role, so the caller must be funding staff.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireFundingStaff, fundingAuthResponse } from "../_shared/fundingAuth.ts";

type Verdict = "MATCHED" | "REQUIRES_PREREQUISITE" | "MANUAL_REVIEW" | "NOT_MATCHED";

interface RuleResult {
  rule: string;
  outcome: "pass" | "fail" | "unknown" | "n/a";
  detail: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = await requireFundingStaff(req);
  if (!auth.ok) return fundingAuthResponse(auth, corsHeaders);

  try {
    const { client_id } = await req.json().catch(() => ({}));
    if (!client_id) return json({ error: "client_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: client, error: clientErr } = await supabase
      .from("funding_clients").select("*").eq("id", client_id).maybeSingle();
    if (clientErr) return json({ error: clientErr.message, client_id }, 400);
    if (!client) return json({ error: "Client not found", client_id }, 404);

    const score: number | null = client.credit_score_estimate ?? null;
    const monthlyRevenue: number | null =
      client.monthly_revenue != null ? Number(client.monthly_revenue) : null;
    const tib: number | null = client.time_in_business_months ?? null;

    // Business foundation prerequisites (real data — no assumptions).
    const COMPLETE_STATUSES = ["complete", "completed", "done", "verified"];
    const { data: checklist } = await supabase
      .from("funding_infrastructure_checklist")
      .select("step_key, step_label, status")
      .eq("client_id", client_id);
    const missingPrereqs = (checklist ?? [])
      .filter((c: { status: string | null }) =>
        !COMPLETE_STATUSES.includes((c.status ?? "").toLowerCase()))
      .map((c: { step_label: string | null; step_key: string }) => c.step_label ?? c.step_key);

    const { data: lenders, error: lenderErr } = await supabase
      .from("funding_lender_database")
      .select("*")
      .eq("is_active", true);
    if (lenderErr) return json({ error: lenderErr.message, client_id }, 500);

    if (!lenders || lenders.length === 0) {
      return json({
        client_id,
        lender_universe: 0,
        matched_count: 0,
        results: [],
        note:
          "NO LENDER DATA — funding_lender_database is empty. Import real lender records at /funding-machine/lender-import before matching.",
      });
    }

    const results = lenders.map((l: Record<string, any>) => {
      const rules: RuleResult[] = [];
      let failed = false;
      let unknown = false;

      const numeric = (
        label: string,
        required: number | null | undefined,
        actual: number | null,
        unit: string,
      ) => {
        if (required == null) {
          rules.push({ rule: label, outcome: "n/a", detail: "No requirement published" });
          return;
        }
        if (actual == null) {
          unknown = true;
          rules.push({
            rule: label,
            outcome: "unknown",
            detail: `Requires ${unit}${required} — client value not on file`,
          });
          return;
        }
        if (actual < required) {
          failed = true;
          rules.push({
            rule: label,
            outcome: "fail",
            detail: `${unit}${actual} is below required ${unit}${required}`,
          });
          return;
        }
        rules.push({
          rule: label,
          outcome: "pass",
          detail: `${unit}${actual} meets required ${unit}${required}`,
        });
      };

      numeric("Credit score", l.min_credit_score, score, "");
      numeric("Monthly revenue", l.min_revenue != null ? Number(l.min_revenue) : null, monthlyRevenue, "$");
      numeric("Time in business", l.min_time_in_business_months, tib, "");

      if (l.entity_required) {
        if (!client.business_name || !client.ein) {
          failed = true;
          rules.push({
            rule: "Entity requirement",
            outcome: "fail",
            detail: `${l.entity_required} required — client has no registered entity/EIN on file`,
          });
        } else {
          rules.push({
            rule: "Entity requirement",
            outcome: "pass",
            detail: `${l.entity_required} satisfied (${client.business_name})`,
          });
        }
      }

      let verdict: Verdict;
      if (failed) verdict = "NOT_MATCHED";
      else if (unknown) verdict = "MANUAL_REVIEW";
      else if (missingPrereqs.length > 0) verdict = "REQUIRES_PREREQUISITE";
      else verdict = "MATCHED";

      // Score only ranks lenders that actually qualify.
      let matchScore = 0;
      if (verdict === "MATCHED" || verdict === "REQUIRES_PREREQUISITE") {
        matchScore = 50;
        if (l.min_credit_score != null && score != null && score > l.min_credit_score + 50) matchScore += 20;
        if (l.min_revenue != null && monthlyRevenue != null && monthlyRevenue > Number(l.min_revenue) * 1.5) matchScore += 15;
        if (l.min_time_in_business_months != null && tib != null && tib > l.min_time_in_business_months * 2) matchScore += 10;
        if (l.has_soft_pull_prequal) matchScore += 5;
        if (verdict === "REQUIRES_PREREQUISITE") matchScore = Math.round(matchScore * 0.6);
      }

      return {
        lender_id: l.id,
        lender_name: l.lender_name,
        product_name: l.product_name,
        category: l.category,
        product_type: l.product_type,
        funding_lane: l.funding_lane,
        max_amount: l.max_amount,
        submission_method: l.submission_method ?? "MANUAL",
        automation_allowed: l.automation_allowed === true,
        application_url: l.application_url,
        stack_priority: l.stack_priority ?? null,
        verdict,
        match_score: matchScore,
        rules,
        missing_prerequisites: verdict === "REQUIRES_PREREQUISITE" ? missingPrereqs : [],
      };
    });

    results.sort((a, b) => b.match_score - a.match_score);

    // Persist only lenders the client can actually pursue.
    const persistable = results.filter(
      (r) => r.verdict === "MATCHED" || r.verdict === "REQUIRES_PREREQUISITE",
    );
    if (persistable.length > 0) {
      const rows = persistable.map((m) => ({
        client_id,
        lender_id: m.lender_id,
        match_score: m.match_score,
        match_reasons: [
          `Verdict: ${m.verdict}`,
          ...m.rules.filter((r) => r.outcome !== "n/a").map((r) => `${r.rule}: ${r.detail}`),
          ...(m.missing_prerequisites.length
            ? [`Missing prerequisites: ${m.missing_prerequisites.join(", ")}`]
            : []),
        ],
        status: "identified",
        matched_at: new Date().toISOString(),
      }));
      const { error: upsertErr } = await supabase
        .from("funding_client_lender_matches")
        .upsert(rows, { onConflict: "client_id,lender_id" });
      if (upsertErr) {
        console.error("Match upsert error:", upsertErr.message);
        return json({ error: `Matches computed but not saved: ${upsertErr.message}` }, 500);
      }
    }

    const counts = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
      return acc;
    }, {});

    // Optional strategy note — only written when there is something to strategise about.
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let strategy = "";
    if (anthropicKey && persistable.length > 0) {
      const top5 = persistable.slice(0, 5);
      const prompt = `You are David's Funding Strategist. Given this client and the top lender matches, tell David the exact play.

CLIENT:
- Name: ${client.first_name} ${client.last_name}
- Credit score: ${score ?? "unknown"} | Target: ${client.target_credit_score ?? "n/a"}
- Monthly revenue: ${monthlyRevenue != null ? `$${monthlyRevenue}` : "unknown"}
- Time in business: ${tib != null ? `${tib} months` : "unknown"}
- Funding target: ${client.funding_target ?? "not set"}
- Received so far: ${client.funding_received ?? 0}
- Stage: ${client.stage ?? "intake"}
- Outstanding prerequisites: ${missingPrereqs.length ? missingPrereqs.join(", ") : "none"}

TOP LENDER MATCHES:
${top5.map((m, i) =>
  `${i + 1}. ${m.lender_name} — ${m.product_name} (${m.category}/${m.product_type}) [${m.verdict}]
   Max: $${m.max_amount ?? "?"} | Match: ${m.match_score}/100
   Rules: ${m.rules.filter((r) => r.outcome !== "n/a").map((r) => `${r.rule} ${r.outcome}`).join("; ")}`
).join("\n\n")}

Give David:
1. Which ONE lender to apply to FIRST and why.
2. Recommended stacking order for the rest.
3. Prep steps before applying (including clearing the outstanding prerequisites).
4. Realistic total funding in the next 30 days.

Under 350 words. Tactical, no fluff.`;

      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          strategy = data?.content?.[0]?.text ?? "";
        } else {
          console.error("Anthropic error:", resp.status, await resp.text());
        }
      } catch (e) {
        console.error("Anthropic call failed:", (e as Error).message);
      }

      if (strategy) {
        await supabase.from("client_notes").insert({
          client_id,
          note_type: "funding",
          content: strategy,
          is_pinned: true,
          created_by: "Lender Brain",
        });
      }
    }

    return json({
      client_id,
      lender_universe: lenders.length,
      counts,
      matched_count: counts.MATCHED ?? 0,
      missing_prerequisites: missingPrereqs,
      top_lender: persistable[0] ?? null,
      strategy,
      results,
    });
  } catch (e) {
    console.error("lender-matching-engine failed:", (e as Error).message);
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});
