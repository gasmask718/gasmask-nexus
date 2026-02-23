import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Configuration ──────────────────────────────────────────────────────
// Change this constant if Biz Text Solutions uses a different header name
const AUTH_HEADER_KEY = "Authorization";
const AUTH_HEADER_PREFIX = "Bearer ";
const BIZTEXT_API_URL = "https://www.biztextsolutions.com/api/messages?websiteId=438";
const BIZTEXT_CUSTOMER_ID = 149333;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendBizTextRequest {
  to: string;
  message: string;
  business_id?: string;
  store_id?: string;
  contact_id?: string;
  contact_name?: string;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 2. Parse Request Body
    const body = await req.json();
    const { to, message, business_id, store_id, contact_id, contact_name } = body as SendBizTextRequest;

    if (!to || !message) {
      throw new Error("Missing required fields: to and message");
    }

    // 3. Read Secrets
    const BIZTEXT_TOKEN = Deno.env.get("BIZTEXT_TOKEN")?.trim();
    if (!BIZTEXT_TOKEN) {
      throw new Error("Missing BIZTEXT_TOKEN in Edge Function secrets");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials in Edge Function secrets");
    }

    // 4. Normalize phone number
    let formattedTo = to.replace(/\D/g, "");
    if (formattedTo.startsWith("09") && formattedTo.length === 11) {
      formattedTo = `+63${formattedTo.substring(1)}`;
    } else if (formattedTo.startsWith("63") && formattedTo.length === 12) {
      formattedTo = `+${formattedTo}`;
    } else if (formattedTo.length === 10) {
      formattedTo = `+1${formattedTo}`;
    } else if (formattedTo.length >= 11 && !formattedTo.startsWith("+")) {
      formattedTo = `+${formattedTo}`;
    }

    console.log(`📱 Sending SMS via Biz Text Solutions to ${formattedTo}`);

    // 5. Call Biz Text Solutions POST API
    const biztextResponse = await fetch(BIZTEXT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [AUTH_HEADER_KEY]: `${AUTH_HEADER_PREFIX}${BIZTEXT_TOKEN}`,
      },
      body: JSON.stringify({
        clientNumber: formattedTo,
        message: message,
        customer_id: BIZTEXT_CUSTOMER_ID,
      }),
    });

    const responseText = await biztextResponse.text();
    console.log("📡 Biz Text Solutions raw response:", responseText.substring(0, 500));

    // 6. Parse & validate response
    let biztextData: any;
    try {
      biztextData = JSON.parse(responseText);
    } catch {
      biztextData = { raw_response: responseText.trim() };
    }

    const transmissionStatus = biztextData?.transmission_status ?? biztextData?.transmissionStatus ?? "";
    const isSent = transmissionStatus === "SENT";

    if (!isSent) {
      console.error("❌ Biz Text Solutions did not return SENT:", JSON.stringify(biztextData));
      throw new Error(`Biz Text Solutions API rejected request: ${responseText.substring(0, 300).trim()}`);
    }

    console.log("✅ Biz Text Solutions success:", JSON.stringify(biztextData));
    const dbStatus = "delivered";

    // 7. Log to database
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: msgData, error: msgError } = await supabase
      .from("communication_messages")
      .insert({
        business_id: business_id || null,
        store_id: store_id || null,
        contact_id: contact_id || null,
        direction: "outbound",
        channel: "sms",
        content: message,
        phone_number: formattedTo,
        status: dbStatus,
        ai_generated: false,
        metadata: {
          biztext_response: biztextData,
          contact_name: contact_name || null,
          sent_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error("❌ Failed to insert into communication_messages:", msgError);
    } else {
      console.log(`✅ Message logged: ${msgData?.id}`);
    }

    const { error: logError } = await supabase.from("communication_logs").insert({
      channel: "sms",
      direction: "outbound",
      recipient_phone: formattedTo,
      message_content: message,
      summary: `Outbound SMS to ${formattedTo}`,
      delivery_status: dbStatus,
      performed_by: "va",
    });

    if (logError) {
      console.error("❌ Failed to insert into communication_logs:", logError);
    }

    // 8. Return Success
    return new Response(
      JSON.stringify({
        success: true,
        status: dbStatus,
        message_id: msgData?.id,
        biztext_response: biztextData,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("❌ Error in send-biztext-sms function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
