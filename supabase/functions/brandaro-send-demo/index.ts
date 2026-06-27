import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildSmsTemplate } from "../_shared/smsTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { demo_id, lead_id, channel = "sms", destination, message_override } = await req.json();

    if (!demo_id || !destination) {
      return new Response(JSON.stringify({ error: "demo_id and destination required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get demo info
    const { data: demo } = await supabase
      .from("brandaro_demo_sites")
      .select("demo_url, business_name, slug")
      .eq("id", demo_id)
      .single();

    if (!demo) throw new Error("Demo not found");

    const demoLink = demo.demo_url || `https://demo.brandaro.com/${demo.slug || demo_id}`;
    const message = message_override || 
      `Hi! We built a free website preview for ${demo.business_name}. Check it out: ${demoLink} — Reply STOP to opt out.`;

    let sendResult: any = { success: false, error: "No send provider configured" };

    if (channel === "sms") {
      // Attempt Twilio send via existing infrastructure
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioFrom = Deno.env.get("BRANDARO_TWILIO_NUMBER") || Deno.env.get("TWILIO_FROM_NUMBER");

      if (twilioSid && twilioAuth && twilioFrom) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const resp = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: destination,
            From: twilioFrom,
            Body: message,
          }),
        });
        const data = await resp.json();
        if (resp.ok) {
          sendResult = { success: true, provider_message_id: data.sid };
        } else {
          sendResult = { success: false, error: data.message || "Twilio error" };
        }
      }
    }

    // Log the message
    await supabase.from("brandaro_message_log").insert({
      lead_id: lead_id || null,
      demo_id,
      channel,
      provider: channel === "sms" ? "twilio" : "email",
      destination,
      message_body: message,
      send_status: sendResult.success ? "sent" : "failed",
      provider_message_id: sendResult.provider_message_id || null,
      failure_reason: sendResult.error || null,
      sent_at: sendResult.success ? new Date().toISOString() : null,
    });

    // Log failure for retry if needed
    if (!sendResult.success) {
      await supabase.from("brandaro_job_failures").insert({
        job_type: "send_demo",
        entity_type: "demo",
        entity_id: demo_id,
        last_error: sendResult.error,
        retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
    }

    // Update demo sent_at
    if (sendResult.success) {
      await supabase.from("brandaro_demo_sites")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", demo_id);
    }

    return new Response(JSON.stringify({ ok: sendResult.success, ...sendResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send demo error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
