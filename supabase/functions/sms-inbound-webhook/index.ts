import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "twilio";

    let fromNumber = "";
    let toNumber = "";
    let body = "";

    if (provider === "twilio") {
      // Twilio sends form-encoded POST
      const formData = await req.formData();
      fromNumber = (formData.get("From") as string) || "";
      toNumber = (formData.get("To") as string) || "";
      body = (formData.get("Body") as string) || "";
    } else {
      // BizText or generic JSON
      const json = await req.json();
      fromNumber = json.from || json.phone || json.From || "";
      toNumber = json.to || json.To || json.recipient || "";
      body = json.body || json.message || json.Body || json.txt || "";
    }

    const normalizedPhone = fromNumber.replace(/\D/g, "");
    const normalizedTo = toNumber.replace(/\D/g, "");
    const trimmedBody = body.trim();
    const upperBody = trimmedBody.toUpperCase();

    console.log(`📨 Inbound from ${normalizedPhone} to ${normalizedTo}: "${upperBody}" (provider: ${provider})`);

    // Resolve business/contact context so inbound SMS appears in /communication/inbox
    let businessId: string | null = null;
    if (normalizedTo) {
      const toLast10 = normalizedTo.slice(-10);
      const { data: phoneRoute } = await supabase
        .from("business_phone_numbers")
        .select("business_id")
        .or(`phone_number.ilike.%${toLast10}%`)
        .limit(1)
        .maybeSingle();
      businessId = phoneRoute?.business_id ?? null;
    }

    let matchedContact: { id: string; store_id: string | null } | null = null;
    if (normalizedPhone) {
      const fromLast10 = normalizedPhone.slice(-10);
      let peopleQuery = supabase
        .from("people")
        .select("id, store_id")
        .or(`phone.ilike.%${fromLast10}%`)
        .limit(1);

      if (businessId) peopleQuery = peopleQuery.eq("business_id", businessId);

      const { data: contact } = await peopleQuery.maybeSingle();
      matchedContact = contact || null;
    }

    const { error: inboundInsertError } = await supabase
      .from("communication_messages")
      .insert({
        direction: "inbound",
        channel: "sms",
        content: trimmedBody,
        phone_number: normalizedPhone || fromNumber,
        from_number: fromNumber || null,
        to_number: toNumber || null,
        status: "received",
        provider: provider === "twilio" ? "twilio" : "biztext",
        business_id: businessId,
        contact_id: matchedContact?.id ?? null,
        store_id: matchedContact?.store_id ?? null,
        ai_generated: false,
        metadata: {
          source: "sms-inbound-webhook",
          provider,
        },
      });

    if (inboundInsertError) {
      console.error("❌ Failed to log inbound communication_messages row:", inboundInsertError);
    }

    // ── PIPELINE EVENT INJECTION ──
    // Match to brandaro_qualified_leads by phone
    const fromLast10 = normalizedPhone.slice(-10);
    const { data: brandaroLead } = await supabase
      .from("brandaro_qualified_leads")
      .select("id")
      .or(`phone_number.ilike.%${fromLast10}%`)
      .limit(1)
      .maybeSingle();

    if (brandaroLead) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/brandaro-pipeline-automator`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            action: "record_event",
            lead_id: brandaroLead.id,
            event_type: "sms_reply",
            message_content: trimmedBody,
          }),
        });
        console.log(`✅ Pipeline event injected: sms_reply for lead ${brandaroLead.id}`);
      } catch (pipeErr: any) {
        console.error(`⚠️ Pipeline event failed, logging to failures:`, pipeErr.message);
        await supabase.from("brandaro_event_failures").insert({
          lead_id: brandaroLead.id,
          event_type: "sms_reply",
          message_content: trimmedBody,
          error_message: pipeErr.message,
        });
      }
    }

    // Check if STOP word
    if (STOP_WORDS.includes(upperBody)) {
      console.log(`🛑 STOP detected from ${normalizedPhone}`);

      // Upsert into opt_out_events
      const { error } = await supabase
        .from("opt_out_events")
        .upsert(
          {
            phone_number: normalizedPhone,
            source: provider,
            reason: `Inbound STOP: "${upperBody}"`,
          },
          { onConflict: "phone_number" }
        );

      if (error) {
        console.error("❌ Failed to insert opt_out_event:", error);
      } else {
        console.log(`✅ Opt-out recorded for ${normalizedPhone}`);
      }
    }

    // Return proper provider response
    if (provider === "twilio") {
      // TwiML response
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("❌ Inbound webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
