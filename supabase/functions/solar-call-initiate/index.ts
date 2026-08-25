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
    const { lead_id, contact_id, agent_id } = await req.json();
    const targetId = lead_id || contact_id;
    if (!targetId) throw new Error("lead_id or contact_id required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER")!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Missing Twilio configuration");
    }

    // Fetch lead data
    let phone: string | null = null;
    let leadName = "Unknown";
    let leadData: any = null;

    if (lead_id) {
      const { data } = await supabase
        .from("solar_leads")
        .select("id, full_name, phone, city, state, monthly_bill_range, lead_score, status")
        .eq("id", lead_id)
        .single();
      leadData = data;
      phone = data?.phone;
      leadName = data?.full_name || "Solar Lead";
    } else if (contact_id) {
      const { data } = await supabase
        .from("solar_outreach_contacts")
        .select("id, name, phone, address, state")
        .eq("id", contact_id)
        .single();
      leadData = data;
      phone = data?.phone;
      leadName = data?.name || "Contact";
    }

    if (!phone) throw new Error("No phone number found for this lead");

    // Normalize phone
    let formattedPhone = phone.replace(/[^\d+]/g, "");
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = formattedPhone.startsWith("1") ? `+${formattedPhone}` : `+1${formattedPhone}`;
    }

    // ── BrightSun outbound gate (suppression / STOP / jurisdiction / consent) ──
    const gate = await bsOutboundGate({
      supabase,
      phone: formattedPhone,
      state: leadData?.state ?? null,
      channel: "voice",
      caller: "solar-call-initiate",
      leadId: lead_id || null,
      contactId: contact_id || null,
    });
    if (!gate.allowed) {
      return new Response(JSON.stringify({
        success: false,
        blocked: true,
        reason_code: gate.reasonCode,
        reason: gate.detail ?? gate.reasonCode,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Resolve AI agent
    let resolvedAgentId = agent_id;
    if (!resolvedAgentId) {
      // Find a solar-configured AI agent
      const { data: agents } = await supabase
        .from("ai_agents")
        .select("id, persona_id")
        .eq("active", true)
        .eq("role", "closer")
        .limit(1);
      resolvedAgentId = agents?.[0]?.id;
    }

    // Build TwiML URL
    const projectId = supabaseUrl.replace("https://", "").split(".")[0];
    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-status`;

    let twimlUrl: string;
    if (resolvedAgentId) {
      // AI agent call via ElevenLabs bridge
      const bridgeParams = new URLSearchParams({
        agent_id: resolvedAgentId,
        lead_id: targetId,
        lead_name: encodeURIComponent(leadName),
        business_name: encodeURIComponent("BrightSun Energy"),
        business_type: "solar",
      });
      twimlUrl = `${supabaseUrl}/functions/v1/twilio-elevenlabs-bridge?${bridgeParams}`;
    } else {
      // Fallback: TTS greeting then gather
      twimlUrl = `${supabaseUrl}/functions/v1/twilio-gather-webhook?lead_id=${targetId}&business_name=BrightSun+Energy`;
    }

    // Route the call through the TwiML-side gate; it re-checks and only then
    // redirects to `twimlUrl`. Nothing is spoken before the gate answers.
    const gateParams = new URLSearchParams({
      bs_target: encodeTarget(twimlUrl),
      caller: "solar-call-initiate",
      state: (leadData?.state ?? "") as string,
    });
    if (lead_id) gateParams.set("lead_id", lead_id);
    if (contact_id) gateParams.set("contact_id", contact_id);
    const gatedUrl = `${supabaseUrl}/functions/v1/bs-outbound-gate?${gateParams}`;

    // Create call via Twilio
    const callParams = new URLSearchParams({
      To: formattedPhone,
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
      console.error("❌ Twilio error:", twilioData);
      throw new Error(`Twilio call failed: ${twilioData.message || "Unknown error"}`);
    }

    const callSid = twilioData.sid;
    console.log(`✅ Solar call initiated: ${callSid} → ${formattedPhone}`);

    // Log to solar_interactions
    await supabase.from("solar_interactions").insert({
      lead_id: lead_id || null,
      interaction_type: "call",
      channel: "phone",
      direction: "outbound",
      summary: `AI call initiated to ${leadName}`,
      ai_generated: true,
      metadata: {
        call_sid: callSid,
        agent_id: resolvedAgentId,
        phone: formattedPhone,
        contact_id: contact_id || null,
      },
    });

    // Create live_calls record for observability
    await supabase.from("live_calls" as any).insert({
      provider_call_sid: callSid,
      from_number: TWILIO_PHONE_NUMBER,
      to_number: formattedPhone,
      direction: "outbound",
      status: "initiated",
      started_at: new Date().toISOString(),
    }).then(() => {});

    // Update lead status
    if (lead_id) {
      await supabase.from("solar_leads").update({ status: "contacted" }).eq("id", lead_id);
    } else if (contact_id) {
      await supabase.from("solar_outreach_contacts").update({
        outreach_status: "contacted",
        last_contacted: new Date().toISOString(),
      }).eq("id", contact_id);
    }

    return new Response(JSON.stringify({
      success: true,
      call_sid: callSid,
      to: formattedPhone,
      agent_id: resolvedAgentId,
      lead_name: leadName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("❌ solar-call-initiate error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
