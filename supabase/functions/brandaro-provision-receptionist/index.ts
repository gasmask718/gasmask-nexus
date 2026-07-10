// brandaro-provision-receptionist
// Provisions a Retell AI agent + Twilio phone number for a receptionist client.
// Idempotent — safe to call twice (returns the existing setup).
// Called by brandaro-receptionist-webhook after payment, or manually from the
// Client Detail page via the [Retry Provisioning] button.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RETELL_BASE = "https://api.retellai.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const RETELL_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/brandaro-retell-webhook`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const retellKey = Deno.env.get("RETELL_API_KEY");
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioTok = Deno.env.get("TWILIO_AUTH_TOKEN");

    if (!retellKey) return json({ error: "Retell not configured (RETELL_API_KEY missing)" }, 500);
    if (!twilioSid || !twilioTok) return json({ error: "Twilio not configured" }, 500);

    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { client_id } = await req.json();
    if (!client_id) return json({ error: "client_id required" }, 400);

    // STEP 1 — Load client
    const { data: client, error: loadErr } = await supabase
      .from("brandaro_receptionist_clients")
      .select("*")
      .eq("id", client_id)
      .maybeSingle();
    if (loadErr) return json({ error: loadErr.message }, 500);
    if (!client) return json({ error: "client not found" }, 404);

    // Idempotency
    if (client.agent_provisioned && client.number_provisioned && client.retell_agent_id && client.twilio_phone_number) {
      return json({
        already_provisioned: true,
        retell_agent_id: client.retell_agent_id,
        twilio_phone_number: client.twilio_phone_number,
      });
    }

    // STEP 2a — Create Retell LLM
    const llmResp = await fetch(`${RETELL_BASE}/create-retell-llm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        general_prompt: buildSystemPrompt(client),
        general_tools: [
          { type: "end_call", name: "end_call", description: "End the call politely" },
        ],
      }),
    });
    if (!llmResp.ok) {
      const t = await llmResp.text();
      return json({ error: `Retell LLM create failed: ${llmResp.status} ${t}` }, 502);
    }
    const llm = await llmResp.json();

    // STEP 2 — Create Retell agent
    const agentResp = await fetch(`${RETELL_BASE}/create-agent`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_name: `${client.receptionist_name ?? "Sara"} for ${client.business_name}`,
        voice_id: client.retell_voice_id ?? "11labs-Dorothy",
        response_engine: { type: "retell-llm", llm_id: llm.llm_id },
        language: "en-US",
        ambient_sound: "office",
        max_call_duration_ms: 600000,
        enable_backchannel: true,
        reminder_trigger_ms: 10000,
        reminder_max_count: 2,
        webhook_url: RETELL_WEBHOOK_URL,
      }),
    });
    if (!agentResp.ok) {
      const t = await agentResp.text();
      return json({ error: `Retell agent create failed: ${agentResp.status} ${t}` }, 502);
    }
    const agent = await agentResp.json();

    // STEP 3 — Provision Twilio number (search local by client area code)
    const digits = (client.phone ?? "").replace(/\D/g, "");
    const areaCode = digits.length >= 10 ? digits.slice(-10, -7) : "929";

    const searchResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&SmsEnabled=true&VoiceEnabled=true&PageSize=1`,
      { headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioTok}`)}` } },
    );
    if (!searchResp.ok) {
      const t = await searchResp.text();
      return json({ error: `Twilio search failed: ${searchResp.status} ${t}` }, 502);
    }
    const search = await searchResp.json();
    const available = search.available_phone_numbers?.[0];
    if (!available) {
      return json({ error: `No Twilio numbers available in area code ${areaCode}` }, 502);
    }

    // Purchase number and point voiceUrl at Retell webhook
    const purchaseResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/IncomingPhoneNumbers.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${twilioSid}:${twilioTok}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          PhoneNumber: available.phone_number,
          VoiceUrl: RETELL_WEBHOOK_URL,
          VoiceMethod: "POST",
          FriendlyName: `Receptionist — ${client.business_name}`,
        }),
      },
    );
    if (!purchaseResp.ok) {
      const t = await purchaseResp.text();
      return json({ error: `Twilio purchase failed: ${purchaseResp.status} ${t}` }, 502);
    }
    const purchased = await purchaseResp.json();

    // STEP 4 — Link Retell agent to Twilio number
    await fetch(`${RETELL_BASE}/create-phone-number`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${retellKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone_number: purchased.phone_number,
        inbound_agent_id: agent.agent_id,
      }),
    }).catch((e) => console.warn("[provision] retell phone-link non-fatal", e));

    // STEP 5 — Update client
    const { error: updErr } = await supabase
      .from("brandaro_receptionist_clients")
      .update({
        retell_agent_id: agent.agent_id,
        twilio_phone_number: purchased.phone_number,
        twilio_number_sid: purchased.sid,
        agent_provisioned: true,
        agent_provisioned_at: new Date().toISOString(),
        number_provisioned: true,
        number_provisioned_at: new Date().toISOString(),
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .eq("id", client_id);
    if (updErr) console.error("[provision] client update failed", updErr);

    // STEP 6 — Activation SMS
    let activation_sms_sent = false;
    try {
      const twilioFrom = purchased.phone_number; // send from the new number itself
      const smsBody =
        `Hi ${client.owner_name ?? "there"}! Your AI Receptionist is live. ` +
        `Forward your business calls to: ${purchased.phone_number}\n` +
        `On iPhone: Settings → Phone → Call Forwarding.\n` +
        `Your AI will answer 24/7. Reply here with any questions.`;
      const smsResp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${twilioSid}:${twilioTok}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: client.phone,
            From: twilioFrom,
            Body: smsBody,
          }),
        },
      );
      activation_sms_sent = smsResp.ok;
    } catch (e) {
      console.warn("[provision] activation SMS failed", e);
    }

    return json({
      retell_agent_id: agent.agent_id,
      twilio_phone_number: purchased.phone_number,
      activation_sms_sent,
    });
  } catch (err) {
    console.error("[brandaro-provision-receptionist] error", err);
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});

function buildSystemPrompt(client: any): string {
  const faqs =
    Array.isArray(client.faqs)
      ? client.faqs.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
      : "";
  const services = Array.isArray(client.services_offered)
    ? client.services_offered.join(", ")
    : "";
  return `You are ${client.receptionist_name ?? "Sara"}, the AI receptionist for ${client.business_name} located in ${client.city ?? ""}, ${client.state ?? ""}.

ABOUT THE BUSINESS:
${client.business_description ?? ""}

SERVICES WE OFFER:
${services}

BUSINESS HOURS:
${JSON.stringify(client.business_hours ?? {})}

YOUR ROLE:
- Answer every call professionally and warmly.
- Book appointments when requested.
- Answer questions about the business.
- Take messages for callbacks.
- Never say you are an AI unless directly asked; if asked, say you are a virtual receptionist.
- If a caller demands a human immediately, offer a callback or transfer.

FREQUENTLY ASKED QUESTIONS:
${faqs}

APPOINTMENT BOOKING:
${client.appointment_booking_enabled
  ? `You can book appointments. Calendar: ${client.appointment_calendar_url ?? "(ask the caller for preferred time and confirm we will call back to lock it in)"}`
  : "Take a detailed message and the owner will call the caller back."}

ESCALATION:
If a caller is very upset or demands an immediate human, tell them the owner will call back within 1 hour.${
  client.escalation_phone ? ` You may also offer to transfer to ${client.escalation_phone}.` : ""
}
`;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
