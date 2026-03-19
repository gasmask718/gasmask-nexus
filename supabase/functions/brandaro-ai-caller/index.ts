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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { lead_id } = await req.json();
    if (!lead_id) throw new Error("lead_id is required");

    // 1. Load lead
    const { data: lead, error: leadErr } = await supabase
      .from("brandaro_qualified_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) throw new Error("Lead not found");
    if (!lead.phone_number) throw new Error("Lead has no phone number");

    const bizName = lead.business_name || "your business";
    const city = lead.city || "";
    const industry = lead.industry || "business";

    console.log(`[AI-CALLER] Starting for ${bizName} (${lead_id})`);

    // 2. Generate call script via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const scriptRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are writing a short voicemail/call script for an AI voice agent calling a small business owner. The business has no website. We build websites for $299.
Write a 20-second script that:
- Opens with their business name
- Mentions we noticed they don't have a website
- Says we built a free demo for them
- Asks them to reply to our text to see it
- Sounds natural, not robotic
- Ends with a callback number
Return ONLY the script text, nothing else.`,
          },
          {
            role: "user",
            content: `Business: ${bizName}\nCity: ${city}\nIndustry: ${industry}`,
          },
        ],
      }),
    });

    if (!scriptRes.ok) {
      const errText = await scriptRes.text();
      console.error("[AI-CALLER] Script generation failed:", errText);
      throw new Error("Failed to generate call script");
    }

    const scriptData = await scriptRes.json();
    const scriptText = scriptData.choices?.[0]?.message?.content?.trim();
    if (!scriptText) throw new Error("Empty script generated");

    console.log(`[AI-CALLER] Script generated (${scriptText.length} chars)`);

    // 3. Convert to audio via ElevenLabs TTS
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not configured");

    // Use Roger voice - professional male
    const voiceId = "CwhRBWXzGAHq8TQ4Fs17";

    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: scriptText,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("[AI-CALLER] ElevenLabs TTS failed:", errText);
      throw new Error("TTS generation failed");
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    console.log(`[AI-CALLER] Audio generated (${audioBuffer.byteLength} bytes)`);

    // 4. Upload audio to Supabase Storage
    const fileName = `ai-call-${lead_id}-${Date.now()}.mp3`;
    const { error: uploadErr } = await supabase.storage
      .from("call-audio")
      .upload(fileName, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: false,
      });

    if (uploadErr) {
      console.error("[AI-CALLER] Upload failed:", uploadErr);
      throw new Error("Audio upload failed");
    }

    const { data: urlData } = supabase.storage
      .from("call-audio")
      .getPublicUrl(fileName);

    const audioUrl = urlData.publicUrl;
    console.log(`[AI-CALLER] Audio uploaded: ${audioUrl}`);

    // 5. Initiate Twilio call with TwiML
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER")!;

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error("Twilio credentials not configured");
    }

    // Normalize phone
    let normalized = (lead.phone_number || "").replace(/\D/g, "");
    if (normalized.startsWith("1") && normalized.length === 11) normalized = normalized.substring(1);
    if (normalized.length !== 10) throw new Error("Invalid phone number format");
    const e164 = `+1${normalized}`;

    const gatherWebhookUrl = `${supabaseUrl}/functions/v1/twilio-gather-webhook`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Pause length="2"/>
  <Say voice="alice">To speak with us, press 1. To be removed from our list, press 9.</Say>
  <Gather numDigits="1" action="${gatherWebhookUrl}?lead_id=${lead_id}" method="POST">
    <Say voice="alice">Press 1 or 9 now.</Say>
  </Gather>
  <Say voice="alice">We didn't get a response. We'll follow up by text. Goodbye!</Say>
</Response>`;

    const twilioApiUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
    const formData = new URLSearchParams({
      To: e164,
      From: twilioPhoneNumber,
      Twiml: twiml,
      StatusCallback: `${supabaseUrl}/functions/v1/twilio-call-status?lead_id=${lead_id}`,
    });

    const callRes = await fetch(twilioApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const callData = await callRes.json();
    if (!callRes.ok || callData?.error_code) {
      console.error("[AI-CALLER] Twilio call failed:", callData);
      throw new Error(`Call failed: ${callData?.message || "unknown"}`);
    }

    console.log(`[AI-CALLER] Call initiated: ${callData.sid}`);

    // 6. Update lead and log
    await supabase
      .from("brandaro_qualified_leads")
      .update({
        call_attempts: (lead.call_attempts || 0) + 1,
        last_call_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead_id);

    await supabase.from("brandaro_call_logs").insert({
      lead_id,
      call_type: "ai_outbound",
      call_outcome: "ai_call_initiated",
      call_notes: scriptText,
      twilio_call_sid: callData.sid,
      audio_url: audioUrl,
    }).then(({ error }) => {
      if (error) console.warn("[AI-CALLER] Call log insert failed:", error);
    });

    // 7. Pipeline event
    fetch(`${supabaseUrl}/functions/v1/brandaro-pipeline-automator`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        action: "record_event",
        lead_id,
        event_type: "call_made",
      }),
    }).catch((e: any) => {
      console.warn("[AI-CALLER] Pipeline event failed:", e.message);
    });

    return new Response(
      JSON.stringify({
        success: true,
        call_sid: callData.sid,
        audio_url: audioUrl,
        script: scriptText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[AI-CALLER] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
