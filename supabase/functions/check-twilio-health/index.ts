import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_PHONE) {
      return new Response(JSON.stringify({
        status: "not_configured",
        message: "Missing Twilio credentials",
        missing: [
          !TWILIO_SID && "TWILIO_ACCOUNT_SID",
          !TWILIO_TOKEN && "TWILIO_AUTH_TOKEN",
          !TWILIO_PHONE && "TWILIO_PHONE_NUMBER",
        ].filter(Boolean),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}.json`,
      {
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
        },
      }
    );

    if (!response.ok) {
      return new Response(JSON.stringify({
        status: "error",
        message: "Twilio credentials invalid",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify({
      status: "active",
      account_name: data.friendly_name,
      account_status: data.status,
      phone_number: TWILIO_PHONE,
      message: "Twilio connected and active",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({
      status: "error",
      message: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
