import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * brandaro-call-analyzer
 * 
 * Analyzes call notes/transcripts using AI to extract:
 * - Objections
 * - Intent level
 * - Services requested
 * - Urgency
 * - Recommended next action
 * 
 * Triggered after call logging or transcript availability.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { call_log_id, dry_run } = await req.json();

    if (dry_run) {
      return new Response(JSON.stringify({ ok: true, dry_run: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!call_log_id) {
      return new Response(JSON.stringify({ error: "call_log_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch call log
    const { data: callLog, error: clErr } = await supabase
      .from("brandaro_call_logs")
      .select("*")
      .eq("id", call_log_id)
      .single();

    if (clErr || !callLog) {
      return new Response(JSON.stringify({ error: "Call log not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for transcript
    const { data: transcript } = await supabase
      .from("brandaro_call_transcripts")
      .select("transcript_text")
      .eq("call_log_id", call_log_id)
      .single();

    const textToAnalyze = transcript?.transcript_text || callLog.call_notes || "";
    if (!textToAnalyze) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no text to analyze" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze with AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a sales call analyst. Analyze the following call notes/transcript from a website sales call and extract structured intelligence. The business sells professional websites to local businesses.`,
          },
          {
            role: "user",
            content: `Call outcome: ${callLog.call_outcome}
Industry: ${callLog.industry_context || "unknown"}
Call notes/transcript:
${textToAnalyze}

Extract the following and return ONLY valid JSON:`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_call_insights",
            description: "Return structured call analysis",
            parameters: {
              type: "object",
              properties: {
                objections: { type: "array", items: { type: "string" }, description: "List of objections raised (e.g., 'too expensive', 'not now', 'already have website')" },
                intent_level: { type: "string", enum: ["none", "low", "medium", "high", "very_high"], description: "How interested is the prospect" },
                services_requested: { type: "array", items: { type: "string" }, description: "Services they asked about" },
                business_type: { type: "string", description: "Type of business" },
                urgency: { type: "string", enum: ["none", "low", "medium", "high"], description: "How urgent is their need" },
                sentiment: { type: "string", enum: ["hostile", "negative", "neutral", "positive", "enthusiastic"], description: "Overall tone" },
                key_phrases: { type: "array", items: { type: "string" }, description: "Important phrases or quotes" },
                closing_angle: { type: "string", description: "Best angle to close this prospect" },
                ai_summary: { type: "string", description: "1-2 sentence summary" },
                ai_recommended_next: { type: "string", description: "Recommended next action" },
              },
              required: ["objections", "intent_level", "urgency", "sentiment", "ai_summary", "ai_recommended_next"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "return_call_insights" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call response from AI");

    const insights = JSON.parse(toolCall.function.arguments);

    // Store insights
    const { error: insErr } = await supabase.from("brandaro_call_insights").insert({
      call_log_id,
      lead_id: callLog.lead_id,
      objections: insights.objections || [],
      intent_level: insights.intent_level || "unknown",
      services_requested: insights.services_requested || [],
      business_type: insights.business_type || null,
      urgency: insights.urgency || "low",
      sentiment: insights.sentiment || "neutral",
      key_phrases: insights.key_phrases || [],
      closing_angle: insights.closing_angle || null,
      ai_summary: insights.ai_summary || null,
      ai_recommended_next: insights.ai_recommended_next || null,
    });

    if (insErr) {
      console.error("[CALL-ANALYZER] Failed to store insights:", insErr);
      throw insErr;
    }

    // Update objection tags on call log for quick filtering
    if (insights.objections?.length > 0) {
      await supabase.from("brandaro_call_logs").update({
        objection_tags: insights.objections,
      }).eq("id", call_log_id);
    }

    console.log(`[CALL-ANALYZER] ✅ Analyzed call ${call_log_id}: intent=${insights.intent_level}, objections=${insights.objections?.length || 0}`);

    return new Response(JSON.stringify({ ok: true, insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[CALL-ANALYZER] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
