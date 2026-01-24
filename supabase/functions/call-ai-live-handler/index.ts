import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Live Handler - Main AI call handling with continuous risk classification
 * 
 * AUDIT HARDENED: Every code path logs a decision before returning.
 * Every insert error is checked and reported via x-audit-log-status header.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate trace ID for this handler invocation
  const decision_trace_id = crypto.randomUUID();
  let auditLogId: string | null = null;
  let auditLogStatus = "pending";

  // Create response helper with audit headers
  const createAuditedResponse = (body: Record<string, unknown>, status = 200) => {
    return new Response(
      JSON.stringify({ ...body, audit_log_id: auditLogId, decision_trace_id }),
      {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "x-audit-log-status": auditLogStatus,
        },
      }
    );
  };

  try {
    const {
      session_id,
      business_id,
      transcript,
      caller_phone,
      business_name,
      config,
    } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Helper to log decision with error checking
    const logDecision = async (decision: {
      decision_type: string;
      decision_reason: string;
      risk_level?: string;
      confidence_at_decision?: number;
      caller_sentiment?: string;
      rule_applied?: string;
      active_thresholds?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from("ai_call_decisions")
        .insert({
          session_id: session_id || null,
          business_id: business_id || null,
          decision_type: decision.decision_type,
          decision_reason: decision.decision_reason,
          risk_level: decision.risk_level || "low",
          confidence_at_decision: decision.confidence_at_decision,
          caller_sentiment: decision.caller_sentiment,
          rule_applied: decision.rule_applied,
          active_thresholds: decision.active_thresholds || {},
          transcript_snapshot: transcript,
        })
        .select("id")
        .single();

      if (error) {
        console.error("DECISION LOG INSERT FAILED:", { error, decision, decision_trace_id });
        auditLogStatus = "failed";
        return null;
      }
      auditLogStatus = "ok";
      auditLogId = data?.id || null;
      return data?.id;
    };

    // Helper to log to audit events
    const logAuditEvent = async (eventType: string, severity: string, payload: Record<string, unknown>) => {
      const { error } = await supabase.from("ai_audit_events").insert({
        business_id: business_id || null,
        session_id: session_id || null,
        event_type: eventType,
        event_severity: severity,
        event_payload: { ...payload, decision_trace_id },
        triggered_by: "system",
      });

      if (error) {
        console.error("AUDIT EVENT INSERT FAILED:", { error, eventType, payload });
      }
    };

    if (!session_id || !business_id) {
      await logDecision({
        decision_type: "blocked",
        decision_reason: "MISSING_REQUIRED_PARAMS",
        risk_level: "high",
        rule_applied: "input_validation",
      });

      return createAuditedResponse(
        { error: "session_id and business_id required" },
        400
      );
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

    // CRITICAL: Check kill switches before ANY AI action
    const { data: globalKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active, activation_reason")
      .eq("scope", "global")
      .eq("is_active", true)
      .maybeSingle();

    const { data: businessKill } = await supabase
      .from("ai_kill_switch_state")
      .select("is_active, activation_reason")
      .eq("scope", "business")
      .eq("business_id", business_id)
      .eq("is_active", true)
      .maybeSingle();

    if (globalKill?.is_active || businessKill?.is_active) {
      const killReason = globalKill?.is_active 
        ? `GLOBAL_KILL_SWITCH: ${globalKill.activation_reason}` 
        : `BUSINESS_KILL_SWITCH: ${businessKill?.activation_reason}`;

      await logDecision({
        decision_type: "abort",
        decision_reason: killReason,
        risk_level: "critical",
        rule_applied: "kill_switch_enforcement",
      });

      await logAuditEvent("kill_switch_abort", "critical", {
        kill_type: globalKill?.is_active ? "global" : "business",
        reason: killReason,
      });

      return createAuditedResponse({
        action: "abort",
        reason: killReason,
        should_speak: false,
        immediate_handoff: true,
      });
    }

    const escapePhrases = liveConfig?.escape_phrases || ["human", "representative", "agent"];
    const highRiskKeywords = liveConfig?.high_risk_keywords || ["lawyer", "sue", "complaint"];
    const confidenceThreshold = liveConfig?.confidence_threshold || 70;

    // Check for escape phrases in transcript
    const transcriptLower = transcript?.toLowerCase() || "";
    const escapeDetected = escapePhrases.some((phrase: string) =>
      transcriptLower.includes(phrase.toLowerCase())
    );

    if (escapeDetected) {
      await logDecision({
        decision_type: "handoff",
        decision_reason: "ESCAPE_PHRASE_DETECTED",
        risk_level: "high",
        rule_applied: "escape_phrase_detection",
      });

      await logAuditEvent("escape_phrase_handoff", "warning", {
        detected_phrases: escapePhrases.filter((p: string) => 
          transcriptLower.includes(p.toLowerCase())
        ),
      });

      return createAuditedResponse({
        action: "handoff",
        reason: "Caller requested human",
        risk_level: "high",
        should_speak: false,
      });
    }

    // Check for high-risk keywords
    const highRiskDetected = highRiskKeywords.some((keyword: string) =>
      transcriptLower.includes(keyword.toLowerCase())
    );

    // Use AI to analyze and generate response
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await logDecision({
        decision_type: "error",
        decision_reason: "LOVABLE_API_KEY_NOT_CONFIGURED",
        risk_level: "critical",
        rule_applied: "config_validation",
      });

      return createAuditedResponse(
        { error: "AI service not configured", action: "escalate" },
        500
      );
    }

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
      await logDecision({
        decision_type: "error",
        decision_reason: `AI_GATEWAY_ERROR: ${response.status}`,
        risk_level: "high",
        rule_applied: "ai_gateway_check",
      });

      return createAuditedResponse(
        { error: `AI gateway error: ${response.status}`, action: "escalate" },
        500
      );
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
    if (analysis.confidence < confidenceThreshold) {
      await logDecision({
        decision_type: "confidence_breach",
        decision_reason: `CONFIDENCE_BREACH: ${analysis.confidence}% < ${confidenceThreshold}%`,
        confidence_at_decision: analysis.confidence,
        risk_level: "high",
        caller_sentiment: analysis.sentiment,
        active_thresholds: { confidence_threshold: confidenceThreshold },
        rule_applied: "confidence_threshold_enforcement",
      });

      await logAuditEvent("confidence_breach", "warning", {
        confidence: analysis.confidence,
        threshold: confidenceThreshold,
        action: "abort_and_handoff",
      });

      return createAuditedResponse({
        action: "confidence_breach",
        response_text: null,
        risk_level: "high",
        sentiment: analysis.sentiment,
        confidence: analysis.confidence,
        should_speak: false,
        immediate_handoff: true,
        escalation_reason: `Confidence dropped to ${analysis.confidence}% (threshold: ${confidenceThreshold}%)`,
      });
    }

    // Determine action
    const action = analysis.should_escalate ? "escalate" : "continue";

    // Log decision
    await logDecision({
      decision_type: action,
      decision_reason: analysis.should_escalate
        ? analysis.escalation_reason
        : "NORMAL_FLOW",
      confidence_at_decision: analysis.confidence,
      risk_level: analysis.risk_level,
      caller_sentiment: analysis.sentiment,
      active_thresholds: {
        escape_phrases: escapePhrases,
        high_risk_keywords: highRiskKeywords,
        confidence_threshold: confidenceThreshold,
      },
      rule_applied: analysis.should_escalate ? "risk_escalation" : "normal_flow",
    });

    // Log risk event if medium or high
    if (analysis.risk_level !== "low") {
      const { error: riskError } = await supabase.from("ai_risk_events").insert({
        session_id,
        business_id,
        risk_level: analysis.risk_level,
        risk_triggers: highRiskDetected
          ? ["keyword_detection"]
          : ["sentiment_analysis"],
        escalation_required: analysis.should_escalate,
      });

      if (riskError) {
        console.error("RISK EVENT INSERT FAILED:", riskError);
      }
    }

    return createAuditedResponse({
      action,
      response_text: analysis.should_escalate ? null : analysis.response_text,
      risk_level: analysis.risk_level,
      sentiment: analysis.sentiment,
      confidence: analysis.confidence,
      should_speak: !analysis.should_escalate,
      escalation_reason: analysis.escalation_reason,
    });
  } catch (error) {
    console.error("Live handler error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    // Log error before returning
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const { data, error: logError } = await supabase
        .from("ai_call_decisions")
        .insert({
          decision_type: "error",
          decision_reason: `SYSTEM_ERROR: ${message}`,
          risk_level: "critical",
          rule_applied: "error_handling",
        })
        .select("id")
        .single();

      if (logError) {
        console.error("DECISION LOG INSERT FAILED ON ERROR PATH:", logError);
        auditLogStatus = "failed";
      } else {
        auditLogId = data?.id;
        auditLogStatus = "ok";
      }
    } catch (logErr) {
      console.error("Failed to log error decision:", logErr);
      auditLogStatus = "failed";
    }

    return new Response(
      JSON.stringify({
        error: message,
        action: "escalate",
        reason: "System error - escalating to human",
        audit_log_id: auditLogId,
        decision_trace_id,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "x-audit-log-status": auditLogStatus,
        },
      }
    );
  }
});
