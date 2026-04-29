// Public TwiML endpoint hit by Twilio when the recipient answers.
// Plays the campaign's initial script via TTS, then asks for confirmation.
// On confirmation -> bridges to Bland AI agent. Otherwise -> polite hangup.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const xmlHeaders = { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" };

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const url = new URL(req.url);
    const campaign_id = url.searchParams.get("campaign_id");
    const queue_item_id = url.searchParams.get("queue_item_id");
    const lead_id = url.searchParams.get("lead_id");
    const agent_type = url.searchParams.get("agent_type") || "sales-outreach";
    const bland_agent_id = url.searchParams.get("bland_agent_id") || "";

    let form: FormData | null = null;
    try { form = await req.formData(); } catch { /* GET */ }
    const callSid = (form?.get("CallSid")?.toString()) || url.searchParams.get("CallSid") || "";

    // Load campaign script + confirmation prompt
    let script = "Hello, this is an important call regarding your account.";
    let confirmPrompt = "Press 1 or say yes to speak with our specialist now. Press 2 to opt out.";
    if (campaign_id) {
      const { data: c } = await supabase
        .from("dialer_campaigns")
        .select("initial_script, confirmation_prompt")
        .eq("id", campaign_id)
        .maybeSingle();
      if (c?.initial_script) script = c.initial_script;
      if ((c as any)?.confirmation_prompt) confirmPrompt = (c as any).confirmation_prompt;
    }

    // Log timeline
    await supabase.from("dialer_call_events").insert({
      campaign_id,
      queue_item_id,
      call_sid: callSid,
      event_type: "twiml.intro",
      source: "twilio",
      payload: { agent_type },
    });

    const ctx = new URLSearchParams({
      ...(campaign_id ? { campaign_id } : {}),
      ...(queue_item_id ? { queue_item_id } : {}),
      ...(lead_id ? { lead_id } : {}),
      agent_type,
      ...(bland_agent_id ? { bland_agent_id } : {}),
      attempt: "1",
    });
    const confirmUrl = `${SUPABASE_URL}/functions/v1/twilio-campaign-confirm?${ctx.toString()}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(script)}</Say>
  <Gather input="dtmf speech" numDigits="1" timeout="6" speechTimeout="auto"
          hints="yes,sure,okay,interested,one,two,no"
          action="${escapeXml(confirmUrl)}" method="POST">
    <Say voice="Polly.Joanna">${escapeXml(confirmPrompt)}</Say>
  </Gather>
  <Say voice="Polly.Joanna">We did not receive your response. Goodbye.</Say>
  <Hangup/>
</Response>`;

    return new Response(twiml.trim(), { headers: xmlHeaders });
  } catch (err) {
    console.error("twilio-campaign-twiml error:", err);
    const fb = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna">An error occurred. Goodbye.</Say><Hangup/></Response>`;
    return new Response(fb, { headers: xmlHeaders });
  }
});
