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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error("Missing Twilio credentials");
    }

    const { to, message, business_id, store_id, contact_id, contact_name }: SendSMSRequest = await req.json();

    if (!to || !message) {
      throw new Error("Missing required fields: to and message");
    }

    // Format phone number to E.164 format
    let formattedTo = to.replace(/\D/g, "");
    
    // Handle Philippine numbers (start with 09, 11 digits)
    if (formattedTo.startsWith("09") && formattedTo.length === 11) {
      formattedTo = `+63${formattedTo.substring(1)}`; // Remove leading 0, add +63
    }
    // Handle Philippine numbers already with country code (63...)
    else if (formattedTo.startsWith("63") && formattedTo.length === 12) {
      formattedTo = `+${formattedTo}`;
    }
    // Handle US numbers (10 digits)
    else if (formattedTo.length === 10) {
      formattedTo = `+1${formattedTo}`;
    }
    // Handle numbers that already have country code but no +
    else if (formattedTo.length >= 11 && !formattedTo.startsWith("+")) {
      formattedTo = `+${formattedTo}`;
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append("To", formattedTo);
    formData.append("From", TWILIO_PHONE_NUMBER);
    formData.append("Body", message);

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      throw new Error(twilioData.message || "Failed to send SMS");
    }

    // Log the message to Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from("communication_messages").insert({
      business_id,
      store_id,
      contact_id,
      direction: "outbound",
      channel: "sms",
      content: message,
      phone_number: formattedTo,
      status: twilioData.status || "sent",
      ai_generated: false,
    });

    // Also log to communication_logs for tracking
    await supabase.from("communication_logs").insert({
      channel: "sms",
      direction: "outbound",
      recipient_phone: formattedTo,
      message_content: message,
      delivery_status: twilioData.status || "sent",
      performed_by: "va",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        sid: twilioData.sid,
        status: twilioData.status 
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  } catch (error: any) {
    console.error("Error in send-sms function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
