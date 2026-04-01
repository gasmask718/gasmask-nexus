import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { vaId, twilioNumber, leadId, leadPhone, leadName, action } = await req.json();

    if (!vaId || !action) {
      return new Response(JSON.stringify({ error: "vaId and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    if (action === "dial") {
      if (!leadPhone || !twilioNumber) {
        return new Response(JSON.stringify({ error: "leadPhone and twilioNumber required for dial" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // DNC check
      const { data: dncMatch } = await supabaseAdmin
        .from("dnc_list")
        .select("id")
        .eq("phone_number", leadPhone)
        .maybeSingle();

      if (dncMatch) {
        // Log as DNC skip
        await supabaseAdmin.from("va_call_logs").insert({
          lead_id: leadId || null,
          va_id: vaId,
          twilio_number: twilioNumber,
          call_status: "dnc_skipped",
          disposition: "dnc",
        });

        await supabaseAdmin.rpc("upsert_leaderboard_stat", {
          p_va_id: vaId, p_field: "calls_dialed", p_increment: 1,
        });

        return new Response(JSON.stringify({ skipped: true, reason: "dnc" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create call log
      const { data: callLog } = await supabaseAdmin
        .from("va_call_logs")
        .insert({
          lead_id: leadId || null,
          va_id: vaId,
          twilio_number: twilioNumber,
          call_status: "initiated",
        })
        .select("id")
        .single();

      // Increment dialed counter
      await supabaseAdmin.rpc("upsert_leaderboard_stat", {
        p_va_id: vaId, p_field: "calls_dialed", p_increment: 1,
      });

      // Initiate Twilio call
      const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
      const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

      let callSid = null;

      if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
        const statusCallbackUrl = `${SUPABASE_URL}/functions/v1/va-dialer-status`;

        // TwiML: Connect to the VA's browser client, then dial the lead
        const twimlUrl = `${SUPABASE_URL}/functions/v1/va-power-dialer?action=twiml&vaId=${encodeURIComponent(vaId)}&leadPhone=${encodeURIComponent(leadPhone)}&callLogId=${callLog?.id || ""}`;

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: `client:user_${vaId.replace(/-/g, "")}`,
              From: twilioNumber,
              Url: twimlUrl,
              Record: "true",
              MachineDetection: "DetectMessageEnd",
              MachineDetectionTimeout: "5",
              StatusCallback: statusCallbackUrl,
              StatusCallbackEvent: "initiated ringing answered completed",
              StatusCallbackMethod: "POST",
              Timeout: "20",
            }),
          }
        );

        const twilioData = await twilioRes.json();

        if (!twilioRes.ok) {
          console.error("Twilio error:", twilioData);
        } else {
          callSid = twilioData.sid;
          if (callLog?.id) {
            await supabaseAdmin.from("va_call_logs")
              .update({ call_status: "ringing", call_sid: callSid })
              .eq("id", callLog.id);
          }
        }
      } else {
        console.warn("Twilio credentials not configured");
      }

      return new Response(JSON.stringify({
        success: true, callLogId: callLog?.id, callSid,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "twiml") {
      // Return TwiML to bridge VA to outbound call
      const url = new URL(req.url);
      const leadPhoneParam = url.searchParams.get("leadPhone") || "";
      const callLogId = url.searchParams.get("callLogId") || "";

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${twilioNumber || ""}" record="record-from-answer-dual" timeout="20"
    action="${SUPABASE_URL}/functions/v1/va-dialer-status?callLogId=${callLogId}&event=dial-complete"
    method="POST">
    <Number>${leadPhoneParam}</Number>
  </Dial>
</Response>`;

      return new Response(twiml, {
        status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    if (action === "disposition") {
      const { callLogId, disposition, excitementLevel, notes, callbackAt } = await req.json();

      if (!callLogId) {
        return new Response(JSON.stringify({ error: "callLogId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: any = {};
      if (disposition) updateData.disposition = disposition;
      if (excitementLevel) updateData.excitement_level = excitementLevel;
      if (notes) updateData.va_notes = notes;
      if (callbackAt) updateData.callback_scheduled_at = callbackAt;

      await supabaseAdmin.from("va_call_logs").update(updateData).eq("id", callLogId);

      if (disposition === "closed") {
        await supabaseAdmin.rpc("upsert_leaderboard_stat", {
          p_va_id: vaId, p_field: "calls_closed", p_increment: 1,
        });
      }

      // Update lead excitement level if provided
      if (excitementLevel && leadId) {
        await supabaseAdmin.from("brandaro_qualified_leads")
          .update({ excitement_level: excitementLevel })
          .eq("id", leadId);
      }

      if (callbackAt && leadId) {
        await supabaseAdmin.from("brandaro_qualified_leads")
          .update({ callback_scheduled_at: callbackAt })
          .eq("id", leadId);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("va-power-dialer error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
