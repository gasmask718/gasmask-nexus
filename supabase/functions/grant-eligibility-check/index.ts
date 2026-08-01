// grant-eligibility-check
// POST { client_id: string } → scores active grant_opportunities for a
// funding_clients row, upserts eligible matches into client_grant_matches,
// updates grant_eligible/grant_checked_at on the client.
//
// Always returns HTTP 200; error surfaces as { error, eligible_count: 0 }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireGrantsStaff, grantsAuthResponse } from "../_shared/grantsAuth.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Opp = {
  id: string;
  grant_name: string;
  funder_name: string | null;
  amount_typical: number | null;
  min_credit_score: number | null;
  requires_nonprofit: boolean | null;
  requires_minority_owned: boolean | null;
  requires_women_owned: boolean | null;
  requires_veteran_owned: boolean | null;
  next_deadline: string | null;
  deadline_type: string | null;
  application_url: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const auth = await requireGrantsStaff(req);
  if (!auth.ok) return grantsAuthResponse(auth, corsHeaders);

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "method_not_allowed", eligible_count: 0 }),
        { status: 200, headers: jsonHeaders },
      );
    }

    const body = await req.json().catch(() => ({}));
    const client_id: string | undefined = body?.client_id;
    if (!client_id || typeof client_id !== "string") {
      return new Response(
        JSON.stringify({ error: "client_id required", eligible_count: 0 }),
        { status: 400, headers: jsonHeaders },
      );
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // STEP 1 — Load client
    const { data: client, error: clientErr } = await sb
      .from("funding_clients")
      .select("*")
      .eq("id", client_id)
      .maybeSingle();
    if (clientErr) throw clientErr;
    if (!client) {
      return new Response(
        JSON.stringify({ error: "Client not found", eligible_count: 0 }),
        { status: 400, headers: jsonHeaders },
      );
    }
    const { count: total_applications } = await sb
      .from("funding_applications")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client_id);

    const creditScore: number =
      (client as any).credit_score_estimate ??
      (client as any).current_dfs_score ??
      0;
    const creditScoreLabel = creditScore > 0 ? `${creditScore}` : "Score not on file";

    // STEP 2 — Load active opportunities
    const { data: opportunities, error: oppErr } = await sb
      .from("grant_opportunities")
      .select("id, grant_name, funder_name, amount_typical, min_credit_score, requires_nonprofit, requires_minority_owned, requires_women_owned, requires_veteran_owned, next_deadline, deadline_type, application_url")
      .eq("is_active", true)
      .order("amount_typical", { ascending: false, nullsFirst: false });
    if (oppErr) throw oppErr;

    // STEP 3 — Score
    const scored = (opportunities as Opp[] ?? []).map((opp) => {
      let score = 0;
      let qualified = true;
      const reasons: string[] = [];
      const blockers: string[] = [];

      // Credit
      if (opp.min_credit_score && opp.min_credit_score > 0) {
        if (creditScore >= opp.min_credit_score) {
          score += 35;
          reasons.push(`Credit score qualifies (${creditScore} >= ${opp.min_credit_score})`);
        } else if (creditScore === 0) {
          score += 15;
          reasons.push("Score not on file — may still qualify");
        } else {
          qualified = false;
          blockers.push(`Credit score below minimum (need ${opp.min_credit_score}, have ${creditScore})`);
        }
      } else {
        score += 35;
        reasons.push("No credit score requirement");
      }

      // Nonprofit
      if (opp.requires_nonprofit) {
        qualified = false;
        blockers.push("Nonprofit only — use UBEN for this grant");
      }

      // Minority
      if (opp.requires_minority_owned) {
        if ((client as any).minority_owned) {
          score += 25;
          reasons.push("Minority owned ✅");
        } else {
          score -= 15;
          blockers.push("Prefers minority owned businesses");
        }
      } else {
        score += 15;
        reasons.push("Open to all business types");
      }

      // Women
      if (opp.requires_women_owned) {
        if ((client as any).women_owned) {
          score += 25;
          reasons.push("Women owned ✅");
        } else {
          qualified = false;
          blockers.push("Requires women owned business");
        }
      }

      // Veteran
      if (opp.requires_veteran_owned && (client as any).veteran_owned) {
        score += 15;
        reasons.push("Veteran owned ✅");
      }

      // Amount bonus
      if (opp.amount_typical && opp.amount_typical > 0) score += 15;

      // Rolling deadline
      if (opp.deadline_type === "rolling") {
        score += 10;
        reasons.push("Rolling deadline — apply anytime");
      }

      const isEligible = qualified && score >= 45;
      return { opp, score, qualified, isEligible, reasons, blockers };
    });

    // STEP 4 — Filter + sort
    const eligible = scored.filter((s) => s.isEligible).sort((a, b) => b.score - a.score);

    // STEP 5 — Upsert matches — uses existing UNIQUE(client_id, opportunity_id).
    // Preserve non-'ineligible' human status when re-running.
    if (eligible.length > 0) {
      const rows = eligible.map((e) => ({
        client_id,
        opportunity_id: e.opp.id,
        grant_name: e.opp.grant_name,
        funder_name: e.opp.funder_name,
        grant_amount: e.opp.amount_typical ?? 0,
        deadline: e.opp.next_deadline,
        eligibility_score: e.score,
        eligibility_notes: e.reasons.join(". "),
        status: "identified",
      }));

      // Use RPC-free upsert: supabase-js .upsert with ignoreDuplicates=false
      // will DO UPDATE on all columns. To honor the "keep human status unless
      // it's 'ineligible'" rule we do a two-step: insert-only-if-new, then
      // update the score/notes for existing rows without touching status.
      const { error: insertErr } = await sb
        .from("client_grant_matches")
        .upsert(rows, { onConflict: "client_id,opportunity_id", ignoreDuplicates: true });
      if (insertErr) throw insertErr;

      for (const r of rows) {
        // Update score/notes; only flip status back to 'identified' if it was 'ineligible'.
        const { data: existing } = await sb
          .from("client_grant_matches")
          .select("status")
          .eq("client_id", r.client_id)
          .eq("opportunity_id", r.opportunity_id)
          .maybeSingle();
        const nextStatus = existing?.status === "ineligible" ? "identified" : existing?.status ?? "identified";
        const { error: updErr } = await sb
          .from("client_grant_matches")
          .update({
            eligibility_score: r.eligibility_score,
            eligibility_notes: r.eligibility_notes,
            status: nextStatus,
            grant_amount: r.grant_amount,
            deadline: r.deadline,
            grant_name: r.grant_name,
            funder_name: r.funder_name,
          })
          .eq("client_id", r.client_id)
          .eq("opportunity_id", r.opportunity_id);
        if (updErr) throw updErr;
      }
    }

    // STEP 6 — Update client flags
    const { error: cUpdErr } = await sb
      .from("funding_clients")
      .update({
        grant_eligible: eligible.length > 0,
        grant_checked_at: new Date().toISOString(),
      })
      .eq("id", client_id);
    if (cUpdErr) throw cUpdErr;

    // STEP 7 — Response
    const total_available = eligible.reduce((s, g) => s + (g.opp.amount_typical ?? 0), 0);
    const payload = {
      client_id,
      credit_score_used: creditScore,
      credit_score_label: creditScoreLabel,
      total_applications: total_applications ?? 0,
      total_opportunities_checked: opportunities?.length ?? 0,
      eligible_count: eligible.length,
      // Spec-required alias (Section 4 / EF-05). Represents the number of
      // client_grant_matches rows created/refreshed by this run.
      matches_created: eligible.length,
      ineligible_count: scored.length - eligible.length,
      total_available,
      top_grant: eligible[0]
        ? {
            grant_name: eligible[0].opp.grant_name,
            funder_name: eligible[0].opp.funder_name,
            amount: eligible[0].opp.amount_typical,
            deadline: eligible[0].opp.next_deadline,
            eligibility_score: eligible[0].score,
            application_url: eligible[0].opp.application_url,
          }
        : null,
      all_matches: eligible.map((e) => ({
        opportunity_id: e.opp.id,
        grant_name: e.opp.grant_name,
        funder_name: e.opp.funder_name,
        amount: e.opp.amount_typical,
        deadline: e.opp.next_deadline,
        deadline_type: e.opp.deadline_type,
        eligibility_score: e.score,
        reasons: e.reasons,
        blockers: e.blockers,
        application_url: e.opp.application_url,
      })),
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: jsonHeaders });
  } catch (e: any) {
    console.error("[grant-eligibility-check]", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e), eligible_count: 0 }),
      { status: 200, headers: jsonHeaders },
    );
  }
});
