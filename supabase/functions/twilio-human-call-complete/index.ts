import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HUMAN CALL COMPLETE WEBHOOK
 * 
 * Called by Twilio when the <Dial> to the human agent completes.
 * Frees the human agent line and processes the next queued caller.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;

  try {
    const formData = await req.formData();
    const callSid = formData.get("CallSid")?.toString() || "";
    const dialCallStatus = formData.get("DialCallStatus")?.toString() || "";

    const url = new URL(req.url);
    const humanNumber = url.searchParams.get("phone_number") || "";
    const queueItemId = url.searchParams.get("queue_item_id") || "";

    console.log(`Human call complete: ${callSid}, status: ${dialCallStatus}, number: ${humanNumber}`);

    // 1. Free the human agent line
    if (humanNumber) {
      await supabase.from("human_agent_line_status").upsert({
        phone_number: humanNumber,
        status: "available",
        current_call_sid: null,
        current_queue_item_id: null,
        busy_since: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "phone_number" });
    }

    // 2. Update queue item to completed
    if (queueItemId) {
      await supabase.from("outbound_call_queue").update({
        status: "completed",
        updated_at: new Date().toISOString(),
      }).eq("id", queueItemId);
    }

    // 3. Mark any call queue entries as connected/completed
    await supabase.from("human_agent_call_queue")
      .update({ status: "connected", updated_at: new Date().toISOString() })
      .eq("call_sid", callSid);

    // 4. Check for next caller in queue and redirect them
    if (humanNumber) {
      const { data: nextInQueue } = await supabase
        .from("human_agent_call_queue")
        .select("*")
        .eq("phone_number", humanNumber)
        .eq("status", "waiting")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextInQueue) {
        console.log(`Next in queue: ${nextInQueue.call_sid} — will be picked up on next hold loop`);
        // The hold loop webhook will detect the line is now available and connect them
      }
    }

    // Log completion
    supabase.from("live_call_transcripts").insert({
      call_sid: callSid, speaker: "system",
      text: `[Human agent call completed — status: ${dialCallStatus}]`, is_final: true,
    }).then(() => {});

    // TwiML response — call is done
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Matthew">Thank you for your time. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml, { headers: { ...corsHeaders, "Content-Type": "text/xml" } });
  } catch (error) {
    console.error("Human call complete error:", error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Goodbye.</Say><Hangup/></Response>`,
      { headers: { ...corsHeaders, "Content-Type": "text/xml" } }
    );
  }
});
