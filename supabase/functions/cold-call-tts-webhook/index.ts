import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * COLD CALL TTS WEBHOOK
 * 
 * Handles Twilio <Gather> callbacks from TTS blast calls.
 * If the recipient pressed 1 or said "yes", transfers them to the handoff number.
 * Otherwise, says goodbye and hangs up.
 */

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;

  try {
    const url = new URL(req.url);
    const campaignId = url.searchParams.get("campaign_id");
    const itemId = url.searchParams.get("item_id");
    const handoffNumber = url.searchParams.get("handoff") || Deno.env.get("LIVE_HANDOFF_NUMBER") || "";

    // Parse form data from Twilio
    const formData = await req.formData();
    const digits = formData.get("Digits")?.toString() || "";
    const speechResult = formData.get("SpeechResult")?.toString() || "";
    const callSid = formData.get("CallSid")?.toString() || "";

    console.log(`📞 Webhook received — Campaign: ${campaignId}, Item: ${itemId}`);
    console.log(`   Digits: "${digits}", Speech: "${speechResult}", CallSid: ${callSid}`);

    // Determine if the caller is interested
    const isInterested =
      digits === "1" ||
      /\b(yes|yeah|yep|sure|okay|ok|interested|tell me more|speak|representative|connect)\b/i.test(speechResult);

    let twiml: string;

    if (isInterested && handoffNumber) {
      console.log(`✅ Interest detected — transferring to ${handoffNumber}`);
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Great! Connecting you now. Please hold.</Say>
  <Dial callerId="${TWILIO_PHONE_NUMBER}">
    <Number>${handoffNumber}</Number>
  </Dial>
</Response>`;

      // Update item status to transferred
      if (itemId) {
        await supabase
          .from("cold_call_items")
          .update({
            status: "transferred",
            disposition: `Interest detected: digits="${digits}" speech="${speechResult}"`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);
      }

      // Update campaign transferred count
      if (campaignId) {
        const { data: campaign } = await supabase
          .from("cold_call_campaigns")
          .select("transferred_count")
          .eq("id", campaignId)
          .single();

        if (campaign) {
          await supabase
            .from("cold_call_campaigns")
            .update({
              transferred_count: (campaign.transferred_count || 0) + 1,
            })
            .eq("id", campaignId);
        }
      }
    } else {
      console.log(`❌ No interest — hanging up`);
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for your time. Have a great day. Goodbye.</Say>
  <Hangup/>
</Response>`;

      // Update item status
      if (itemId) {
        await supabase
          .from("cold_call_items")
          .update({
            status: "completed",
            disposition: `No interest: digits="${digits}" speech="${speechResult}"`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", itemId);
      }
    }

    // Update campaign completed count
    if (campaignId) {
      const { data: campaign } = await supabase
        .from("cold_call_campaigns")
        .select("completed_count")
        .eq("id", campaignId)
        .single();

      if (campaign) {
        await supabase
          .from("cold_call_campaigns")
          .update({
            completed_count: (campaign.completed_count || 0) + 1,
          })
          .eq("id", campaignId);
      }
    }

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });

  } catch (err: any) {
    console.error("❌ Webhook error:", err);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We encountered an error. Goodbye.</Say>
  <Hangup/>
</Response>`;
    return new Response(errorTwiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
});
