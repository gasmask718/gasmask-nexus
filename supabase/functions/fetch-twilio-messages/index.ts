import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(
        JSON.stringify({ messages: [], error: "Twilio not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch recent messages from Twilio API (last 200)
    const response = await fetch(`${GATEWAY_URL}/Messages.json?PageSize=200`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twilio API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ messages: [], error: `Twilio API error: ${response.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const messages = data.messages || [];

    return new Response(
      JSON.stringify({ messages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("fetch-twilio-messages error:", error);
    return new Response(
      JSON.stringify({ messages: [], error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
