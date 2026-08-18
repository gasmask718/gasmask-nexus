import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordAttrFor } from "../_shared/recordingConsent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Manual outbound call for campaign cold calling.
 * Both sides connect: customer + live agent (PSTN forward).
 *
 * Flow:
 *   1. Build a per-call Conference name.
 *   2. Dial the CUSTOMER → Twilio joins them into the conference.
 *   3. Dial the AGENT (forward_phone_e164 from dialer_agent_availability,
 *      or MANUAL_DIALER_AGENT_PHONE fallback) → joins the same conference.
 *   4. Conference records both sides with dual channels.
 *   5. Status callbacks on every leg report into `twilio-call-status`.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();

    const { queue_item_id, business_id, agent_phone: explicitAgentPhone } = body;
    if (!queue_item_id || !business_id) {
      return new Response(
        JSON.stringify({ error: "Missing IDs", hint: "Provide queue_item_id and business_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: item, error: itemErr } = await supabase
      .from("outbound_call_queue")
      .select("id, status, phone_number, store_id, contact_name, business_id, campaign_id")
      .eq("id", queue_item_id)
      .single();
    if (itemErr || !item) throw new Error("Queue item not found");

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const FROM_NUMBER =
      Deno.env.get("TWILIO_PHONE_NUMBER") ||
      Deno.env.get("TWILIO_FROM_NUMBER") ||
      "+18776818621";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Twilio credentials not configured");
    }

    // ── Resolve which agent to bridge in ─────────────────────────────
    let agentPhone: string | null = explicitAgentPhone || null;
    if (!agentPhone) {
      const { data: agent } = await supabase
        .from("dialer_agent_availability")
        .select("forward_phone_e164, status")
        .eq("business_id", business_id)
        .eq("status", "available")
        .not("forward_phone_e164", "is", null)
        .order("last_ready_at", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      agentPhone = (agent as any)?.forward_phone_e164 || null;
    }
    if (!agentPhone) {
      agentPhone = Deno.env.get("MANUAL_DIALER_AGENT_PHONE") || null;
    }
    if (!agentPhone) {
      await supabase
        .from("outbound_call_queue")
        .update({
          status: "failed",
          last_error_severity: "error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", queue_item_id);
      return new Response(
        JSON.stringify({
          error:
            "No agent available. Set forward_phone_e164 on an available dialer_agent_availability row, or configure MANUAL_DIALER_AGENT_PHONE secret.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;
    const conferenceName = `dialer_${queue_item_id}`;

    const twilioBaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
    const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    // Helper to launch one leg (returns { sid })
    const launchLeg = async (params: {
      to: string;
      twiml: string;
      label: string;
    }) => {
      const p = new URLSearchParams();
      p.append("To", params.to);
      p.append("From", FROM_NUMBER);
      p.append("Twiml", params.twiml);
      p.append("StatusCallback", statusCallbackUrl);
      p.append("StatusCallbackMethod", "POST");
      p.append("StatusCallbackEvent", "initiated");
      p.append("StatusCallbackEvent", "ringing");
      p.append("StatusCallbackEvent", "answered");
      p.append("StatusCallbackEvent", "completed");

      const res = await fetch(twilioBaseUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: p.toString(),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(`Twilio ${params.label} leg failed: ${JSON.stringify(data)}`);
      }
      return data;
    };

    // Recording consent gate on the prospect. Fails closed.
    const { decision: recDecision } = await recordAttrFor(supabase, item.phone_number, {});
    const confRecordAttr = recDecision.allowed ? 'record="record-from-start"' : "";
    console.log(`[twilio-manual-call] conference recording=${confRecordAttr ? "on" : "off"} (${recDecision.reason}${recDecision.state ? `/${recDecision.state}` : ""})`);

    // Customer leg: short greeting, then join conference (start when agent joins).
    const customerTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">Please hold while we connect your call.</Say>
  <Dial>
    <Conference startConferenceOnEnter="false"
                endConferenceOnExit="true"
                ${confRecordAttr}
                recordingStatusCallback="${statusCallbackUrl}"
                recordingStatusCallbackEvent="completed"
                waitUrl="">${conferenceName}</Conference>
  </Dial>
</Response>`;

    // Agent leg: short whisper, then join conference (start it).
    const agentTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">Connecting you to ${escapeXml(item.contact_name || item.phone_number || "the prospect")}.</Say>
  <Dial>
    <Conference startConferenceOnEnter="true"
                endConferenceOnExit="true"
                waitUrl="">${conferenceName}</Conference>
  </Dial>
</Response>`;

    // Launch customer first so they're already in the conference when agent picks up.
    const customerCall = await launchLeg({
      to: item.phone_number,
      twiml: customerTwiml,
      label: "customer",
    });

    let agentCall: any = null;
    try {
      agentCall = await launchLeg({
        to: agentPhone,
        twiml: agentTwiml,
        label: "agent",
      });
    } catch (e) {
      // If we can't reach the agent, hang up the customer leg gracefully.
      try {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${customerCall.sid}.json`,
          {
            method: "POST",
            headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ Status: "completed" }).toString(),
          },
        );
      } catch (_) { /* ignore */ }
      throw e;
    }

    const customerSid = customerCall.sid.trim();
    const agentSid = agentCall.sid.trim();

    await supabase
      .from("outbound_call_queue")
      .update({
        twilio_call_sid: customerSid,
        status: "dialing",
        dialing_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", queue_item_id);

    await supabase.from("call_recordings").upsert(
      {
        provider_call_sid: customerSid,
        business_id,
        direction: "outbound",
        status: "initiated",
        from_number: FROM_NUMBER,
        to_number: item.phone_number,
        created_at: new Date().toISOString(),
      },
      { onConflict: "provider_call_sid" },
    );

    return new Response(
      JSON.stringify({
        success: true,
        mode: "manual",
        conference: conferenceName,
        customer_call_sid: customerSid,
        agent_call_sid: agentSid,
        agent_phone: agentPhone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[twilio-manual-call] error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
