import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { leadPhone, fromNumber, leadId, vaId } = await req.json();

    if (!leadPhone || !fromNumber || !vaId) {
      return new Response(
        JSON.stringify({ error: "leadPhone, fromNumber, and vaId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a call log entry
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // The counterparty number is known here even when leadId is absent (quick
    // dial). Persist it — a call log that cannot say who was called is a record
    // of nothing, and it is what made 107 recordings unclassifiable.
    const { data: callLog, error: logError } = await supabaseAdmin
      .from("va_call_logs")
      .insert({
        lead_id: leadId || null,
        va_id: vaId,
        twilio_number: fromNumber,
        to_number: leadPhone,
        to_number_source: leadId ? "lead" : "quick_dial",
        call_status: "initiated",
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Error creating call log:", logError);
    }

    // Attempt to initiate Twilio call via gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

    let callSid = null;

    if (LOVABLE_API_KEY && TWILIO_API_KEY) {
      const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

      const twilioResponse = await fetch(`${GATEWAY_URL}/Calls.json`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: leadPhone,
          From: fromNumber,
          Record: "true",
          Url: "http://demo.twilio.com/docs/voice.xml",
        }),
      });

      const twilioData = await twilioResponse.json();

      if (!twilioResponse.ok) {
        console.error("Twilio API error:", twilioData);
      } else {
        callSid = twilioData.sid;

        // Update call log with Twilio SID
        if (callLog?.id) {
          await supabaseAdmin
            .from("va_call_logs")
            .update({ call_status: "ringing" })
            .eq("id", callLog.id);
        }
      }
    } else {
      console.warn("Twilio connector not configured — call log created but no actual call placed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        callLogId: callLog?.id,
        callSid,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in va-initiate-call:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
