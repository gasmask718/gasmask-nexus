import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
  const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
  const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")!;
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
  const projectId = supabaseUrl.replace("https://", "").split(".")[0];

  // Auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const {
      phone_numbers,
      tts_script,
      handoff_number,
      voice_id = "JBFqnCBsd6RMkjVDRZzb",
      campaign_type = "tts_blast",
    } = body;

    if (!phone_numbers?.length || !handoff_number) {
      return new Response(JSON.stringify({ error: "phone_numbers and handoff_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create campaign
    const { data: campaign, error: campaignErr } = await supabase
      .from("cold_call_campaigns")
      .insert({
        created_by: user.id,
        campaign_type,
        tts_script: tts_script || null,
        voice_id: campaign_type === "tts_blast" ? voice_id : null,
        handoff_number,
        status: "running",
        total_numbers: phone_numbers.length,
        completed_count: 0,
        transferred_count: 0,
      })
      .select()
      .single();

    if (campaignErr) throw campaignErr;

    // 2. Insert call items
    const items = phone_numbers.map((phone: string) => ({
      campaign_id: campaign.id,
      phone_number: phone.trim(),
      status: "queued",
    }));

    const { data: callItems, error: itemsErr } = await supabase
      .from("cold_call_items")
      .insert(items)
      .select();

    if (itemsErr) throw itemsErr;

    // 3. Generate TTS audio if TTS blast
    let ttsAudioUrl: string | null = null;
    if (campaign_type === "tts_blast" && tts_script) {
      console.log("🔊 Generating TTS audio via ElevenLabs...");
      const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: tts_script,
          model_id: "eleven_monolingual_v1",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!ttsRes.ok) {
        const errText = await ttsRes.text();
        console.error("ElevenLabs TTS error:", errText);
        throw new Error(`TTS generation failed: ${errText}`);
      }

      const audioData = await ttsRes.arrayBuffer();
      const fileName = `campaign_${campaign.id}.mp3`;

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from("cold-call-audio")
        .upload(fileName, audioData, {
          contentType: "audio/mpeg",
          upsert: true,
        });

      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
        throw uploadErr;
      }

      const { data: publicUrl } = supabase.storage
        .from("cold-call-audio")
        .getPublicUrl(fileName);

      ttsAudioUrl = publicUrl.publicUrl;
      console.log("✅ TTS audio uploaded:", ttsAudioUrl);
    }

    // 4. Dial each number (batched, max 5 concurrent)
    const MAX_CONCURRENT = 5;
    const webhookUrl = `https://${projectId}.supabase.co/functions/v1/cold-call-tts-webhook`;
    const statusCallbackUrl = `https://${projectId}.supabase.co/functions/v1/twilio-call-status`;
    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const dialBatch = async (batch: typeof callItems) => {
      await Promise.all(batch.map(async (item: any) => {
        try {
          // Update status to dialing
          await supabase
            .from("cold_call_items")
            .update({ status: "dialing", updated_at: new Date().toISOString() })
            .eq("id", item.id);

          // Build TwiML
          let twimlUrl: string;
          if (campaign_type === "tts_blast" && ttsAudioUrl) {
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${ttsAudioUrl}</Play>
  <Gather input="dtmf speech" timeout="5" numDigits="1" action="${webhookUrl}?campaign_id=${campaign.id}&amp;item_id=${item.id}&amp;handoff=${encodeURIComponent(handoff_number)}">
    <Say voice="alice">Press 1 or say yes to speak with a representative.</Say>
  </Gather>
  <Say voice="alice">Thank you for your time. Goodbye.</Say>
  <Hangup/>
</Response>`;
            twimlUrl = `http://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`;
          } else {
            // Normal blast - just connect to handoff
            const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Please hold while we connect you.</Say>
  <Dial callerId="${TWILIO_PHONE_NUMBER}">
    <Number>${handoff_number}</Number>
  </Dial>
</Response>`;
            twimlUrl = `http://twimlets.com/echo?Twiml=${encodeURIComponent(twiml)}`;
          }

          // Place call via Twilio
          const callParams = new URLSearchParams();
          callParams.append("To", item.phone_number);
          callParams.append("From", TWILIO_PHONE_NUMBER);
          callParams.append("Url", twimlUrl);
          callParams.append("StatusCallback", statusCallbackUrl);
          // Repeated params — a space-joined single value subscribes to nothing.
          for (const ev of ["initiated", "ringing", "answered", "completed"]) {
            callParams.append("StatusCallbackEvent", ev);
          }
          callParams.append("StatusCallbackMethod", "POST");
          callParams.append("Timeout", "30");

          const twilioRes = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`,
            {
              method: "POST",
              headers: {
                Authorization: `Basic ${twilioAuth}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: callParams,
            }
          );

          const twilioData = await twilioRes.json();

          if (!twilioRes.ok) {
            console.error(`❌ Twilio error for ${item.phone_number}:`, twilioData);
            await supabase
              .from("cold_call_items")
              .update({
                status: "failed",
                disposition: twilioData.message || "Twilio error",
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);
            return;
          }

          console.log(`📞 Call placed: ${item.phone_number} → SID: ${twilioData.sid}`);
          await supabase
            .from("cold_call_items")
            .update({
              call_sid: twilioData.sid,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          // Also log to manual_call_logs for audit
          await supabase.from("manual_call_logs").insert({
            phone_number: item.phone_number,
            direction: "outbound",
            status: "initiated",
            caller_id: user.id,
            started_at: new Date().toISOString(),
            from_number: TWILIO_PHONE_NUMBER,
            to_number: item.phone_number,
            notes: `Cold call blast campaign: ${campaign.id}`,
            twilio_call_sid: twilioData.sid,
          });

        } catch (err: any) {
          console.error(`❌ Error dialing ${item.phone_number}:`, err);
          await supabase
            .from("cold_call_items")
            .update({
              status: "failed",
              disposition: err.message || "Unknown error",
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        }
      }));
    };

    // Process in batches of MAX_CONCURRENT
    // Don't await all - return immediately and let it process in background
    (async () => {
      try {
        for (let i = 0; i < (callItems || []).length; i += MAX_CONCURRENT) {
          const batch = (callItems || []).slice(i, i + MAX_CONCURRENT);
          await dialBatch(batch);
          // Small delay between batches
          if (i + MAX_CONCURRENT < (callItems || []).length) {
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        // Update campaign status
        const { data: finalItems } = await supabase
          .from("cold_call_items")
          .select("status")
          .eq("campaign_id", campaign.id);

        const completedCount = (finalItems || []).filter(
          (i: any) => !["queued", "dialing"].includes(i.status)
        ).length;
        const transferredCount = (finalItems || []).filter(
          (i: any) => i.status === "transferred"
        ).length;

        await supabase
          .from("cold_call_campaigns")
          .update({
            status: "completed",
            completed_count: completedCount,
            transferred_count: transferredCount,
          })
          .eq("id", campaign.id);

        console.log(`✅ Campaign ${campaign.id} completed`);
      } catch (err) {
        console.error("Campaign processing error:", err);
        await supabase
          .from("cold_call_campaigns")
          .update({ status: "completed" })
          .eq("id", campaign.id);
      }
    })();

    return new Response(
      JSON.stringify({ success: true, campaign }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ Cold call blast error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
