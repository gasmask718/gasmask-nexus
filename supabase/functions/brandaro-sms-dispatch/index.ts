import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSms } from "../_shared/sendSms.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");

    // Parse body safely
    const bodyText = await req.text();
    let body: Record<string, unknown> = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }

    const batchSize = Number(body.batch_size) || 25;
    const dryRun = body.dry_run === true;

    // Credentials, provider fallback and suppression now live in send-sms;
    // this worker only decides WHAT to send and to whom.
    console.log(`Starting SMS dispatch (batch=${batchSize}, dryRun=${dryRun})`);

    // Fetch pending messages
    const { data: pending, error: fetchErr } = await supabase
      .from("brandaro_pending_messages")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (fetchErr) throw fetchErr;
    if (!pending?.length) {
      return new Response(JSON.stringify({ sent: 0, message: "No pending messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const msg of pending) {
      if (!msg.phone_number) {
        results.push({ id: msg.id, status: "skipped", error: "No phone number" });
        failed++;
        continue;
      }

      if (dryRun) {
        results.push({ id: msg.id, status: "dry_run" });
        sent++;
        continue;
      }

      try {
        // Campaign class: marketing suppression + the campaign daily budget.
        const res = await sendSms({
          to: msg.phone_number,
          body: msg.message_body || "Hello from Brandaro Digital",
          idempotencyKey: `brandaro-dispatch-${msg.id}`,
          sendClass: "campaign",
          from: TWILIO_FROM || undefined,
          campaignId: msg.campaign_id ?? null,
          purpose: "brandaro_dispatch",
          metadata: { pending_message_id: msg.id, lead_id: msg.lead_id },
        });

        if (res.success) {
          await supabase
            .from("brandaro_pending_messages")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", msg.id);

          await supabase.from("brandaro_message_log").insert({
            lead_id: msg.lead_id,
            channel: "sms",
            provider: "twilio",
            destination: msg.phone_number,
            message_body: msg.message_body,
            send_status: "delivered",
            provider_message_id: res.providerMessageId,
            sent_at: new Date().toISOString(),
          });

          results.push({ id: msg.id, status: "sent" });
          sent++;
        } else {
          // A suppressed recipient is terminal, not a retryable failure —
          // mark it so the batch never picks the row up again.
          const terminal = res.blocked;
          await supabase
            .from("brandaro_pending_messages")
            .update({ status: terminal ? "blocked" : "failed" })
            .eq("id", msg.id);
          results.push({
            id: msg.id,
            status: terminal ? "blocked" : "failed",
            error: res.errorMessage || res.status,
          });
          failed++;
        }

        // Pace: 200ms between sends
        await new Promise(r => setTimeout(r, 200));

      } catch (sendErr: unknown) {
        const errMsg = sendErr instanceof Error ? sendErr.message : "Unknown error";
        await supabase
          .from("brandaro_pending_messages")
          .update({ status: "failed" })
          .eq("id", msg.id);
        results.push({ id: msg.id, status: "failed", error: errMsg });
        failed++;
      }
    }

    console.log(`✅ SMS dispatch complete: ${sent} sent, ${failed} failed`);

    return new Response(JSON.stringify({
      sent,
      failed,
      total_processed: pending.length,
      dry_run: dryRun,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("❌ SMS dispatch error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
