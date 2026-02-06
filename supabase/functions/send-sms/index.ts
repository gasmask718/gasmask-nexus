import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendSMSRequest {
  to: string;
  message: string;
  business_id?: string;
  store_id?: string;
  contact_id?: string;
  contact_name?: string;
}

const mapTwilioStatus = (twilioStatus: string): string => {
  const statusMap: Record<string, string> = {
    queued: "pending",
    sending: "pending",
    sent: "delivered",
    delivered: "delivered",
    undelivered: "failed",
    failed: "failed",
    read: "read",
  };
  return statusMap[twilioStatus] || "pending";
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");

    const TWILIO_FROM_NUMBER = "+18484004179";

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error("Missing Twilio credentials");
    }

    const { to, message, business_id, store_id, contact_id, contact_name }: SendSMSRequest = await req.json();

    if (!to || !message) {
      throw new Error("Missing required fields: to and message");
    }

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

    console.log(`📱 Sending SMS to ${formattedTo}`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("To", formattedTo);
    formData.append("Body", message);

    formData.append("From", TWILIO_FROM_NUMBER);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("❌ Twilio error:", twilioData);
      throw new Error(twilioData.message || "Failed to send SMS");
    }

    console.log(`✅ Twilio success: SID=${twilioData.sid}, status=${twilioData.status}`);

    const dbStatus = mapTwilioStatus(twilioData.status || "queued");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
          twilio_sid: twilioData.sid,
          twilio_status: twilioData.status,
          contact_name: contact_name || null,
          sent_at: new Date().toISOString(),
          from_number: TWILIO_FROM_NUMBER,
        },
      })
      .select()
      .single();

    if (msgError) {
      console.error("❌ Failed to insert into communication_messages:", msgError);
    } else {
      console.log(`✅ Message logged: ${msgData.id}`);
    }

    const { error: logError } = await supabase.from("communication_logs").insert({
      channel: "sms",
      direction: "outbound",
      recipient_phone: formattedTo,
      message_content: message,
      delivery_status: dbStatus,
      performed_by: "va",
    });

    if (logError) {
      console.error("❌ Failed to insert into communication_logs:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sid: twilioData.sid,
        status: twilioData.status,
        message_id: msgData?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("❌ Error in send-sms function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
