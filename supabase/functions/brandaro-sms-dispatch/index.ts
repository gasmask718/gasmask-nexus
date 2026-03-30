import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");

    // Parse body safely
    const bodyText = await req.text();
    let body: Record<string, unknown> = {};
    try { body = bodyText ? JSON.parse(bodyText) : {}; } catch { body = {}; }

    const batchSize = Number(body.batch_size) || 25;
    const dryRun = body.dry_run === true;

    // Check if we can use gateway or fallback to direct Twilio
    const useGateway = !!(LOVABLE_API_KEY && TWILIO_API_KEY);
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const useDirect = !!(twilioSid && twilioAuth);

    if (!useGateway && !useDirect) {
      throw new Error("No Twilio credentials available (neither gateway nor direct)");
    }
    if (!TWILIO_FROM) {
      throw new Error("TWILIO_PHONE_NUMBER or TWILIO_FROM_NUMBER not configured");
    }

    console.log(`📱 Starting SMS dispatch (batch=${batchSize}, dryRun=${dryRun}, mode=${useGateway ? 'gateway' : 'direct'})`);

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
        let response: Response;

        if (useGateway) {
          response = await fetch(`${GATEWAY_URL}/Messages.json`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TWILIO_API_KEY!,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: msg.phone_number,
              From: TWILIO_FROM,
              Body: msg.message_body || "Hello from Brandaro Digital",
            }),
          });
        } else {
          const authHeader = btoa(`${twilioSid}:${twilioAuth}`);
          response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${authHeader}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: msg.phone_number,
              From: TWILIO_FROM,
              Body: msg.message_body || "Hello from Brandaro Digital",
            }),
          });
        }

        const data = await response.json();

        if (response.ok) {
          // Update message status
          await supabase
            .from("brandaro_pending_messages")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", msg.id);

          // Log in message_log
          await supabase.from("brandaro_message_log").insert({
            lead_id: msg.lead_id,
            channel: "sms",
            provider: "twilio",
            destination: msg.phone_number,
            message_body: msg.message_body,
            send_status: "delivered",
            provider_message_id: data.sid || null,
            sent_at: new Date().toISOString(),
          });

          results.push({ id: msg.id, status: "sent" });
          sent++;
        } else {
          const errMsg = data.message || JSON.stringify(data);
          await supabase
            .from("brandaro_pending_messages")
            .update({ status: "failed" })
            .eq("id", msg.id);
          results.push({ id: msg.id, status: "failed", error: errMsg });
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
