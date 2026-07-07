// supabase/functions/lender-matching-engine/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { client_id } = await req.json().catch(() => ({}));
    if (!client_id) return json({ error: "client_id required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: client, error: clientErr } = await supabase
      .from("funding_clients")
      .select("*")
      .eq("id", client_id)
      .maybeSingle();

    if (clientErr) return json({ error: clientErr.message, client_id }, 400);
    if (!client) return json({ error: "Client not found", client_id }, 400);

    const score = client.credit_score_estimate ?? null;
    const revenue = client.monthly_revenue ?? null;
    const tib = client.time_in_business_months ?? null;

    const { data: lenders, error: lenderErr } = await supabase
      .from("funding_lender_database")
      .select(`
        id, lender_name, product_name, category, product_type,
        max_amount, min_credit_score, min_revenue,
        min_time_in_business_months, has_soft_pull_prequal, is_active
      `)
      .eq("is_active", true);

    if (lenderErr) return json({ error: lenderErr.message, client_id }, 200);

    const matches: Array<any> = [];
    for (const l of lenders ?? []) {
      const reasons: string[] = [];
      let eligible = true;

      if (l.min_credit_score != null) {
        if (score == null || score < l.min_credit_score) {
          eligible = false;
        } else {
          reasons.push(`Score ${score} meets min ${l.min_credit_score}`);
        }
      }
      if (eligible && l.min_revenue != null) {
        if (revenue != null && revenue < Number(l.min_revenue)) {
          eligible = false;
        } else if (revenue != null) {
          reasons.push(`Revenue $${revenue} meets min $${l.min_revenue}`);
        }
      }
      if (eligible && l.min_time_in_business_months != null) {
        if (tib != null && tib < l.min_time_in_business_months) {
          eligible = false;
        } else if (tib != null) {
          reasons.push(`TIB ${tib}mo meets min ${l.min_time_in_business_months}mo`);
        }
      }

      if (!eligible) continue;

      let matchScore = 50;
      if (l.min_credit_score != null && score != null && score > l.min_credit_score + 50) {
        matchScore += 20;
        reasons.push("Score comfortably above minimum (+20)");
      }
      if (l.min_revenue != null && revenue != null && revenue > Number(l.min_revenue) * 1.5) {
        matchScore += 15;
        reasons.push("Revenue 1.5x above minimum (+15)");
      }
      if (l.min_time_in_business_months != null && tib != null && tib > l.min_time_in_business_months * 2) {
        matchScore += 10;
        reasons.push("TIB 2x above minimum (+10)");
      }
      if (l.has_soft_pull_prequal) {
        matchScore += 5;
        reasons.push("Soft-pull prequal available (+5)");
      }

      matches.push({
        lender_id: l.id,
        lender_name: l.lender_name,
        product_name: l.product_name,
        category: l.category,
        product_type: l.product_type,
        max_amount: l.max_amount,
        match_score: matchScore,
        match_reasons: reasons,
      });
    }

    matches.sort((a, b) => b.match_score - a.match_score);
    const top10 = matches.slice(0, 10);

    if (top10.length > 0) {
      const rows = top10.map((m) => ({
        client_id,
        lender_id: m.lender_id,
        match_score: m.match_score,
        match_reasons: m.match_reasons,
        status: "identified",
        matched_at: new Date().toISOString(),
      }));
      const { error: upsertErr } = await supabase
        .from("funding_client_lender_matches")
        .upsert(rows, { onConflict: "client_id,lender_id" });
      if (upsertErr) console.error("Match upsert error:", upsertErr);
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    let strategy = "";

    if (anthropicKey && top10.length > 0) {
      const top5 = top10.slice(0, 5);
      const prompt = `You are David's Funding Strategist. Given this client and the top 5 lender matches, tell David the exact play.

CLIENT:
- Name: ${client.first_name} ${client.last_name}
- Credit score: ${score ?? "unknown"} | Target: ${client.target_credit_score ?? "n/a"}
- Monthly revenue: ${revenue != null ? `$${revenue}` : "unknown"}
- Time in business: ${tib != null ? `${tib} months` : "unknown"}
- Funding target: ${client.funding_target ?? "not set"}
- Received so far: ${client.funding_received ?? 0}
- Stage: ${client.stage ?? "intake"}

TOP 5 LENDER MATCHES:
${top5.map((m, i) =>
  `${i + 1}. ${m.lender_name} — ${m.product_name} (${m.category}/${m.product_type})
   Max: $${m.max_amount ?? "?"} | Match: ${m.match_score}/100
   Why: ${m.match_reasons.join("; ")}`
).join("\n\n")}

Give David:
1. Which ONE lender to apply to FIRST and why.
2. Recommended stacking order for the remaining 4.
3. Prep steps before applying (bank statements, LLC docs, etc.).
4. Realistic total funding this client can secure in the next 30 days.

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
      matched_count: top10.length,
      top_lender: top10[0] ?? null,
      strategy,
      matches: top10,
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unknown error" }, 200);
  }
});
