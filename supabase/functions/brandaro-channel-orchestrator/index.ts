import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Brandaro Multi-Channel Orchestrator
 * The BRAIN that decides: who to contact, when, how, and with what personality.
 * Implements intelligent routing with fallback chains and personality switching.
 */

const CHANNEL_PRIORITY = ["call", "sms", "sms_retry", "call_retry"] as const;
const MAX_ATTEMPTS_PER_DAY = 5;
const COOLDOWN_MS = 30 * 60 * 1000; // 30 min
const PERSONALITY_SWITCH_THRESHOLD = 3; // switch after 3 failed attempts

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    if (body.dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-channel-orchestrator" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    // ═══════════════════════════════════════════════════════
    // PHASE 1: Gather actionable leads (scored + with phones)
    // ═══════════════════════════════════════════════════════
    const { data: actionableLeads } = await supabase
      .from("brandaro_va_lead_heat")
      .select("id, lead_id, heat_score, phone, business_name, updated_at")
      .not("phone", "is", null)
      .gt("heat_score", 0)
      .order("heat_score", { ascending: false })
      .limit(30);

    for (const lead of actionableLeads || []) {
      const leadId = lead.lead_id || lead.id;
      const phone = lead.phone;
      if (!phone) continue;

      // ── Check rate limits ──
      const { data: limits } = await supabase
        .from("brandaro_contact_limits")
        .select("*")
        .eq("lead_id", leadId)
        .maybeSingle();

      if (limits) {
        if (limits.daily_contacts >= MAX_ATTEMPTS_PER_DAY) continue;
        if (limits.cooldown_until && new Date(limits.cooldown_until) > new Date()) continue;
        if (limits.next_allowed_at && new Date(limits.next_allowed_at) > new Date()) continue;
      }

      // ── Load conversation memory ──
      const { data: memories } = await supabase
        .from("brandaro_lead_memory")
        .select("memory_key, memory_value, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);

      // ── Load execution history ──
      const { data: history } = await supabase
        .from("brandaro_execution_log")
        .select("action_type, result, trigger_source, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(10);

      const failedAttempts = (history || []).filter(h => h.result === "failed").length;
      const totalAttempts = (history || []).length;
      const lastAction = history?.[0];
      const lastActionType = lastAction?.action_type;

      // ── Determine optimal channel ──
      const channel = determineChannel(lead, memories || [], history || [], failedAttempts);

      // ── Determine if personality switch needed ──
      let personalityOverride: string | null = null;
      if (failedAttempts >= PERSONALITY_SWITCH_THRESHOLD) {
        personalityOverride = await selectAlternatePersonality(supabase, leadId, memories || []);
      }

      // ── Determine message context ──
      const stage = determineStage(lead, totalAttempts, memories || []);

      // ── Generate message via AI conversation engine ──
      const { data: aiMsg } = await supabase.functions.invoke("brandaro-ai-conversation-engine", {
        body: {
          lead_id: leadId,
          lead_name: lead.business_name,
          heat_score: lead.heat_score,
          stage,
          channel,
          personality_override: personalityOverride,
          conversation_memory: memories?.map(m => `${m.memory_key}: ${m.memory_value}`).join("\n") || "",
          attempt_number: totalAttempts + 1,
        },
      });

      const generatedMessage = aiMsg?.message || null;

      // ── Execute the chosen channel ──
      const execResult = await supabase.functions.invoke("brandaro-closer-action", {
        body: {
          action: channel === "call" || channel === "call_retry" ? "call" : "sms",
          phone,
          message: generatedMessage,
          lead_id: leadId,
        },
      });

      const success = execResult.data?.success === true;

      // ── Log orchestration decision ──
      await supabase.from("brandaro_execution_log").insert({
        lead_id: leadId,
        phone,
        action_type: channel,
        trigger_source: "orchestrator",
        result: success ? "success" : "failed",
        provider_sid: execResult.data?.result?.sid,
        error_message: success ? null : execResult.data?.error,
        metadata: {
          stage,
          personality_override: personalityOverride,
          ai_message_used: !!generatedMessage,
          heat_score: lead.heat_score,
          attempt: totalAttempts + 1,
        },
      });

      // ── Update contact limits ──
      const now = new Date();
      const nextAllowed = new Date(now.getTime() + COOLDOWN_MS);
      if (limits) {
        await supabase.from("brandaro_contact_limits").update({
          daily_contacts: (limits.daily_contacts || 0) + 1,
          total_contacts: (limits.total_contacts || 0) + 1,
          last_contacted_at: now.toISOString(),
          next_allowed_at: nextAllowed.toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", limits.id);
      } else {
        await supabase.from("brandaro_contact_limits").insert({
          lead_id: leadId,
          daily_contacts: 1,
          total_contacts: 1,
          last_contacted_at: now.toISOString(),
          next_allowed_at: nextAllowed.toISOString(),
        });
      }

      // ── Update conversation memory ──
      await supabase.from("brandaro_lead_memory").insert({
        lead_id: leadId,
        memory_type: "context",
        memory_key: `orchestrator_${channel}`,
        memory_value: `${channel} at stage "${stage}". ${success ? "Delivered" : "Failed"}. Attempt #${totalAttempts + 1}. Heat: ${lead.heat_score}.${personalityOverride ? ` Personality switched to: ${personalityOverride}` : ""}`,
        source: "orchestrator",
      });

      // ── If call failed, schedule SMS fallback ──
      if (!success && (channel === "call" || channel === "call_retry")) {
        await supabase.from("brandaro_followup_queue").insert({
          lead_id: leadId,
          step_number: totalAttempts + 1,
          channel: "sms",
          message_template: generatedMessage || `Hey! We tried reaching you. Would love to connect about growing your business online. Reply YES if interested! 🚀`,
          scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min fallback
          status: "pending",
        });
      }

      results.push({
        lead_id: leadId,
        channel,
        stage,
        success,
        personality_switched: !!personalityOverride,
        attempt: totalAttempts + 1,
      });

      // Limit batch size per run
      if (results.length >= 15) break;
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 2: Process failed-call fallbacks from queue
    // ═══════════════════════════════════════════════════════
    const { data: fallbacks } = await supabase
      .from("brandaro_followup_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(10);

    for (const fb of fallbacks || []) {
      const { data: leadData } = await supabase
        .from("brandaro_va_lead_heat")
        .select("phone")
        .or(`lead_id.eq.${fb.lead_id},id.eq.${fb.lead_id}`)
        .limit(1)
        .maybeSingle();

      if (!leadData?.phone) {
        await supabase.from("brandaro_followup_queue").update({ status: "skipped" }).eq("id", fb.id);
        continue;
      }

      const execResult = await supabase.functions.invoke("brandaro-closer-action", {
        body: {
          action: fb.channel === "call" ? "call" : "sms",
          phone: leadData.phone,
          message: fb.message_template,
          lead_id: fb.lead_id,
        },
      });

      await supabase.from("brandaro_followup_queue").update({
        status: execResult.data?.success ? "executed" : "failed",
        executed_at: new Date().toISOString(),
      }).eq("id", fb.id);

      results.push({ type: "fallback", lead_id: fb.lead_id, success: execResult.data?.success });
    }

    return new Response(JSON.stringify({
      status: "ok",
      orchestrated: results.length,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── DECISION FUNCTIONS ───

function determineChannel(
  lead: any, memories: any[], history: any[], failedAttempts: number
): string {
  const heat = lead.heat_score || 0;
  const lastFailed = history[0]?.result === "failed";
  const lastWasCall = history[0]?.action_type?.includes("call");
  const lastWasSMS = history[0]?.action_type?.includes("sms");
  const staleness = Date.now() - new Date(lead.updated_at).getTime();
  const isStale = staleness > 48 * 60 * 60 * 1000;

  // Hot leads: always try call first
  if (heat >= 70 && !lastFailed) return "call";
  // Hot lead but last call failed: SMS fallback
  if (heat >= 70 && lastFailed && lastWasCall) return "sms";
  // Warm leads: alternate
  if (heat >= 30 && heat < 70) {
    if (lastWasCall) return "sms";
    return "call";
  }
  // Stale leads: SMS re-engagement
  if (isStale) return "sms";
  // After multiple failures: retry with different channel
  if (failedAttempts >= 2 && lastWasCall) return "sms_retry";
  if (failedAttempts >= 2 && lastWasSMS) return "call_retry";
  // Default
  return heat >= 50 ? "call" : "sms";
}

function determineStage(lead: any, totalAttempts: number, memories: any[]): string {
  if (totalAttempts === 0) return "first_contact";
  const hasInterest = memories.some(m => m.memory_value?.toLowerCase().includes("interested"));
  const hasPayment = memories.some(m => m.memory_key?.includes("payment"));
  if (hasPayment) return "closing";
  if (hasInterest) return "nurturing";
  if (totalAttempts >= 3) return "re_engagement";
  return "follow_up";
}

async function selectAlternatePersonality(supabase: any, leadId: string, memories: any[]): Promise<string | null> {
  // Get current personality used
  const usedPersonalities = memories
    .filter(m => m.memory_key?.includes("personality"))
    .map(m => m.memory_value);

  // Get active personalities ordered by win rate
  const { data: personalities } = await supabase
    .from("brandaro_personalities")
    .select("id, nickname, win_rate")
    .eq("is_active", true)
    .order("win_rate", { ascending: false })
    .limit(5);

  if (!personalities?.length) return null;

  // Pick the highest-win-rate personality not recently used
  const fresh = personalities.find((p: any) => !usedPersonalities.includes(p.nickname));
  return fresh?.nickname || personalities[0]?.nickname || null;
}
