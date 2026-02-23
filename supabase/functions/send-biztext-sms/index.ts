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
    const BIZTEXT_ID = Deno.env.get("BIZTEXT_ID");
    const BIZTEXT_PW = Deno.env.get("BIZTEXT_PW");
    if (!BIZTEXT_ID || !BIZTEXT_PW) {
      throw new Error("Missing BIZTEXT_ID or BIZTEXT_PW in Edge Function secrets");
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

    console.log(`📱 Sending SMS via BizText Basic HTTP to ${formattedTo}`);

    // 5. Call BizText Basic HTTP GET API
    const biztextUrl = new URL("https://textit.biz/sendmsg/");
    biztextUrl.searchParams.set("id", BIZTEXT_ID);
    biztextUrl.searchParams.set("pw", BIZTEXT_PW);
    biztextUrl.searchParams.set("to", formattedTo);
    biztextUrl.searchParams.set("text", message);

    const biztextResponse = await fetch(biztextUrl.toString());
    const responseText = await biztextResponse.text();
    console.log("📡 BizText raw response:", responseText.substring(0, 500));

    if (!biztextResponse.ok) {
      console.error("❌ BizText error (HTTP " + biztextResponse.status + "):", responseText);
      throw new Error(`BizText API returned HTTP ${biztextResponse.status}: ${responseText.substring(0, 200)}`);
    }

    // Parse response — may be JSON or plain text
    let biztextData: any;
    try {
      biztextData = JSON.parse(responseText);
    } catch {
      biztextData = { raw_response: responseText.trim() };
    }

    console.log("✅ BizText success:", JSON.stringify(biztextData));
    const dbStatus = responseText.toLowerCase().includes("fail") ? "failed" : "delivered";

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
