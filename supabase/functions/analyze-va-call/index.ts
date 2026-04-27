// Analyze a VA call (recording / transcript) with AI and return a coaching report.
// Saves result to va_call_logs.ai_analysis. Does NOT push to VA — that is done
// separately via send-coaching-to-va.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { call_log_id } = await req.json();
    if (!call_log_id) throw new Error("call_log_id required");

    const { data: call, error: callErr } = await supabase
      .from("va_call_logs")
      .select("id, transcript, va_notes, duration_seconds, disposition, call_status, recording_url")
      .eq("id", call_log_id)
      .maybeSingle();

    if (callErr) throw callErr;
    if (!call) throw new Error("Call log not found");

    const inputText = (call.transcript || "").trim() || (call.va_notes || "").trim();
    if (!inputText) {
      return new Response(
        JSON.stringify({ error: "No transcript or notes available for this call" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              `You are an elite sales coach reviewing an outbound sales call by a Brandaro VA (Virtual Assistant).
Your job is to (1) score the call, (2) identify specific things the VA did well, (3) point out concrete things they should improve, (4) give actionable tactics on how they should handle similar calls next time, and (5) give specific better rebuttals/scripts they could have said.
Be specific, reference moments from the transcript when possible, and write in plain coaching language the VA can act on. Do not be generic.`,
          },
          {
            role: "user",
            content:
              `Call duration: ${call.duration_seconds ?? "unknown"}s\nDisposition: ${call.disposition ?? "n/a"}\nStatus: ${call.call_status ?? "n/a"}\n\nTRANSCRIPT / NOTES:\n${inputText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "coaching_report",
              description: "Return structured coaching feedback for the VA",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string", description: "2-3 sentence summary of what happened on the call" },
                  overall_score: { type: "number", description: "0-10 rating of the VA's performance" },
                  coaching_note: { type: "string", description: "One-sentence headline coaching message" },
                  va_strengths: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific things the VA did well",
                  },
                  va_improvements: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific things the VA should improve",
                  },
                  missed_opportunities: {
                    type: "array",
                    items: { type: "string" },
                    description: "Buying signals or opportunities the VA missed",
                  },
                  recommended_rebuttals: {
                    type: "array",
                    items: { type: "string" },
                    description: "Better rebuttals or scripts the VA could have used",
                  },
                  handling_tips: {
                    type: "array",
                    items: { type: "string" },
                    description: "Concrete tactics for how the VA should handle this type of call next time",
                  },
                  objections_raised: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
                required: [
                  "summary",
                  "overall_score",
                  "coaching_note",
                  "va_strengths",
                  "va_improvements",
                  "handling_tips",
                  "recommended_rebuttals",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "coaching_report" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI returned no analysis");

    const analysis = JSON.parse(toolCall.function.arguments);
    analysis.analyzed_at = new Date().toISOString();
    analysis.model = "google/gemini-3-flash-preview";

    const { error: updateErr } = await supabase
      .from("va_call_logs")
      .update({ ai_analysis: analysis })
      .eq("id", call_log_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-va-call error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
