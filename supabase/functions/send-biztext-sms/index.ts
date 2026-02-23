import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  // 1. Handle CORS Preflight First
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

    // 3. Get Environment Variables
    const BIZTEXT_API_KEY = Deno.env.get("BIZTEXT_API_KEY");
    if (!BIZTEXT_API_KEY) {
      throw new Error("Missing BizText API key in Edge Function secrets");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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

    console.log(`📱 Sending SMS via BizText to ${formattedTo}`);

    // 5. Call BizText API
    const biztextUrl = "https://api.textit.biz/";
    const biztextResponse = await fetch(biztextUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        "X-API-VERSION": "v1",
        Authorization: `Basic ${BIZTEXT_API_KEY}`,
      },
      body: JSON.stringify({
        to: formattedTo,
        text: message,
      }),
    });

    const responseText = await biztextResponse.text();
    console.log("📡 BizText raw response:", responseText.substring(0, 500));

    let biztextData: any;
    try {
      biztextData = JSON.parse(responseText);
    } catch {
      console.error("❌ BizText returned non-JSON:", responseText.substring(0, 300));
      throw new Error(`BizText API returned non-JSON response (status ${biztextResponse.status}).`);
    }

    if (!biztextResponse.ok) {
      console.error("❌ BizText error:", biztextData);
      throw new Error(biztextData.message || biztextData.error || "Failed to send SMS via BizText");
    }

    console.log("✅ BizText success:", JSON.stringify(biztextData));
    const dbStatus = biztextData.status === "failed" ? "failed" : "delivered";

    // 6. Log to database
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: msgData, error: msgError } = await supabase
      .from("communication_messages")
      .insert({
        business_id: business_id || null,
        store_id: store_id || null,
        contact_id: contact_id || null,
        direction: "outbound",
        channel: "biztext",
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
      channel: "biztext",
      direction: "outbound",
      recipient_phone: formattedTo,
      message_content: message,
      delivery_status: dbStatus,
      performed_by: "va",
    });

    if (logError) {
      console.error("❌ Failed to insert into communication_logs:", logError);
    }

    // 7. Return Success Response
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
