// supabase/functions/credit-analysis-brain/index.ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    const { data: negatives } = await supabase
      .from("funding_credit_items")
      .select("*")
      .eq("client_id", client_id);

    const { data: disputes } = await supabase
      .from("funding_dispute_rounds")
      .select("*")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });

    const { data: scoreHistory } = await supabase
      .from("client_score_history")
      .select("score_date, score_tu, score_eq, score_ex")
      .eq("client_id", client_id)
      .order("score_date", { ascending: false })
      .limit(12);

    const { data: notes } = await supabase
      .from("client_notes")
      .select("note_type, content, created_at")
      .eq("client_id", client_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const scoreCurrent = client.credit_score_estimate ?? null;
    const negativesCount = negatives?.length ?? 0;
    const disputeRounds = disputes?.length ?? 0;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return json({
        error: "ANTHROPIC_API_KEY not configured",
        client_id,
      }, 200);
    }

    const prompt = `You are David's Credit Repair Strategist. Analyze this client and give a specific, actionable credit repair strategy.

CLIENT:
- Name: ${client.first_name} ${client.last_name}
- Current credit score estimate: ${scoreCurrent ?? "unknown"}
- Target credit score: ${client.target_credit_score ?? "not set"}
- Stage: ${client.stage ?? "intake"}
- TU: ${client.score_tu ?? "n/a"} | EQ: ${client.score_eq ?? "n/a"} | EX: ${client.score_ex ?? "n/a"}

NEGATIVES (${negativesCount}):
${(negatives ?? []).slice(0, 20).map((n: any) =>
  `- ${n.item_type ?? "item"} | ${n.creditor ?? "?"} | $${n.balance ?? 0} | status: ${n.status ?? "?"}`
).join("\n") || "None on file"}

DISPUTE ROUNDS (${disputeRounds}):
${(disputes ?? []).slice(0, 5).map((d: any) =>
  `- Round ${d.round_number ?? "?"} | ${d.bureau ?? "?"} | ${d.status ?? "?"} | ${d.created_at?.split("T")[0]}`
).join("\n") || "No disputes yet"}

SCORE TREND (last 12):
${(scoreHistory ?? []).map((s: any) =>
  `- ${s.score_date}: TU ${s.score_tu ?? "-"} / EQ ${s.score_eq ?? "-"} / EX ${s.score_ex ?? "-"}`
).join("\n") || "No history"}

RECENT NOTES:
${(notes ?? []).map((n: any) => `- [${n.note_type}] ${n.content?.slice(0, 200)}`).join("\n") || "None"}

Give David:
1. A 2-sentence assessment of where this client stands.
2. The single highest-impact next action (be specific — which bureau, which account, which round type).
3. Realistic 60-day score projection.
4. Any red flags or blockers.

Keep it under 350 words. Direct, tactical, no fluff.`;

    let analysis = "";
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

      if (!resp.ok) {
        const errText = await resp.text();
        return json({
          error: `Anthropic API error: ${resp.status}`,
          detail: errText.slice(0, 500),
          client_id,
        }, 200);
      }

      const data = await resp.json();
      analysis = data?.content?.[0]?.text ?? "";
    } catch (e) {
      return json({
        error: "Anthropic call failed",
        detail: (e as Error).message,
        client_id,
      }, 200);
    }

    if (!analysis) {
      return json({ error: "Empty analysis from Anthropic", client_id }, 200);
    }

    await supabase.from("client_notes").insert({
      client_id,
      note_type: "credit",
      content: analysis,
      is_pinned: true,
      created_by: "AI Brain",
    });

    await supabase
      .from("funding_clients")
      .update({
        ai_last_analysis: analysis,
        ai_analysis_date: new Date().toISOString(),
      })
      .eq("id", client_id);

    return json({
      client_id,
      analysis,
      score_current: scoreCurrent,
      negatives_count: negativesCount,
      dispute_rounds: disputeRounds,
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unknown error" }, 200);
  }
});
