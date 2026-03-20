import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const { test_number, test_message } = await req.json();

    const res = await fetch(
      `${supabaseUrl}/functions/v1/sms-inbound-webhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: new URLSearchParams({
          From: test_number || "+15555555555",
          To: Deno.env.get("TWILIO_PHONE_NUMBER") || "+10000000000",
          Body: test_message || "Yes I am interested!",
          MessageSid: `TEST${Date.now()}`,
        }).toString(),
      }
    );

    const responseText = await res.text();

    return new Response(
      JSON.stringify({
        success: res.ok,
        status: res.status,
        response: responseText.substring(0, 200),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
