import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── SMS SCRIPT VARIANTS (A/B) ──
const SMS_OPENERS: Record<string, (name: string) => string> = {
  A: (name) =>
    `Hey — quick question, are you currently getting customers from Google or mostly word of mouth? Noticed ${name} doesn't have a website yet.`,
  B: (name) =>
    `Hey — I came across ${name} and noticed you don't have a website. Are you losing customers to competitors who do? Would love to show you something quick.`,
};

const SMS_FOLLOWUPS: Record<string, (name: string) => string> = {
  A: (name) =>
    `Not sure if you saw this — I noticed ${name} doesn't have a website. I might be able to help you get more customers. Want me to show you how?`,
  B: (name) =>
    `Last thing — businesses like ${name} without a website lose 70%+ of potential customers. I built a quick demo for you. Want to see it? Reply YES`,
};

function isBusinessHours(): boolean {
  const now = new Date();
  const estOffset = -5;
  const utcHour = now.getUTCHours();
  const estHour = (utcHour + estOffset + 24) % 24;
  const day = now.getUTCDay();
  if (day === 0) return false;
  return estHour >= 9 && estHour < 19;
}

function nextBusinessHourStart(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(14, 0, 0, 0); // 9am EST = 14:00 UTC
  if (next <= now) next.setDate(next.getDate() + 1);
  if (next.getUTCDay() === 0) next.setDate(next.getDate() + 1);
  return next.toISOString();
}

// ── LEAD SCORING ENGINE ──
function calculateLeadScore(lead: any): number {
  let score = 0;
  if (lead.website_status === "no_website") score += 20;
  if ((lead.review_count || 0) >= 10) score += 15;
  const serviceIndustries = ["plumber", "electrician", "hvac", "landscaping", "cleaning", "roofing", "painting", "contractor", "handyman", "pest control", "auto repair"];
  if (serviceIndustries.some(s => (lead.industry || "").toLowerCase().includes(s))) score += 10;
  // Dynamic boosts applied later when response/call data comes in
  return score;
}

// ── WEIGHTED VARIANT SELECTION ──
function selectVariant(variants: Array<{ variant_key: string; usage_weight: number }>): string {
  const totalWeight = variants.reduce((sum, v) => sum + (v.usage_weight || 50), 0);
  let random = Math.random() * totalWeight;
  for (const v of variants) {
    random -= (v.usage_weight || 50);
    if (random <= 0) return v.variant_key;
  }
  return variants[0]?.variant_key || "A";
}

// ── AUTO-WINNER EVALUATION (runs every call, lightweight) ──
async function evaluateAndPromoteWinners(supabase: any) {
  const MIN_SAMPLE = 50;
  try {
    const { data: variants } = await supabase
      .from("brandaro_script_performance")
      .select("*")
      .eq("script_type", "sms_opener")
      .eq("is_active", true);

    if (!variants || variants.length < 2) return;

    // Only evaluate if both have enough samples
    const allReady = variants.every((v: any) => v.send_count >= MIN_SAMPLE);
    if (!allReady) return;

    // Find winner by reply_rate
    const sorted = [...variants].sort((a: any, b: any) => (b.reply_rate || 0) - (a.reply_rate || 0));
    const winner = sorted[0];
    const loser = sorted[1];

    // Only adjust if there's a meaningful difference (>5% gap)
    if ((winner.reply_rate - loser.reply_rate) > 5) {
      await supabase.from("brandaro_script_performance")
        .update({ usage_weight: 70, updated_at: new Date().toISOString(), last_evaluated_at: new Date().toISOString() })
        .eq("id", winner.id);
      await supabase.from("brandaro_script_performance")
        .update({ usage_weight: 30, updated_at: new Date().toISOString(), last_evaluated_at: new Date().toISOString() })
        .eq("id", loser.id);
      console.log(`[AUTO-STRIKER] Winner promoted: ${winner.variant_key} (${winner.reply_rate}%) over ${loser.variant_key} (${loser.reply_rate}%)`);
    }
  } catch (e) {
    console.warn("[AUTO-STRIKER] Winner evaluation skipped:", e);
  }
}

// ── UPSERT LEAD PERFORMANCE ──
async function upsertLeadPerformance(supabase: any, leadId: string, updates: Record<string, any>) {
  const { data: existing } = await supabase
    .from("brandaro_lead_performance")
    .select("id, sms_sent, lead_score")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (existing) {
    await supabase.from("brandaro_lead_performance")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("brandaro_lead_performance")
      .insert({ lead_id: leadId, ...updates });
  }
}

// ── TRACK SCRIPT SEND ──
async function trackScriptSend(supabase: any, variantKey: string, scriptType: string) {
  const { data } = await supabase
    .from("brandaro_script_performance")
    .select("id, send_count")
    .eq("variant_key", variantKey)
    .eq("script_type", scriptType)
    .maybeSingle();

  if (data) {
    await supabase.from("brandaro_script_performance")
      .update({ send_count: (data.send_count || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", data.id);
  }
}

// ── ADAPTIVE FOLLOW-UP TIMING ──
function getFollowUpDelay(lead: any, attemptNum: number): number {
  // Fast responders get quicker follow-ups, slow/no-response get longer delays
  const baseDelay = attemptNum === 0 ? 15 : 120; // minutes
  // If service-based or high-review, follow up sooner (higher priority)
  const priorityMultiplier = (lead.review_count || 0) > 20 ? 0.7 : 1.0;
  return Math.round(baseDelay * priorityMultiplier);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { lead_ids, mode, dry_run, action: specialAction } = body;

    if (dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-auto-striker-v2" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SPECIAL ACTION: RECORD RESPONSE ──
    if (specialAction === "record_response") {
      const { lead_id, response_type, variant_key, script_type } = body;
      if (!lead_id) throw new Error("lead_id required for record_response");

      const perfUpdates: Record<string, any> = {
        last_response_at: new Date().toISOString(),
      };

      if (response_type === "sms_reply") {
        perfUpdates.sms_replied = true;
        // +25 score boost for SMS response
        const { data: perf } = await supabase.from("brandaro_lead_performance")
          .select("lead_score").eq("lead_id", lead_id).maybeSingle();
        perfUpdates.lead_score = ((perf?.lead_score || 0) + 25);

        // Update script reply count
        if (variant_key && script_type) {
          const { data: sv } = await supabase.from("brandaro_script_performance")
            .select("id, reply_count, send_count")
            .eq("variant_key", variant_key).eq("script_type", script_type).maybeSingle();
          if (sv) {
            const newReplyCount = (sv.reply_count || 0) + 1;
            const newRate = sv.send_count > 0 ? Math.round((newReplyCount / sv.send_count) * 10000) / 100 : 0;
            await supabase.from("brandaro_script_performance")
              .update({ reply_count: newReplyCount, reply_rate: newRate, updated_at: new Date().toISOString() })
              .eq("id", sv.id);
          }
        }
      } else if (response_type === "call_answered") {
        perfUpdates.call_picked_up = true;
        const { data: perf } = await supabase.from("brandaro_lead_performance")
          .select("lead_score").eq("lead_id", lead_id).maybeSingle();
        perfUpdates.lead_score = ((perf?.lead_score || 0) + 40);
      } else if (response_type === "interested") {
        perfUpdates.interested = true;
        // AUTO-ESCALATE: Move to hot_lead immediately
        await supabase.from("brandaro_qualified_leads")
          .update({ lead_status: "hot_lead", updated_at: new Date().toISOString() })
          .eq("id", lead_id);
      } else if (response_type === "converted") {
        perfUpdates.converted = true;
        // Track script conversion
        if (variant_key && script_type) {
          const { data: sv } = await supabase.from("brandaro_script_performance")
            .select("id, conversion_count, send_count")
            .eq("variant_key", variant_key).eq("script_type", script_type).maybeSingle();
          if (sv) {
            const newConv = (sv.conversion_count || 0) + 1;
            const newRate = sv.send_count > 0 ? Math.round((newConv / sv.send_count) * 10000) / 100 : 0;
            await supabase.from("brandaro_script_performance")
              .update({ conversion_count: newConv, conversion_rate: newRate, updated_at: new Date().toISOString() })
              .eq("id", sv.id);
          }
        }
      }

      await upsertLeadPerformance(supabase, lead_id, perfUpdates);
      // Run winner evaluation after each response
      await evaluateAndPromoteWinners(supabase);

      return new Response(JSON.stringify({ success: true, action: "response_recorded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STANDARD STRIKE FLOW ──
    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      throw new Error("lead_ids array is required");
    }

    const isFollowUp = mode === "follow_up";
    const MAX_DAILY_ATTEMPTS = 2;
    const results: any[] = [];

    // Load script variant weights for weighted selection
    const { data: openerVariants } = await supabase
      .from("brandaro_script_performance")
      .select("variant_key, usage_weight")
      .eq("script_type", "sms_opener")
      .eq("is_active", true);

    for (const leadId of lead_ids.slice(0, 20)) {
      try {
        const { data: lead } = await supabase
          .from("brandaro_qualified_leads")
          .select("id, business_name, phone_number, city, state, industry, website_status, lead_status, review_count, rating")
          .eq("id", leadId)
          .single();

        if (!lead || !lead.phone_number) {
          results.push({ lead_id: leadId, status: "skipped", reason: "no_phone" });
          continue;
        }

        if (["interested", "hot_lead", "sold", "not_interested", "do_not_call"].includes(lead.lead_status || "")) {
          results.push({ lead_id: leadId, status: "skipped", reason: `status_${lead.lead_status}` });
          continue;
        }

        // Daily limit check
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { count } = await supabase
          .from("brandaro_auto_actions")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", leadId)
          .gte("created_at", todayStart.toISOString());

        if ((count || 0) >= MAX_DAILY_ATTEMPTS) {
          results.push({ lead_id: leadId, status: "skipped", reason: "daily_limit" });
          continue;
        }

        // Business hours
        if (!isBusinessHours()) {
          const scheduledTime = nextBusinessHourStart();
          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId, action_type: isFollowUp ? "follow_up_sms" : "ai_call",
            status: "skipped", trigger_source: isFollowUp ? "follow_up" : "webhook",
            error_message: "Outside business hours", scheduled_for: scheduledTime,
          });
          results.push({ lead_id: leadId, status: "scheduled", scheduled_for: scheduledTime });
          continue;
        }

        // ── COMPUTE LEAD SCORE ──
        const leadScore = calculateLeadScore(lead);
        await upsertLeadPerformance(supabase, leadId, {
          lead_score: leadScore,
          last_action_at: new Date().toISOString(),
        });

        const bizName = lead.business_name || "your business";

        if (isFollowUp) {
          const attemptNum = (count || 0);
          const followUpDelay = getFollowUpDelay(lead, attemptNum);
          const variant = selectVariant(openerVariants || [{ variant_key: "A", usage_weight: 50 }, { variant_key: "B", usage_weight: 50 }]);
          const followUpMsg = SMS_FOLLOWUPS[variant](bizName);

          const smsRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: "sms", phone: lead.phone_number, message: followUpMsg, lead_id: leadId }),
          });
          const smsResult = await smsRes.json();

          await supabase.from("brandaro_auto_actions").insert({
            lead_id: leadId, action_type: "follow_up_sms",
            status: smsResult.success ? "success" : "failed",
            attempt_number: attemptNum + 1, trigger_source: "follow_up",
            provider_sid: smsResult.result?.sid,
            error_message: smsResult.success ? `Variant ${variant}, delay ${followUpDelay}m` : smsResult.error,
            executed_at: new Date().toISOString(),
          });

          if (smsResult.success) {
            await trackScriptSend(supabase, variant, "sms_followup");
            await upsertLeadPerformance(supabase, leadId, { sms_sent: (count || 0) + 1 });
          }

          results.push({ lead_id: leadId, status: smsResult.success ? "follow_up_sent" : "follow_up_failed", variant });
        } else {
          // ── PRIMARY STRIKE: AI CALL ──
          const callRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: "call", phone: lead.phone_number, lead_id: leadId }),
          });
          const callResult = await callRes.json();

          if (callResult.success) {
            await supabase.from("brandaro_auto_actions").insert({
              lead_id: leadId, action_type: "ai_call", status: "success",
              trigger_source: "webhook", provider_sid: callResult.result?.sid,
              executed_at: new Date().toISOString(),
            });
            await supabase.from("brandaro_qualified_leads")
              .update({ lead_status: "calling", updated_at: new Date().toISOString() })
              .eq("id", leadId);
            // Pipeline event: call_made
            fetch(`${supabaseUrl}/functions/v1/brandaro-pipeline-automator`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
              body: JSON.stringify({ action: "record_event", lead_id: leadId, event_type: "call_made" }),
            }).catch((e: any) => {
              console.warn(`[AUTO-STRIKER] Pipeline event failed:`, e.message);
              supabase.from("brandaro_event_failures").insert({ lead_id: leadId, event_type: "call_made", error_message: e.message });
            });
            results.push({ lead_id: leadId, status: "call_triggered", sid: callResult.result?.sid });
          } else {
            // ── FALLBACK: SMS (WEIGHTED A/B) ──
            console.warn(`[AUTO-STRIKER] Call failed for ${leadId}, sending SMS fallback`);
            const variant = selectVariant(openerVariants || [{ variant_key: "A", usage_weight: 50 }, { variant_key: "B", usage_weight: 50 }]);
            const smsMessage = SMS_OPENERS[variant](bizName);

            const smsRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
              body: JSON.stringify({ action: "sms", phone: lead.phone_number, message: smsMessage, lead_id: leadId }),
            });
            const smsResult = await smsRes.json();

            await supabase.from("brandaro_auto_actions").insert({
              lead_id: leadId,
              action_type: smsResult.success ? "sms" : "ai_call",
              status: smsResult.success ? "success" : "failed",
              trigger_source: "webhook",
              provider_sid: smsResult.result?.sid,
              error_message: smsResult.success
                ? `Call failed, SMS variant ${variant} sent (weight-selected)`
                : `Both failed: ${callResult.error} / ${smsResult.error}`,
              executed_at: new Date().toISOString(),
            });

            if (smsResult.success) {
              await trackScriptSend(supabase, variant, "sms_opener");
              await upsertLeadPerformance(supabase, leadId, { sms_sent: 1, last_action_at: new Date().toISOString() });
              // Pipeline event: sms_sent
              fetch(`${supabaseUrl}/functions/v1/brandaro-pipeline-automator`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
                body: JSON.stringify({ action: "record_event", lead_id: leadId, event_type: "sms_sent" }),
              }).catch((e: any) => {
                console.warn(`[AUTO-STRIKER] Pipeline event failed:`, e.message);
                supabase.from("brandaro_event_failures").insert({ lead_id: leadId, event_type: "sms_sent", error_message: e.message });
              });

              // Schedule adaptive follow-up
              const followUpDelay = getFollowUpDelay(lead, 0);
              const followUpTime = new Date(Date.now() + followUpDelay * 60 * 1000).toISOString();
              await supabase.from("brandaro_auto_actions").insert({
                lead_id: leadId, action_type: "follow_up_sms", status: "skipped",
                trigger_source: "scheduled",
                error_message: `Follow-up scheduled in ${followUpDelay}m`,
                scheduled_for: followUpTime,
              });
            }

            results.push({
              lead_id: leadId,
              status: smsResult.success ? "sms_fallback" : "failed",
              variant, lead_score: leadScore,
            });
          }
        }
      } catch (leadErr: any) {
        console.error(`[AUTO-STRIKER] Error for lead ${leadId}:`, leadErr);
        await supabase.from("brandaro_auto_actions").insert({
          lead_id: leadId, action_type: "ai_call", status: "failed",
          trigger_source: isFollowUp ? "follow_up" : "webhook",
          error_message: leadErr.message,
        });
        results.push({ lead_id: leadId, status: "error", error: leadErr.message });
      }
    }

    // Run winner evaluation periodically
    await evaluateAndPromoteWinners(supabase);

    console.log(`[AUTO-STRIKER-V2] Processed ${results.length} leads`);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[AUTO-STRIKER] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
