import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isHealthProbe, healthProbeResponse } from "../_shared/healthProbe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const payload = await req.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return new Response(
        JSON.stringify({ error: "Invalid or empty JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // Liveness probe from comms-health-monitor — answer, never persist.
    if (isHealthProbe(payload)) {
      return healthProbeResponse("bland-webhook", corsHeaders);
    }
    if (!payload.call_id) {
      return new Response(
        JSON.stringify({ error: "Missing required field: call_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("Bland.ai webhook received:", JSON.stringify(payload).slice(0, 500));

    // Extract business unit from agent metadata
    const businessUnit = payload.metadata?.business_unit || "brandaro";

    // Calculate cost (Bland.ai charges $0.09/min)
    const durationSeconds = payload.call_length || 0;
    const costCents = Math.ceil((durationSeconds / 60) * 9);

    // Determine outcome from transcript analysis
    const transcript = payload.concatenated_transcript || "";
    const outcome = determineOutcome(transcript);
    const leadQuality = determineLeadQuality(outcome, transcript);

    // Insert call record
    const { data: call, error: callError } = await supabase
      .from("dynasty_ai_calls")
      .insert({
        call_id: payload.call_id,
        business_unit: businessUnit,
        agent_id: payload.pathway_id || payload.agent_id || "unknown",
        agent_name: payload.metadata?.agent_name || "Unknown",
        direction: payload.metadata?.direction || "outbound",
        from_number: payload.from,
        to_number: payload.to,
        contact_name: payload.metadata?.contact_name,
        company_name: payload.metadata?.company_name,
        transcript: transcript,
        recording_url: payload.recording_url,
        duration_seconds: durationSeconds,
        outcome: outcome,
        lead_quality: leadQuality,
        next_action: determineNextAction(outcome, leadQuality),
        cost_cents: costCents,
        estimated_deal_value_cents: payload.metadata?.estimated_deal_value_cents || null,
        call_started_at: payload.start_time,
        call_ended_at: payload.end_time,
      })
      .select()
      .single();

    if (callError) {
      console.error("Error inserting call:", callError);
      throw callError;
    }

    console.log("Call saved:", call.id, "outcome:", outcome, "quality:", leadQuality);

    // Trigger Claude analysis (async, non-blocking)
    if (transcript.length > 50) {
      EdgeRuntime?.waitUntil?.(
        fetch(`${SUPABASE_URL}/functions/v1/claude-call-analyzer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            call_id: payload.call_id,
            business_unit: businessUnit,
            transcript: transcript,
            duration_seconds: durationSeconds,
            contact_name: payload.metadata?.contact_name,
            company_name: payload.metadata?.company_name,
          }),
        }).catch((err) => console.error("Claude analysis trigger failed:", err))
      ) ??
        // Fallback if EdgeRuntime not available
        fetch(`${SUPABASE_URL}/functions/v1/claude-call-analyzer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            call_id: payload.call_id,
            business_unit: businessUnit,
            transcript: transcript,
            duration_seconds: durationSeconds,
            contact_name: payload.metadata?.contact_name,
            company_name: payload.metadata?.company_name,
          }),
        }).catch((err) => console.error("Claude analysis trigger failed:", err));
    }

    // T4a #6 — Shadow predictor learning loop (fire-and-forget)
    if (transcript.length > 50) {
      const shadowPayload = {
        session_id: call.id,
        business_id: payload.metadata?.business_id || "00000000-0000-0000-0000-000000000000",
        transcript,
        human_operator_id: payload.metadata?.human_operator_id,
        call_context: {
          caller_phone: payload.to,
          store_name: payload.metadata?.company_name,
          time_of_day: new Date().toISOString(),
        },
      };
      const shadowCall = fetch(`${SUPABASE_URL}/functions/v1/call-shadow-predictor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
        body: JSON.stringify(shadowPayload),
      }).catch((err) => console.error("Shadow predictor trigger failed:", err));
      EdgeRuntime?.waitUntil?.(shadowCall) ?? (await shadowCall);
    }

    // If qualified, auto-create pipeline lead
    if (outcome === "qualified") {
      const { error: pipeErr } = await supabase
        .from("dynasty_lead_pipeline")
        .insert({
          call_id: payload.call_id,
          business_unit: businessUnit,
          contact_name: payload.metadata?.contact_name,
          company_name: payload.metadata?.company_name,
          phone_number: payload.to,
          stage: "new",
        });

      if (pipeErr) console.error("Pipeline insert error:", pipeErr);
      else console.log("Lead auto-added to pipeline for call:", payload.call_id);
    }

    return new Response(
      JSON.stringify({ success: true, call_id: call.id, outcome }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook handler error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function determineOutcome(transcript: string): string {
  const lower = transcript.toLowerCase();

  if (
    lower.includes("interested") ||
    lower.includes("sounds good") ||
    lower.includes("tell me more") ||
    lower.includes("what's the price") ||
    lower.includes("how much") ||
    lower.includes("sign me up") ||
    lower.includes("let's do it")
  ) {
    return "qualified";
  }

  if (
    lower.includes("call back") ||
    lower.includes("call me") ||
    lower.includes("later") ||
    lower.includes("next week") ||
    lower.includes("not a good time")
  ) {
    return "callback";
  }

  if (
    lower.includes("not interested") ||
    lower.includes("no thanks") ||
    lower.includes("don't need") ||
    lower.includes("already have") ||
    lower.includes("stop calling") ||
    lower.includes("remove me")
  ) {
    return "not_interested";
  }

  if (
    lower.includes("leave a message") ||
    lower.includes("beep") ||
    transcript.length < 50
  ) {
    return "voicemail";
  }

  return "no_answer";
}

function determineLeadQuality(outcome: string, transcript: string): string {
  const lower = transcript.toLowerCase();

  if (outcome === "not_interested") return "dead";
  if (outcome === "voicemail" || outcome === "no_answer") return "cold";

  if (
    lower.includes("budget") ||
    lower.includes("ready to start") ||
    lower.includes("sign me up") ||
    lower.includes("let's do it") ||
    lower.includes("send me the contract")
  ) {
    return "hot";
  }

  if (outcome === "qualified") return "warm";
  return "cold";
}

function determineNextAction(outcome: string, quality: string): string {
  if (quality === "hot") return "assign_closer";
  if (outcome === "qualified") return "assign_closer";
  if (outcome === "callback") return "schedule_callback";
  if (outcome === "not_interested") return "archive";
  return "nurture";
}

// Declare EdgeRuntime for Deno
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
