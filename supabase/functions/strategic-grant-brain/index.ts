// supabase/functions/strategic-grant-brain/index.ts
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

    const { data: grantMatches, error: matchErr } = await supabase
      .from("client_grant_matches")
      .select("*")
      .eq("client_id", client_id)
      .neq("status", "ineligible")
      .order("eligibility_score", { ascending: false });

    if (matchErr) return json({ error: matchErr.message, client_id }, 200);

    const matchedCount = grantMatches?.length ?? 0;

    if (matchedCount === 0) {
      return json({
        client_id,
        matched_count: 0,
        strategy: "",
        message: "No grant matches found. Run grant-eligibility-check first.",
      });
    }

    const { data: applications } = await supabase
      .from("grant_applications")
      .select("*")
      .eq("funding_client_id", client_id);

    const topGrant = grantMatches?.[0] ?? null;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return json({
        client_id,
        matched_count: matchedCount,
        strategy: "",
        top_grant: topGrant,
        error: "ANTHROPIC_API_KEY not configured",
      });
    }

    const fullName = client.full_name
      ?? [client.first_name, client.last_name].filter(Boolean).join(" ")
      ?? "Client";

    const prompt = `You are David's Grant Strategist. Build a Grant Attack Plan for this client.

CLIENT PROFILE:
- Name: ${fullName}
- Business: ${client.business_name ?? "n/a"}
- State: ${client.state ?? "n/a"}
- Stage: ${client.stage ?? "intake"}
- Credit score: ${client.credit_score_estimate ?? "unknown"}
- Minority-owned: ${client.minority_owned ? "YES" : "no"}
- Women-owned: ${client.women_owned ? "YES" : "no"}
- Veteran-owned: ${client.veteran_owned ? "YES" : "no"}

MATCHED GRANTS (${matchedCount}):
${(grantMatches ?? []).slice(0, 15).map((m: any, i: number) => {
  const amount = m.grant_amount ? `$${m.grant_amount}` : "amount n/a";
  return `${i + 1}. ${m.grant_name}
   Amount: ${amount}
   Eligibility: ${m.eligibility_score ?? 0}/100
   Deadline: ${m.deadline ?? "n/a"}
   Status: ${m.status ?? "?"}`;
}).join("\n\n")}

ACTIVE APPLICATIONS (${applications?.length ?? 0}):
${(applications ?? []).map((a: any) =>
  `- ${a.grant_name ?? a.grant_id ?? "?"} | ${a.status ?? "?"} | submitted: ${a.submitted_at ?? "not yet"}`
).join("\n") || "None open"}

Give David the GRANT ATTACK PLAN:
1. TOP 3 grants ranked by best odds × highest amount — say WHY each is top.
2. For grant #1, exact next action David should take today.
3. Which grants to skip and why.
4. Realistic 90-day total grant capture.

Under 400 words. Direct, tactical.`;

    let strategy = "";
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
          max_tokens: 1800,
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
        note_type: "grant",
        content: strategy,
        is_pinned: true,
        created_by: "Grant Brain",
      });
    }

    return json({
      client_id,
      matched_count: matchedCount,
      strategy,
      top_grant: topGrant,
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unknown error" }, 200);
  }
});
