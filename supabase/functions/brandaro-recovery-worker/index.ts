import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms } from "../_shared/sendSms.ts";
import { outreachAllowed } from "../_shared/outreachGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // OUTREACH GATE (2026-08-23): no Brandaro recovery sends unless a human armed the switch.
  if (!(await outreachAllowed("brandaro_recovery_worker"))) {
    return new Response(JSON.stringify({ success: true, gated: true, switch: "brandaro_recovery_worker" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const isDryRun = body?.dry_run === true;

    if (isDryRun) {
      return new Response(JSON.stringify({ success: true, message: "dry_run OK" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Credentials, suppression and budgets live in send-sms.

    // 1. Get pending recovery messages that are due
    const { data: pendingMessages, error: fetchError } = await supabase
      .from("brandaro_payment_recovery")
      .select("*, brandaro_closer_sessions(lead_id, lead_phone)")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50);

    if (fetchError) throw new Error(`Fetch error: ${fetchError.message}`);
    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No pending messages", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`🔄 Processing ${pendingMessages.length} recovery messages`);

    let sentCount = 0;
    let failCount = 0;

    for (const msg of pendingMessages) {
      try {
        // Try to get the phone from the session or lead
        let phone = msg.brandaro_closer_sessions?.lead_phone || "";

        // If no phone on session, try to look up from leads
        if (!phone && msg.lead_id) {
          const { data: lead } = await supabase
            .from("brandaro_ad_leads")
            .select("phone")
            .eq("id", msg.lead_id)
            .single();
          phone = lead?.phone || "";
        }

        // Normalize phone
        let normalized = (phone || "").replace(/\D/g, "");
        if (normalized.startsWith("1") && normalized.length === 11) normalized = normalized.substring(1);

        if (normalized.length !== 10) {
          console.log(`⚠️ Invalid phone for recovery ${msg.id}, skipping`);
          await supabase.from("brandaro_payment_recovery")
            .update({ status: "failed" })
            .eq("id", msg.id);
          failCount++;
          continue;
        }

        // Payment recovery chasing an unpaid order the customer started:
        // transactional in nature, but it runs as a batch loop, so it goes
        // through the HTTP chokepoint rather than the in-process module.
        const res = await sendSms({
          to: `+1${normalized}`,
          body: msg.message_content,
          idempotencyKey: `brandaro-recovery-${msg.id}`,
          sendClass: "transactional",
          purpose: "brandaro_payment_recovery",
          metadata: { recovery_id: msg.id, step: msg.step, session_id: msg.session_id },
        });

        // Update recovery record. Suppressed = terminal, never re-queued.
        await supabase.from("brandaro_payment_recovery").update({
          status: res.success ? "sent" : res.blocked ? "blocked" : "failed",
          sent_at: res.success ? new Date().toISOString() : null,
        }).eq("id", msg.id);

        if (!res.success) {
          console.log(`❌ Recovery SMS ${res.blocked ? "blocked" : "failed"} for ${msg.id}: ${res.errorMessage ?? res.status}`);
          failCount++;
        } else {
          console.log(`✅ Recovery SMS sent for ${msg.id} (step ${msg.step})`);
          sentCount++;

          // Update session recovery tracking
          if (msg.session_id) {
            await supabase.from("brandaro_closer_sessions").update({
              last_recovery_at: new Date().toISOString(),
            }).eq("id", msg.session_id);
          }

          // Log to communication_logs for unified inbox
          const { error: logErr } = await supabase.from("communication_logs").insert({
            direction: "outbound",
            channel: "sms",
            phone_number: `+1${normalized}`,
            message_body: msg.message_content,
            status: "sent",
            provider: "twilio",
            provider_message_id: res.providerMessageId,
            metadata: { source: "brandaro_payment_recovery", step: msg.step, session_id: msg.session_id },
          });
          if (logErr) console.log("⚠️ Failed to log to communication_logs:", logErr.message);
        }
      } catch (innerError) {
        console.error(`❌ Error processing recovery ${msg.id}:`, innerError);
        await supabase.from("brandaro_payment_recovery")
          .update({ status: "failed" })
          .eq("id", msg.id);
        failCount++;
      }
    }

    // Create alert if recoveries were sent
    if (sentCount > 0) {
      await supabase.from("brandaro_closer_alerts").insert({
        alert_type: "recovery_sent",
        title: `💰 ${sentCount} recovery message(s) sent`,
        detail: `${sentCount} sent, ${failCount} failed`,
        priority: 30,
      });
    }

    console.log(`🔄 Recovery worker done: ${sentCount} sent, ${failCount} failed`);

    return new Response(JSON.stringify({ success: true, sent: sentCount, failed: failCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Recovery worker error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
