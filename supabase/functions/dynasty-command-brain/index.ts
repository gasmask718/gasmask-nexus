import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { command } = await req.json();
    if (!command?.trim()) {
      return new Response(JSON.stringify({ error: "No command provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get context: store count, recent tasks, alerts
    const [storeCount, recentTasks, recentAlerts, healthScores] = await Promise.all([
      supabase.from("store_master").select("*", { count: "exact", head: true }),
      supabase.from("ai_work_tasks").select("id, task_title, status").order("created_at", { ascending: false }).limit(10),
      supabase.from("ai_drift_alerts").select("id, message, severity, status").order("created_at", { ascending: false }).limit(10),
      supabase.from("store_health_scores").select("store_id, overall_score, health_status").order("overall_score", { ascending: true }).limit(10),
    ]);

    const systemPrompt = `You are the Dynasty OS Command Brain — an AI operations director for a multi-brand tobacco/grabba retail platform.

You have access to these databases and can issue structured commands:
- store_master: ${storeCount.count || 0} stores with names, addresses, contacts
- store_notes: Account notes (some legacy with HTML)
- checklist_tube_intelligence: Product tube counts per store (products: GasMask Bags, GasMask Tubes, HotMama, Grabba R Us, Hot Scolatti Light, Hot Scolatti Dark, HotScalati Bros)
- store_health_scores: 0-100 health scores per store
- ai_work_tasks: AI-generated tasks
- ai_drift_alerts: System alerts
- ai_instinct_log: AI reasoning trail
- dynasty_agents: 24 autonomous agents across 5 tiers

Recent system state:
- Bottom 10 health scores: ${JSON.stringify(healthScores.data?.map((s: any) => ({ score: s.overall_score, status: s.health_status })) || [])}
- Recent tasks: ${JSON.stringify(recentTasks.data?.map((t: any) => ({ title: t.task_title, status: t.status })) || [])}
- Recent alerts: ${JSON.stringify(recentAlerts.data?.map((a: any) => ({ message: a.message, severity: a.severity })) || [])}

Respond with JSON only:
{
  "action": "QUERY_STORES" | "RUN_AGENT" | "CREATE_TASKS" | "SHOW_ALERTS" | "SHOW_HEALTH" | "RUN_REPORT" | "GENERAL_ANSWER",
  "params": { ... },
  "explanation": "Brief explanation of what you found/did",
  "results": [ ... ] // array of result items if applicable
}

For QUERY_STORES, query the database and return results.
For GENERAL_ANSWER, provide a helpful text response.
Always be specific with real numbers from the context provided.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: command }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic error:", response.status, errText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiText = aiData.content?.[0]?.text || "";

    // Try to parse as JSON
    let parsed;
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { action: "GENERAL_ANSWER", explanation: aiText };
    } catch {
      parsed = { action: "GENERAL_ANSWER", explanation: aiText };
    }

    // Execute action if needed
    if (parsed.action === "SHOW_HEALTH") {
      const { data: scores } = await supabase
        .from("store_health_scores")
        .select("store_id, overall_score, health_status, dimension_scores")
        .order("overall_score", { ascending: true })
        .limit(parsed.params?.limit || 20);

      // Enrich with store names
      if (scores?.length) {
        const storeIds = scores.map((s: any) => s.store_id);
        const { data: storeNames } = await supabase.from("store_master").select("id, store_name").in("id", storeIds);
        const nameMap = Object.fromEntries((storeNames || []).map((s: any) => [s.id, s.store_name]));
        parsed.results = scores.map((s: any) => ({ ...s, store_name: nameMap[s.store_id] || "Unknown" }));
      }
    }

    // Log to ai_instinct_log
    await supabase.from("ai_instinct_log").insert({
      action_type: "command_brain",
      reasoning: `Command: "${command}" → Action: ${parsed.action}`,
      input_data: { command },
      decision_path: parsed,
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Command brain error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
