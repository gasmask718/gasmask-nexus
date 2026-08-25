import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bsOutboundGate, encodeTarget } from "../_shared/bsOutboundGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { batch_id, action } = await req.json();
    if (!batch_id) throw new Error("batch_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER")!;

    // Handle pause/resume/stop actions
    if (action === "pause") {
      await supabase.from("solar_call_batches").update({ status: "paused", updated_at: new Date().toISOString() }).eq("id", batch_id);
      return new Response(JSON.stringify({ success: true, action: "paused" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "resume") {
      await supabase.from("solar_call_batches").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", batch_id);
      return new Response(JSON.stringify({ success: true, action: "resumed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "stop") {
      await supabase.from("solar_call_batches").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", batch_id);
      return new Response(JSON.stringify({ success: true, action: "stopped" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch batch config
    const { data: batch, error: batchErr } = await supabase
      .from("solar_call_batches")
      .select("*")
      .eq("id", batch_id)
      .single();

    if (batchErr || !batch) throw new Error("Batch not found");
    if (batch.status !== "running" && batch.status !== "queued") {
      return new Response(JSON.stringify({ success: true, message: "Batch not in runnable state", status: batch.status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark batch running if queued
    if (batch.status === "queued") {
      await supabase.from("solar_call_batches").update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", batch_id);
    }

    // Count active calls for this batch
    const { count: activeCount } = await supabase
      .from("solar_call_queue")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batch_id)
      .in("call_status", ["dialing", "active"]);

    const currentActive = activeCount || 0;
    const maxConcurrent = batch.max_concurrent || 10;
    const slotsAvailable = Math.max(0, maxConcurrent - currentActive);

    if (slotsAvailable === 0) {
      return new Response(JSON.stringify({ success: true, message: "At capacity", active: currentActive, max: maxConcurrent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch queued items (prioritized), also pick retries that are due
    const now = new Date().toISOString();
    const { data: queueItems } = await supabase
      .from("solar_call_queue")
      .select("*")
      .eq("batch_id", batch_id)
      .or(`call_status.eq.queued,and(call_status.eq.retry,next_retry_at.lte.${now})`)
      .order("priority_score", { ascending: false })
      .limit(slotsAvailable);

    if (!queueItems || queueItems.length === 0) {
      // Check if batch is done
      const { count: remaining } = await supabase
        .from("solar_call_queue")
        .select("id", { count: "exact", head: true })
        .eq("batch_id", batch_id)
        .in("call_status", ["queued", "dialing", "active", "retry"]);

      if ((remaining || 0) === 0) {
        await supabase.from("solar_call_batches").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", batch_id);
      }

      return new Response(JSON.stringify({ success: true, message: "No items to dial", remaining }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;
    const results: any[] = [];
    let callsStarted = 0;

    for (let i = 0; i < queueItems.length; i++) {
      const item = queueItems[i];

      // Smart pacing: random delay between calls (skip first)
      if (i > 0) {
        const delay = batch.pacing_delay_ms || 2000;
        const jitter = Math.floor(Math.random() * delay);
        await new Promise(r => setTimeout(r, delay + jitter));
      }

      // Lock item
      await supabase.from("solar_call_queue").update({
        call_status: "dialing",
        attempts: (item.attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", item.id).eq("call_status", item.call_status);

      // Normalize phone
      let phone = item.phone.replace(/[^\d+]/g, "");
      if (!phone.startsWith("+")) {
        phone = phone.startsWith("1") ? `+${phone}` : `+1${phone}`;
      }

      // Resolve the lead's jurisdiction for the gate.
      let itemState: string | null = null;
      if (item.lead_id) {
        const { data: l } = await supabase
          .from("solar_leads").select("state").eq("id", item.lead_id).maybeSingle();
        itemState = l?.state ?? null;
      } else if (item.contact_id) {
        const { data: c } = await supabase
          .from("solar_outreach_contacts").select("state").eq("id", item.contact_id).maybeSingle();
        itemState = c?.state ?? null;
      }

      // ── BrightSun outbound gate — refuse before Twilio is touched ──
      const gate = await bsOutboundGate({
        supabase,
        phone,
        state: itemState,
        channel: "voice",
        caller: "solar-parallel-dialer",
        leadId: item.lead_id || null,
        contactId: item.contact_id || null,
        metadata: { batch_id, queue_item_id: item.id },
      });
      if (!gate.allowed) {
        await supabase.from("solar_call_queue").update({
          call_status: "blocked",
          outcome: `gate:${gate.reasonCode}`,
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);
        results.push({ id: item.id, phone, status: "blocked", reason_code: gate.reasonCode });
        continue;
      }

      // Build TwiML URL — use campaign's agent or default bridge
      const bridgeParams = new URLSearchParams({
        lead_name: encodeURIComponent(item.contact_name || "Customer"),
        business_name: encodeURIComponent("BrightSun Energy"),
        business_type: "solar",
        batch_id: batch_id,
        queue_item_id: item.id,
      });

      if (batch.campaign_id) bridgeParams.set("campaign_id", batch.campaign_id);

      const twimlUrl = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?${bridgeParams}`;

      // Every dial goes through the TwiML-side gate first.
      const gateParams = new URLSearchParams({
        bs_target: encodeTarget(twimlUrl),
        caller: "solar-parallel-dialer",
        state: itemState || "",
        batch_id,
        queue_item_id: item.id,
      });
      if (item.lead_id) gateParams.set("lead_id", item.lead_id);
      if (item.contact_id) gateParams.set("contact_id", item.contact_id);
      const gatedUrl = `${supabaseUrl}/functions/v1/bs-outbound-gate?${gateParams}`;

      try {
        const callParams = new URLSearchParams({
          To: phone,
          From: TWILIO_PHONE_NUMBER,
          Url: gatedUrl,
          StatusCallback: statusCallbackUrl,
          StatusCallbackMethod: "POST",
          Timeout: "30",
        });
        // Repeated params — a space-joined single value subscribes to nothing.
        for (const ev of ["initiated", "ringing", "answered", "completed"]) {
          callParams.append("StatusCallbackEvent", ev);
        }

        const twilioResponse = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: callParams,
          }
        );

        const twilioData = await twilioResponse.json();

        if (!twilioResponse.ok) {
          console.error(`❌ Twilio error for ${phone}:`, twilioData);
          await supabase.from("solar_call_queue").update({
            call_status: "failed",
            outcome: twilioData.message || "Twilio error",
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
          results.push({ id: item.id, phone, status: "failed", error: twilioData.message });
          continue;
        }

        const callSid = twilioData.sid;
        callsStarted++;

        // Update queue item with call SID
        await supabase.from("solar_call_queue").update({
          call_sid: callSid,
          updated_at: new Date().toISOString(),
        }).eq("id", item.id);

        // Create live_calls record
        await supabase.from("live_calls" as any).insert({
          provider_call_sid: callSid,
          from_number: TWILIO_PHONE_NUMBER,
          to_number: phone,
          direction: "outbound",
          status: "initiated",
          started_at: new Date().toISOString(),
        }).then(() => {});

        results.push({ id: item.id, phone, status: "dialing", call_sid: callSid });
        console.log(`✅ Batch call ${i + 1}/${queueItems.length}: ${callSid} → ${phone}`);

      } catch (err: any) {
        console.error(`❌ Call error for ${phone}:`, err.message);
        // Check if should retry
        const newAttempts = (item.attempts || 0) + 1;
        if (newAttempts < (item.max_attempts || 3)) {
          // Schedule retry: 1h, 24h, 48h
          const retryDelays = [3600, 86400, 172800];
          const delaySeconds = retryDelays[Math.min(newAttempts - 1, retryDelays.length - 1)];
          const nextRetry = new Date(Date.now() + delaySeconds * 1000).toISOString();

          await supabase.from("solar_call_queue").update({
            call_status: "retry",
            next_retry_at: nextRetry,
            outcome: err.message,
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
        } else {
          await supabase.from("solar_call_queue").update({
            call_status: "failed",
            outcome: `Max attempts reached: ${err.message}`,
            updated_at: new Date().toISOString(),
          }).eq("id", item.id);
        }
        results.push({ id: item.id, phone, status: "error", error: err.message });
      }
    }

    // Update batch counters
    await supabase.from("solar_call_batches").update({
      calls_started: (batch.calls_started || 0) + callsStarted,
      updated_at: new Date().toISOString(),
    }).eq("id", batch_id);

    return new Response(JSON.stringify({
      success: true,
      batch_id,
      slots_used: queueItems.length,
      calls_started: callsStarted,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("❌ solar-parallel-dialer error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
