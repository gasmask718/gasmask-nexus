// CRITICAL: Uses EXISTING Twilio backend secrets (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
// Sends SMS notifications for ambassador lifecycle events
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyPayload {
  event: "application_received" | "approved" | "conversion" | "payout_paid";
  ambassador_id: string;
  // Optional context
  commission_amount?: number;
  revenue_amount?: number;
  referral_code?: string;
  payout_amount?: number;
  name?: string;
  phone?: string;
}

function buildMessage(event: string, data: NotifyPayload & { ambassador?: any }): string {
  const name = data.name || data.ambassador?.full_name || "Ambassador";
  const code = data.referral_code || data.ambassador?.referral_code || "";

  switch (event) {
    case "application_received":
      return `🎉 We received your Unforgettable Times ambassador application, ${name}. We'll review it and notify you once approved.`;

    case "approved":
      return `✅ You're approved as an Unforgettable Times ambassador, ${name}! Your referral code: ${code}. Start sharing and earning now!`;

    case "conversion":
      return `💰 A new referral conversion was credited to your account! Commission: $${(data.commission_amount || 0).toFixed(2)}. Check your dashboard for updated earnings.`;

    case "payout_paid":
      return `💸 Your ambassador payout of $${(data.payout_amount || 0).toFixed(2)} has been processed. Check your dashboard for details.`;

    default:
      return `📢 You have a new update on your Unforgettable Times ambassador account.`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawText = await req.text();
    let body: NotifyPayload;
    try { body = JSON.parse(rawText); } catch { body = {} as NotifyPayload; }

    if (!body.event) {
      return new Response(JSON.stringify({ error: "Missing event type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Twilio secrets
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Missing Twilio credentials in backend secrets");
      return new Response(JSON.stringify({ error: "Twilio not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ambassador phone if not provided
    let phone = body.phone;
    let ambassadorData: any = null;

    if (body.ambassador_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data } = await supabase
        .from("unforgettable_ambassadors")
        .select("full_name, phone, referral_code, total_commissions")
        .eq("id", body.ambassador_id)
        .maybeSingle();

      ambassadorData = data;
      if (!phone && data?.phone) phone = data.phone;
    }

    if (!phone) {
      console.warn("No phone number available for notification");
      return new Response(JSON.stringify({ error: "No phone number", sent: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const message = buildMessage(body.event, { ...body, ambassador: ambassadorData });

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const smsResp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
      },
      body: new URLSearchParams({ To: phone, From: fromNumber, Body: message }),
    });

    const smsResult = await smsResp.json();

    if (!smsResp.ok) {
      console.error("Twilio SMS failed:", smsResult);
      return new Response(JSON.stringify({ error: "SMS failed", details: smsResult }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`SMS sent: event=${body.event} phone=${phone} sid=${smsResult.sid}`);

    return new Response(JSON.stringify({ success: true, sid: smsResult.sid, event: body.event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ambassador-notify error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
