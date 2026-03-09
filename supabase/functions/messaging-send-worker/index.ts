import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaign_id, batch_size = 50 } = await req.json();
    if (!campaign_id) throw new Error("campaign_id is required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Twilio credentials
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioMessagingServiceSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID")!;

    if (!twilioAccountSid || !twilioAuthToken || !twilioMessagingServiceSid) {
      throw new Error("Twilio credentials not configured");
    }

    // 1. Get campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("messaging_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) throw new Error("Campaign not found");
    if (campaign.status !== "active") {
      return new Response(JSON.stringify({ success: true, message: "Campaign not active" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 2. Get pending targets
    const { data: targets, error: targetError } = await supabase
      .from("messaging_targets")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending")
      .limit(batch_size);

    if (targetError) throw new Error(`Failed to fetch targets: ${targetError.message}`);
    if (!targets || targets.length === 0) {
      await supabase.from("messaging_campaigns").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", campaign_id);

      return new Response(JSON.stringify({ success: true, message: "Campaign complete", sent: 0 }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`📱 Processing ${targets.length} targets for campaign ${campaign.name} via Twilio`);

    let sentCount = 0;
    let failCount = 0;
    const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const authHeader = "Basic " + btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    for (const target of targets) {
      try {
        // Normalize phone
        let phone = (target.phone || "").replace(/\D/g, "");
        if (phone.startsWith("1") && phone.length === 11) phone = phone.substring(1);
        if (phone.length !== 10) {
          await supabase.from("messaging_targets").update({ status: "failed" }).eq("id", target.id);
          failCount++;
          continue;
        }

        const message = target.personalized_message || campaign.script || "";
        if (!message) {
          await supabase.from("messaging_targets").update({ status: "failed" }).eq("id", target.id);
          failCount++;
          continue;
        }

        // Send via Twilio
        const formData = new URLSearchParams({
          To: `+1${phone}`,
          Body: message,
          MessagingServiceSid: twilioMessagingServiceSid,
        });

        const response = await fetch(twilioApiUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });

        const responseText = await response.text();
        let responseData: any;
        try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText.trim() }; }

        const isError = !response.ok || responseData?.status === "failed" || responseData?.error_code;

        // Update target status
        await supabase.from("messaging_targets").update({
          status: isError ? "failed" : "sent",
          sent_at: isError ? null : new Date().toISOString(),
        }).eq("id", target.id);

        // Insert message record
        await supabase.from("messaging_messages").insert({
          campaign_id,
          store_id: target.store_id,
          target_id: target.id,
          direction: "outbound",
          body: message,
          ai_generated: campaign.mode === "ai_campaign",
          status: isError ? "failed" : "sent",
          phone,
          biztext_response: responseData,
        });

        if (isError) {
          failCount++;
          console.error(`❌ Twilio failed for ${phone}:`, responseData?.message || responseText.substring(0, 200));
        } else {
          sentCount++;
        }

        // Throttle
        const delayMs = Math.max(60000 / (campaign.throttle_per_minute || 50), 100);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (sendError: any) {
        console.error(`❌ Error processing target ${target.id}:`, sendError);
        await supabase.from("messaging_targets").update({ status: "failed" }).eq("id", target.id);
        failCount++;
      }
    }

    // Update campaign counters
    await supabase.from("messaging_campaigns").update({
      sent_count: (campaign.sent_count || 0) + sentCount,
      updated_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    console.log(`✅ Twilio batch complete: ${sentCount} sent, ${failCount} failed`);

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, failed: failCount, remaining: targets.length - sentCount - failCount }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("❌ messaging-send-worker error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
