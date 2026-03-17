import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { client_id, dry_run } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client info
    const { data: client } = await supabase
      .from("brandaro_clients")
      .select("*, brandaro_projects(*)")
      .eq("id", client_id)
      .single();

    if (!client) throw new Error("Client not found");

    // Get last 30 days of metrics
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
    const { data: metrics } = await supabase
      .from("brandaro_client_metrics")
      .select("*")
      .eq("client_id", client_id)
      .gte("period_date", thirtyDaysAgo)
      .order("period_date", { ascending: true });

    // Get recent lead events for pattern analysis
    const { data: recentEvents } = await supabase
      .from("brandaro_lead_events")
      .select("event_type, page_url, created_at")
      .eq("client_id", client_id)
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    // Build analysis prompt
    const totalVisitors = metrics?.reduce((s, m) => s + (m.total_visitors || 0), 0) || 0;
    const totalLeads = metrics?.reduce((s, m) => s + (m.leads_generated || 0), 0) || 0;
    const totalCalls = metrics?.reduce((s, m) => s + (m.calls_generated || 0), 0) || 0;
    const convRate = totalVisitors > 0 ? ((totalLeads / totalVisitors) * 100).toFixed(1) : "0";

    const prompt = `You are a website conversion optimization expert. Analyze this client's website performance and generate specific, actionable optimization tasks.

CLIENT: ${client.business_name}
PACKAGE: ${client.package_chosen || "standard"}

LAST 30 DAYS METRICS:
- Total Visitors: ${totalVisitors}
- Leads Generated: ${totalLeads}
- Calls Generated: ${totalCalls}
- Conversion Rate: ${convRate}%

RECENT EVENT PATTERNS:
${JSON.stringify(recentEvents?.slice(0, 50) || [], null, 2)}

Generate 3-5 specific optimization tasks. For each task provide:
1. task_type: one of (headline_improvement, cta_optimization, seo_fix, layout_change, content_update)
2. page_target: which page to optimize
3. current_issue: what's wrong
4. suggested_fix: specific improvement
5. priority: low, medium, high, or critical
6. reasoning: why this will improve conversions`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        tools: [{
          type: "function",
          function: {
            name: "generate_optimizations",
            description: "Generate website optimization tasks",
            parameters: {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      task_type: { type: "string", enum: ["headline_improvement", "cta_optimization", "seo_fix", "layout_change", "content_update"] },
                      page_target: { type: "string" },
                      current_issue: { type: "string" },
                      suggested_fix: { type: "string" },
                      priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      reasoning: { type: "string" },
                    },
                    required: ["task_type", "page_target", "current_issue", "suggested_fix", "priority", "reasoning"],
                  },
                },
              },
              required: ["tasks"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_optimizations" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let tasks: any[] = [];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      tasks = parsed.tasks || [];
    }

    // Store optimization tasks
    const project = client.brandaro_projects?.[0];
    for (const task of tasks) {
      await supabase.from("brandaro_optimization_tasks").insert({
        client_id,
        project_id: project?.id || null,
        task_type: task.task_type,
        page_target: task.page_target,
        current_value: task.current_issue,
        suggested_value: task.suggested_fix,
        ai_reasoning: task.reasoning,
        priority: task.priority,
        status: "pending",
        performance_before: { visitors: totalVisitors, leads: totalLeads, conversion_rate: convRate },
      });
    }

    // Generate SEO tasks if conversion rate is low
    if (parseFloat(convRate) < 3 && totalVisitors < 100) {
      const seoTasks = [
        { task_type: "local_seo_page", title: `${client.business_name} - Local SEO Landing Page`, target_keyword: client.business_name?.toLowerCase() },
        { task_type: "gmb_optimization", title: "Google Business Profile Optimization", target_keyword: "" },
        { task_type: "blog_post", title: `Why Choose ${client.business_name}`, target_keyword: "" },
      ];
      for (const seo of seoTasks) {
        await supabase.from("brandaro_seo_tasks").insert({
          client_id,
          project_id: project?.id || null,
          ...seo,
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      optimization_tasks_created: tasks.length,
      metrics_summary: { totalVisitors, totalLeads, totalCalls, convRate },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI optimizer error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
