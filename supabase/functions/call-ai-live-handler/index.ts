import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Live Handler - Main AI call handling with continuous risk classification
 * 
 * This function:
 * - Generates AI responses for live calls
 * - Continuously classifies risk level
 * - Triggers immediate escalation on high-risk signals
 * - Logs every decision to the audit ledger
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      session_id,
      business_id,
      transcript,
      caller_phone,
      business_name,
      config, // Passed from gate check
    } = await req.json();

    if (!session_id || !business_id) {
      return new Response(
        JSON.stringify({ error: "session_id and business_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Fetch config if not passed
    let liveConfig = config;
    if (!liveConfig) {
      const { data } = await supabase
        .from("ai_call_agent_config")
        .select("*")
        .eq("business_id", business_id)
        .single();
      liveConfig = data;
    }

    // CRITICAL: Check kill switches before ANY AI action (mid-call enforcement)
    const { data: globalKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active")
      .eq("scope", "global")
      .eq("is_active", true)
      .maybeSingle();

    const { data: businessKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active")
      .eq("scope", "business")
      .eq("business_id", business_id)
      .eq("is_active", true)
      .maybeSingle();

    if (globalKill?.is_active || businessKill?.is_active) {
      // IMMEDIATE ABORT - Kill switch activated mid-call
      await supabase.from("ai_call_decisions").insert({
        session_id,
        business_id,
        decision_type: "abort",
        decision_reason: "KILL SWITCH ACTIVE - AI speech immediately halted",
        risk_level: "critical",
        rule_applied: "kill_switch_enforcement",
        transcript_snapshot: transcript,
      });

      return new Response(
        JSON.stringify({
          action: "abort",
          reason: "KILL SWITCH ACTIVE",
          should_speak: false,
          immediate_handoff: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const escapePhrases = liveConfig?.escape_phrases || ["human", "representative", "agent"];
    const highRiskKeywords = liveConfig?.high_risk_keywords || ["lawyer", "sue", "complaint"];

    // Check for escape phrases in transcript
    const transcriptLower = transcript?.toLowerCase() || "";
    const escapeDetected = escapePhrases.some((phrase: string) => 
      transcriptLower.includes(phrase.toLowerCase())
    );

    if (escapeDetected) {
      // Log decision and trigger immediate handoff
      await supabase.from("ai_call_decisions").insert({
        session_id,
        business_id,
        decision_type: "handoff",
        decision_reason: "Caller requested human representative",
        risk_level: "high",
        rule_applied: "escape_phrase_detection",
        transcript_snapshot: transcript,
      });

      return new Response(
        JSON.stringify({
          action: "handoff",
          reason: "Caller requested human",
          risk_level: "high",
          should_speak: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for high-risk keywords
    const highRiskDetected = highRiskKeywords.some((keyword: string) =>
      transcriptLower.includes(keyword.toLowerCase())
    );

    // Use AI to analyze and generate response
    const systemPrompt = `You are an AI call assistant for ${business_name || "the business"}. 
You must:
1. Be helpful, professional, and concise
2. NEVER claim to be human - always acknowledge you're an AI assistant if asked
3. If the caller seems upset, frustrated, or mentions anything legal/complaint-related, indicate escalation is needed
4. Keep responses under 50 words

Analyze the conversation and provide:
1. A response to speak (if appropriate)
2. Current risk level (low, medium, high)
3. Caller sentiment (positive, neutral, negative, angry)
4. Whether to continue or escalate

Current transcript:
${transcript || "[Call just started]"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate your response and risk assessment." },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "call_response",
              description: "Generate response and risk assessment for the call",
              parameters: {
                type: "object",
                properties: {
                  response_text: { type: "string", description: "What the AI should say" },
                  risk_level: { type: "string", enum: ["low", "medium", "high"] },
                  sentiment: { type: "string", enum: ["positive", "neutral", "negative", "angry"] },
                  should_escalate: { type: "boolean" },
                  escalation_reason: { type: "string" },
                  confidence: { type: "number" },
                },
                required: ["response_text", "risk_level", "sentiment", "should_escalate", "confidence"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "call_response" } },
      }),
    });

    if (!response.ok) {
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    let analysis = {
      response_text: "",
      risk_level: highRiskDetected ? "high" : "low",
      sentiment: "neutral",
      should_escalate: highRiskDetected,
      escalation_reason: highRiskDetected ? "High-risk keywords detected" : "",
      confidence: 70,
    };

    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch {
        console.error("Failed to parse AI response");
      }
    }

    // Override risk level if high-risk keywords detected
    if (highRiskDetected && analysis.risk_level !== "high") {
      analysis.risk_level = "high";
      analysis.should_escalate = true;
      analysis.escalation_reason = "High-risk keywords detected in conversation";
    }

    // CRITICAL: Mid-call confidence threshold breach check
    const confidenceThreshold = liveConfig?.confidence_threshold || 70;
    if (analysis.confidence < confidenceThreshold) {
      // Confidence dropped below threshold - ABORT AI and escalate
      await supabase.from("ai_call_decisions").insert({
        session_id,
        business_id,
        decision_type: "confidence_breach",
        decision_reason: `Confidence ${analysis.confidence}% dropped below ${confidenceThreshold}% threshold - AI aborted`,
        confidence_at_decision: analysis.confidence,
        risk_level: "high",
        active_thresholds: { confidence_threshold: confidenceThreshold },
        rule_applied: "confidence_threshold_enforcement",
        caller_sentiment: analysis.sentiment,
        transcript_snapshot: transcript,
      });

      // Log to audit events for regulatory trail
      await supabase.rpc("log_ai_audit_event", {
        p_business_id: business_id,
        p_event_type: "confidence_breach",
        p_event_severity: "warning",
        p_session_id: session_id,
        p_event_payload: {
          confidence: analysis.confidence,
          threshold: confidenceThreshold,
          action: "abort_and_handoff",
        },
        p_confidence: analysis.confidence,
        p_transcript_snapshot: transcript,
        p_triggered_by: "system",
      });

      return new Response(
        JSON.stringify({
          action: "confidence_breach",
          response_text: null,
          risk_level: "high",
          sentiment: analysis.sentiment,
          confidence: analysis.confidence,
          should_speak: false,
          immediate_handoff: true,
          escalation_reason: `Confidence dropped to ${analysis.confidence}% (threshold: ${confidenceThreshold}%)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine action
    const action = analysis.should_escalate ? "escalate" : "continue";

    // Log decision
    await supabase.from("ai_call_decisions").insert({
      session_id,
      business_id,
      decision_type: action,
      decision_reason: analysis.should_escalate 
        ? analysis.escalation_reason 
        : "Conversation proceeding normally",
      confidence_at_decision: analysis.confidence,
      risk_level: analysis.risk_level,
      active_thresholds: {
        escape_phrases: escapePhrases,
        high_risk_keywords: highRiskKeywords,
        confidence_threshold: confidenceThreshold,
      },
      rule_applied: analysis.should_escalate ? "risk_escalation" : "normal_flow",
      caller_sentiment: analysis.sentiment,
      transcript_snapshot: transcript,
    });

    // Log risk event if medium or high
    if (analysis.risk_level !== "low") {
      await supabase.from("ai_risk_events").insert({
        session_id,
        business_id,
        risk_level: analysis.risk_level,
        risk_triggers: highRiskDetected 
          ? ["keyword_detection"] 
          : ["sentiment_analysis"],
        escalation_required: analysis.should_escalate,
      });
    }

    return new Response(
      JSON.stringify({
        action,
        response_text: analysis.should_escalate ? null : analysis.response_text,
        risk_level: analysis.risk_level,
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        should_speak: !analysis.should_escalate,
        escalation_reason: analysis.escalation_reason,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Live handler error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ 
        error: message, 
        action: "escalate",
        reason: "System error - escalating to human",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});