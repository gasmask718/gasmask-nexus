import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "twilio";

    let fromNumber = "";
    let body = "";

    if (provider === "twilio") {
      // Twilio sends form-encoded POST
      const formData = await req.formData();
      fromNumber = (formData.get("From") as string) || "";
      body = (formData.get("Body") as string) || "";
    } else {
      // BizText or generic JSON
      const json = await req.json();
      fromNumber = json.from || json.phone || json.From || "";
      body = json.body || json.message || json.Body || json.txt || "";
    }

    const normalizedPhone = fromNumber.replace(/\D/g, "");
    const trimmedBody = body.trim().toUpperCase();

    console.log(`📨 Inbound from ${normalizedPhone}: "${trimmedBody}" (provider: ${provider})`);

    // Check if STOP word
    if (STOP_WORDS.includes(trimmedBody)) {
      console.log(`🛑 STOP detected from ${normalizedPhone}`);

      // Upsert into opt_out_events
      const { error } = await supabase
        .from("opt_out_events")
        .upsert(
          {
            phone_number: normalizedPhone,
            source: provider,
            reason: `Inbound STOP: "${trimmedBody}"`,
          },
          { onConflict: "phone_number" }
        );

      if (error) {
        console.error("❌ Failed to insert opt_out_event:", error);
      } else {
        console.log(`✅ Opt-out recorded for ${normalizedPhone}`);
      }
    }

    // Return proper provider response
    if (provider === "twilio") {
      // TwiML response
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Inbound webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
