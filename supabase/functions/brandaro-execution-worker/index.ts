import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── RETRY DELAYS (minutes) ──
const RETRY_DELAYS = [120, 1440, 2880]; // 2h, 24h, 48h

// ── STRIKE LIMITS ──
const MAX_CALLS_PER_DAY = 3;
const MAX_SMS_PER_DAY = 2;

function isBusinessHours(): boolean {
  const now = new Date();
  const estHour = (now.getUTCHours() - 5 + 24) % 24;
  const day = now.getUTCDay();
  if (day === 0) return false;
  return estHour >= 9 && estHour < 19;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));

    if (body.dry_run) {
      return new Response(JSON.stringify({ status: "ok", engine: "brandaro-execution-worker-v1" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: POPULATE QUEUE FROM PREDICTIONS ──
    if (body.action === "populate_queue") {
      const { data: predictions } = await supabase
        .from("brandaro_conversion_predictions")
        .select("id, lead_id, conversion_probability, priority_tier, action_strategy")
        .is("outcome", null)
        .order("conversion_probability", { ascending: false })
        .limit(100);

      if (!predictions?.length) {
        return new Response(JSON.stringify({ success: true, queued: 0, message: "No predictions to queue" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get already-queued lead IDs
      const { data: existingQueue } = await supabase
        .from("brandaro_execution_queue")
        .select("lead_id")
        .in("status", ["pending", "in_progress"]);
      const queuedLeadIds = new Set((existingQueue || []).map((q: any) => q.lead_id));

      // Get leads that should be skipped
      const { data: skipLeads } = await supabase
        .from("brandaro_qualified_leads")
        .select("id, lead_status")
        .in("id", predictions.map((p: any) => p.lead_id))
        .in("lead_status", ["sold", "not_interested", "do_not_call", "wrong_number"]);
      const skipIds = new Set((skipLeads || []).map((l: any) => l.id));

      const toInsert = predictions
        .filter((p: any) => !queuedLeadIds.has(p.lead_id) && !skipIds.has(p.lead_id))
        .map((p: any) => ({
          lead_id: p.lead_id,
          prediction_id: p.id,
          priority_tier: p.priority_tier,
          action_strategy: p.action_strategy,
          conversion_probability: p.conversion_probability,
          status: "pending",
          next_attempt_at: new Date().toISOString(),
        }));

      if (toInsert.length > 0) {
        await supabase.from("brandaro_execution_queue").insert(toInsert);
      }

      return new Response(JSON.stringify({ success: true, queued: toInsert.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ACTION: EXECUTE QUEUE (WORKER LOOP) ──
    if (!isBusinessHours()) {
      return new Response(JSON.stringify({ success: true, executed: 0, reason: "outside_business_hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull top 20 pending items ready for execution
    const { data: queueItems } = await supabase
      .from("brandaro_execution_queue")
      .select("*, brandaro_qualified_leads(id, business_name, phone_number, industry, lead_status, website_status, review_count)")
      .eq("status", "pending")
      .lte("next_attempt_at", new Date().toISOString())
      .order("conversion_probability", { ascending: false })
      .limit(20);

    if (!queueItems?.length) {
      return new Response(JSON.stringify({ success: true, executed: 0, reason: "queue_empty" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const item of queueItems) {
      const lead = item.brandaro_qualified_leads;
      if (!lead?.phone_number) {
        await supabase.from("brandaro_execution_queue")
          .update({ status: "failed", result: { reason: "no_phone" }, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        results.push({ id: item.id, status: "skipped", reason: "no_phone" });
        continue;
      }

      // Skip if lead status changed
      if (["sold", "not_interested", "do_not_call", "wrong_number"].includes(lead.lead_status || "")) {
        await supabase.from("brandaro_execution_queue")
          .update({ status: "completed", result: { reason: `status_${lead.lead_status}` }, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        results.push({ id: item.id, status: "skipped", reason: `status_${lead.lead_status}` });
        continue;
      }

      // Daily limit check
      const { count: dailyCalls } = await supabase
        .from("brandaro_auto_actions")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", item.lead_id)
        .eq("action_type", "ai_call")
        .gte("created_at", todayStart.toISOString());

      const { count: dailySms } = await supabase
        .from("brandaro_auto_actions")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", item.lead_id)
        .in("action_type", ["sms", "follow_up_sms"])
        .gte("created_at", todayStart.toISOString());

      if ((dailyCalls || 0) >= MAX_CALLS_PER_DAY && (dailySms || 0) >= MAX_SMS_PER_DAY) {
        // Reschedule to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(14, 0, 0, 0); // 9am EST
        await supabase.from("brandaro_execution_queue")
          .update({ next_attempt_at: tomorrow.toISOString(), updated_at: new Date().toISOString() })
          .eq("id", item.id);
        results.push({ id: item.id, status: "deferred", reason: "daily_limit" });
        continue;
      }

      // ── EXECUTE BASED ON STRATEGY ──
      const bizName = lead.business_name || "your business";
      let actionType: string;
      let success = false;
      let actionResult: any = {};

      if (item.priority_tier === "high" && (dailyCalls || 0) < MAX_CALLS_PER_DAY) {
        // HIGH → Immediate call
        actionType = "ai_call";
        const callRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ action: "call", phone: lead.phone_number, lead_id: item.lead_id }),
        });
        actionResult = await callRes.json();
        success = actionResult.success;

        if (!success && (dailySms || 0) < MAX_SMS_PER_DAY) {
          // Fallback to SMS
          actionType = "sms";
          const msg = `Hey — quick question, are you currently getting customers from Google or mostly word of mouth? Noticed ${bizName} doesn't have a website yet.`;
          const smsRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({ action: "sms", phone: lead.phone_number, message: msg, lead_id: item.lead_id }),
          });
          actionResult = await smsRes.json();
          success = actionResult.success;
        }
      } else if (item.priority_tier === "medium" && (dailySms || 0) < MAX_SMS_PER_DAY) {
        // MEDIUM → SMS first, call later if no reply
        actionType = "sms";
        const msg = `Hey — I came across ${bizName} and noticed you don't have a website. Are you losing customers to competitors who do? Would love to show you something quick.`;
        const smsRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ action: "sms", phone: lead.phone_number, message: msg, lead_id: item.lead_id }),
        });
        actionResult = await smsRes.json();
        success = actionResult.success;
      } else {
        // LOW → Delayed nurture SMS
        actionType = "sms";
        const msg = `Hi — I help businesses like ${bizName} get found online. Would a free quick demo be useful? No pressure at all.`;
        const smsRes = await fetch(`${supabaseUrl}/functions/v1/brandaro-closer-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({ action: "sms", phone: lead.phone_number, message: msg, lead_id: item.lead_id }),
        });
        actionResult = await smsRes.json();
        success = actionResult.success;
      }

      // Log action
      await supabase.from("brandaro_auto_actions").insert({
        lead_id: item.lead_id,
        action_type: actionType!,
        status: success ? "success" : "failed",
        trigger_source: "execution_worker",
        provider_sid: actionResult.result?.sid,
        error_message: success ? null : actionResult.error,
        executed_at: new Date().toISOString(),
      });

      // Update queue item
      const newAttempts = item.attempts + 1;
      if (success) {
        await supabase.from("brandaro_execution_queue").update({
          status: "completed",
          attempts: newAttempts,
          last_attempt_at: new Date().toISOString(),
          result: { action: actionType!, sid: actionResult.result?.sid },
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);

        // Update lead status
        if (actionType! === "ai_call") {
          await supabase.from("brandaro_qualified_leads")
            .update({ lead_status: "calling", updated_at: new Date().toISOString() })
            .eq("id", item.lead_id);
        }
      } else if (newAttempts >= item.max_attempts) {
        // Max attempts reached — mark exhausted
        await supabase.from("brandaro_execution_queue").update({
          status: "exhausted",
          attempts: newAttempts,
          last_attempt_at: new Date().toISOString(),
          result: { error: actionResult.error },
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
      } else {
        // Schedule retry with backoff
        const delayMinutes = RETRY_DELAYS[newAttempts - 1] || 2880;
        const nextAttempt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
        await supabase.from("brandaro_execution_queue").update({
          attempts: newAttempts,
          last_attempt_at: new Date().toISOString(),
          next_attempt_at: nextAttempt,
          result: { last_error: actionResult.error },
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
      }

      // ── FEEDBACK LOOP: Update lead performance + prediction ──
      if (success) {
        await supabase.from("brandaro_lead_performance").upsert({
          lead_id: item.lead_id,
          last_action_at: new Date().toISOString(),
          sms_sent: actionType! === "sms" ? 1 : 0,
        }, { onConflict: "lead_id" });

        // Update prediction outcome tracking
        if (item.prediction_id) {
          await supabase.from("brandaro_conversion_predictions")
            .update({ outcome: "contacted", updated_at: new Date().toISOString() })
            .eq("id", item.prediction_id);
        }
      }

      results.push({ id: item.id, lead_id: item.lead_id, status: success ? "executed" : "failed", action: actionType!, attempts: newAttempts });
    }

    // ── AUTO-SCALE: Check hot niches and trigger more scraping ──
    if (body.action === "execute_and_scale") {
      const { data: hotNiches } = await supabase
        .from("brandaro_niche_performance")
        .select("industry")
        .eq("is_hot_niche", true)
        .gt("conversion_rate", 10);

      if (hotNiches?.length) {
        // Log scaling recommendation
        for (const niche of hotNiches) {
          console.log(`[EXECUTION-WORKER] HOT NICHE detected: ${niche.industry} — recommend scaling lead gen`);
        }
      }
    }

    console.log(`[EXECUTION-WORKER] Processed ${results.length} queue items`);

    return new Response(JSON.stringify({
      success: true,
      executed: results.filter(r => r.status === "executed").length,
      failed: results.filter(r => r.status === "failed").length,
      deferred: results.filter(r => r.status === "deferred").length,
      skipped: results.filter(r => r.status === "skipped").length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[EXECUTION-WORKER] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
