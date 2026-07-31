import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CALL_PURPOSES: Record<string, string> = {
  needs_order: "checking if they need to place a grabba order",
  bring_samples: "offering to bring new product samples",
  starter_kit: "offering a starter kit for new products",
  switch_tubes: "offering to swap out old tube inventory",
  follow_up: "general account check-in",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { store_id, store_name, store_phone, city, call_purpose } = await req.json();

    if (!store_phone) {
      return new Response(
        JSON.stringify({ error: "store_phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const purpose = call_purpose || "follow_up";
    const purposeDesc = CALL_PURPOSES[purpose] || CALL_PURPOSES.follow_up;

    // Generate GasMask-specific call script via Lovable AI
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    let scriptText = `Hey, this is a call from GasMask distribution. We're reaching out to ${store_name || "your store"} about your grabba inventory. Do you need to place an order this week?`;

    if (lovableApiKey) {
      try {
        const aiRes = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            max_tokens: 200,
            messages: [
              {
                role: "system",
                content: `You write SHORT phone call scripts for GasMask — a grabba leaf and tobacco distribution company serving corner stores, bodegas, and smoke shops in the NY/NJ area.

The script is for a DISTRIBUTION REP calling a store owner about their grabba/tobacco inventory.

Write a 20-second natural script that:
- Opens with store name
- Mentions GasMask distribution
- States the call purpose: ${purposeDesc}
- Asks a yes/no question to engage
- Sounds like a real person, not a robot

Return ONLY the script text, nothing else.`,
              },
              {
                role: "user",
                content: `Store: ${store_name || "Unknown"}\nCity: ${city || "NY"}\nCall purpose: ${purpose}`,
              },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const generated = aiData.choices?.[0]?.message?.content?.trim();
          if (generated) scriptText = generated;
        }
      } catch (aiErr) {
        console.error("[GASMASK-CALLER] AI script gen failed, using default:", aiErr);
      }
    }

    // Use Twilio to make the call with TTS
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    let callSid = null;

    if (twilioSid && twilioToken && twilioPhone) {
      const twiml =
        `<?xml version="1.0"?>` +
        `<Response>` +
        `<Pause length="1"/>` +
        `<Say voice="Polly.Matthew">${scriptText.replace(/[<>&"']/g, "")}</Say>` +
        `<Pause length="2"/>` +
        `<Say voice="Polly.Matthew">Press 1 if you would like us to visit your store. Press 9 to be removed from our list.</Say>` +
        `<Gather numDigits="1" timeout="8"/>` +
        `<Say voice="Polly.Matthew">We didn't get a response. We'll try again later. Have a great day!</Say>` +
        `</Response>`;

      const callRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: store_phone,
            From: twilioPhone,
            Twiml: twiml,
          }).toString(),
        }
      );

      const callData = await callRes.json();
      callSid = callData.sid;

      if (!callRes.ok) {
        console.error("[GASMASK-CALLER] Twilio error:", callData);
        return new Response(
          JSON.stringify({ error: "Twilio call failed", details: callData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Log the call — real columns, real store linkage. The previous version
    // wrote to `phone_number` / `content`, which do not exist on
    // communication_logs, so every AI call insert failed silently.
    const { error: logErr } = await supabase.from("communication_logs").insert({
      direction: "outbound",
      channel: "call",
      call_type: "ai_outbound",
      ai_assisted: true,
      store_id: store_id || null,
      recipient_phone: store_phone,
      message_content: scriptText,
      summary: `AI call — ${purpose}`,
      status: "initiated",
      delivery_status: "initiated",
      started_at: new Date().toISOString(),
      twilio_call_sid: callSid || null,
      source_table: store_id ? "stores" : null,
      source_id: store_id || null,
      source_business: "gasmask",
      metadata: {
        source: "gasmask-ai-caller",
        store_name,
        call_purpose: purpose,
      },
    });
    if (logErr) console.error("[GASMASK-CALLER] log insert failed:", logErr);


    console.log(`[GASMASK-CALLER] Call initiated to ${store_name} (${store_phone}) purpose=${purpose}`);

    return new Response(
      JSON.stringify({
        success: true,
        call_sid: callSid,
        script: scriptText,
        store_name,
        purpose,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[GASMASK-CALLER] Error:", e.message);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
