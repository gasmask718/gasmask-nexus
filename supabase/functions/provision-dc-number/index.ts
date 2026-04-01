import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
  const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!TWILIO_SID || !TWILIO_TOKEN) {
    return new Response(JSON.stringify({ error: "Twilio credentials not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  const authHeader = `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`;
  const body = await req.json();
  const { action, area_code, phone_number, friendly_name, number_type, toll_free_prefix, country } = body;

  try {
    // ACTION: search
    if (action === "search") {
      let searchUrl: string;
      const isDR = country === "DR";

      if (number_type === "toll-free") {
        const prefix = toll_free_prefix || "800";
        searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/TollFree.json?VoiceEnabled=true&SmsEnabled=true&Limit=5&Contains=${prefix}`;
      } else if (isDR) {
        // DR numbers are NANP — search US/Local with DR area codes
        const drCode = area_code || "809";
        searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?AreaCode=${drCode}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      } else {
        const areaCode = area_code || "929";
        searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&VoiceEnabled=true&SmsEnabled=true&Limit=5`;
      }

      const res = await fetch(searchUrl, { headers: { Authorization: authHeader } });
      const data = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Twilio search failed", details: data }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const numbers = (data.available_phone_numbers || []).map((n: any) => ({
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        locality: n.locality || "",
        region: n.region || "",
        capabilities: n.capabilities,
      }));

      return new Response(JSON.stringify({ numbers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: purchase
    if (action === "purchase") {
      if (!phone_number) {
        return new Response(JSON.stringify({ error: "phone_number is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const webhookBase = `${SUPABASE_URL}/functions/v1`;
      const purchaseUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/IncomingPhoneNumbers.json`;

      const res = await fetch(purchaseUrl, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          PhoneNumber: phone_number,
          FriendlyName: friendly_name || "Dynasty Connect AI",
          VoiceUrl: `${webhookBase}/twilio-inbound-call`,
          VoiceMethod: "POST",
          SmsUrl: `${webhookBase}/twilio-inbound-sms`,
          SmsMethod: "POST",
        }),
      });

      const purchased = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Purchase failed", details: purchased }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isTollFree = number_type === "toll-free";
      const isDR = country === "DR";
      const monthlyCost = isDR ? 4.0 : isTollFree ? 2.0 : 1.0;

      const { error: dbError } = await supabase.from("dc_phone_numbers").insert({
        phone_number: purchased.phone_number,
        sid: purchased.sid,
        friendly_name: friendly_name || "Dynasty Connect AI",
        webhook_url: `${webhookBase}/twilio-inbound-call`,
        status: "active",
        is_ai_number: true,
        monthly_cost: monthlyCost,
        number_type: isDR ? "dr-local" : isTollFree ? "toll-free" : "local",
      });

      if (dbError) console.error("DB insert error:", dbError);

      return new Response(JSON.stringify({
        success: true,
        phone_number: purchased.phone_number,
        sid: purchased.sid,
        friendly_name: purchased.friendly_name,
        number_type: isDR ? "dr-local" : isTollFree ? "toll-free" : "local",
        monthly_cost: monthlyCost,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("provision-dc-number error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
