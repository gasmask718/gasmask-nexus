// VA Next-Call Coach — Aggregates recent calls and asks an AI coach
// (Lovable AI Gateway) for concrete recommendations to improve the
// VA's next outbound calls.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = Math.min(Number(body?.limit) || 25, 100);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: calls, error } = await admin
      .from("va_call_logs")
      .select(
        "id, called_at, duration_seconds, disposition, excitement_level, call_summary, va_notes, transcript, ai_analysis"
      )
      .eq("va_id", userId)
      .order("called_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    if (!calls || calls.length === 0) {
      return new Response(
        JSON.stringify({
          recommendations: [],
          summary: "No recent calls found. Make a few calls and run AI Analysis again.",
          patterns: [],
          scripts: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const condensed = calls.map((c: any, i: number) => ({
      i: i + 1,
      at: c.called_at,
      dur: c.duration_seconds,
      disp: c.disposition,
      mood: c.excitement_level,
      summary: c.call_summary || c.va_notes || "",
      transcript: (c.transcript || "").slice(0, 1200),
    }));

    const systemPrompt = `You are an elite sales coach analyzing a virtual assistant's recent outbound call performance.
Identify patterns, recurring objections, missed opportunities, and concrete tactical changes.
Be direct, specific, and actionable. Reference call numbers (#1, #2…) when citing examples.`;

    const userPrompt = `Here are the VA's last ${calls.length} calls (JSON):\n\n${JSON.stringify(
      condensed
    )}\n\nReturn analysis using the provided tool.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "next_call_coaching",
              description: "Structured coaching analysis for the VA's next calls.",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "1-2 sentence overall verdict" },
                  patterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Recurring patterns / problems across the calls",
                  },
                  recommendations: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        action: { type: "string", description: "Concrete next step" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                      },
                      required: ["title", "action", "priority"],
                    },
                  },
                  scripts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Exact lines/openers/rebuttals to try on next call",
                  },
                  overall_score: { type: "integer", minimum: 0, maximum: 100 },
                },
                required: ["summary", "patterns", "recommendations", "scripts", "overall_score"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "next_call_coaching" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(
        JSON.stringify({ error: `AI gateway: ${aiResp.status} ${t.slice(0, 300)}` }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    if (!args) throw new Error("AI returned no structured output");

    // Persist as a coaching report (self-coached entry)
    await admin.from("brandaro_va_coaching").insert({
      va_user_id: userId,
      manager_user_id: userId,
      coaching_type: "ai_self_analysis",
      summary: args.summary,
      strengths: [],
      weak_points: args.patterns || [],
      handling_tips: (args.recommendations || []).map((r: any) => `${r.title}: ${r.action}`),
      recommendations: args.scripts || [],
      improvement_target: args.recommendations?.[0]?.action || null,
      quality_score: args.overall_score,
      rating: Math.round((args.overall_score || 0) / 10),
    });

    return new Response(JSON.stringify({ ...args, calls_analyzed: calls.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("va-next-call-coach error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
