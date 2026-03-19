import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return "+" + digits;
}

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
      const formData = await req.formData();
      fromNumber = (formData.get("From") as string) || "";
      toNumber = (formData.get("To") as string) || "";
      body = (formData.get("Body") as string) || "";
    } else {
      const json = await req.json();
      fromNumber = json.from || json.phone || json.From || "";
      toNumber = json.to || json.To || json.recipient || "";
      body = json.body || json.message || json.Body || json.txt || "";
    }

    // FIX 1: Normalize phone numbers using E.164
    const normalizedFrom = normalizePhone(fromNumber);
    const normalizedTo = normalizePhone(toNumber);
    const trimmedBody = body.trim();
    const upperBody = trimmedBody.toUpperCase();

    console.log(`📨 Inbound from ${normalizedFrom} to ${normalizedTo}: "${upperBody}" (provider: ${provider})`);

    // Resolve business/contact context
    let businessId: string | null = null;
    if (normalizedTo) {
      const toLast10 = normalizedTo.replace(/\D/g, "").slice(-10);
      const { data: phoneRoute } = await supabase
        .from("business_phone_numbers")
        .select("business_id")
        .or(`phone_number.ilike.%${toLast10}%`)
        .limit(1)
        .maybeSingle();
      businessId = phoneRoute?.business_id ?? null;
    }

    let matchedContact: { id: string; store_id: string | null } | null = null;
    if (normalizedFrom) {
      const fromLast10 = normalizedFrom.replace(/\D/g, "").slice(-10);
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
        phone_number: normalizedFrom,
        from_number: fromNumber || null,
        to_number: toNumber || null,
        status: "received",
        provider: provider === "twilio" ? "twilio" : "biztext",
        business_id: businessId,
        contact_id: matchedContact?.id ?? null,
        store_id: matchedContact?.store_id ?? null,
        ai_generated: false,
        metadata: { source: "sms-inbound-webhook", provider },
      });

    if (inboundInsertError) {
      console.error("❌ Failed to log inbound communication_messages row:", inboundInsertError);
    }

    // ── FIX 1 + FIX 6: PIPELINE EVENT INJECTION WITH AI INTENT ──
    // Match to brandaro_qualified_leads by normalized E.164 phone
    const { data: brandaroLead } = await supabase
      .from("brandaro_qualified_leads")
      .select("id, pipeline_stage")
      .eq("phone_number", normalizedFrom)
      .limit(1)
      .maybeSingle();

    if (brandaroLead) {
      try {
        // FIX 6: Run intent classification via Claude AI
        const intentResult = await supabase.functions.invoke("intent-classifier", {
          body: {
            lead_id: brandaroLead.id,
            sms_text: trimmedBody,
            phone_number: normalizedFrom,
          },
        });

        const intentData = intentResult.data || {};
        const intent = intentData.intent || "neutral";
        const score = intentData.score || 5;

        // Map to event type based on AI classification
        let event_type = "sms_reply";
        if (intent === "positive" && score >= 7) {
          event_type = "interest_detected";
        } else if (intent === "negative") {
          event_type = "negative_response";
        }

        // Inject classified event into pipeline
        await fetch(`${supabaseUrl}/functions/v1/brandaro-pipeline-automator`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
          body: JSON.stringify({
            action: "record_event",
            lead_id: brandaroLead.id,
            event_type,
            message_content: trimmedBody,
          }),
        });

        console.log(`✅ AI-classified pipeline event: ${event_type} (intent=${intent}, score=${score}) for lead ${brandaroLead.id}`);

        // FIX 6: If they mention price/cost, auto-trigger objection handler
        const priceKeywords = ["how much", "cost", "price", "expensive", "afford"];
        const mentionsPrice = priceKeywords.some((kw) => trimmedBody.toLowerCase().includes(kw));

        if (mentionsPrice) {
          await supabase.functions.invoke("objection-handler", {
            body: {
              lead_id: brandaroLead.id,
              objection_text: trimmedBody,
              current_stage: brandaroLead.pipeline_stage,
            },
          });
          console.log(`💰 Price objection detected, objection-handler triggered for lead ${brandaroLead.id}`);
        }

        // Log inbound message to brandaro_call_logs
        await supabase.from("brandaro_call_logs").insert({
          lead_id: brandaroLead.id,
          call_outcome: `sms_inbound_${intent}`,
          call_notes: trimmedBody,
          phone_used: normalizedFrom,
          created_at: new Date().toISOString(),
        });
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
      console.log(`🛑 STOP detected from ${normalizedFrom}`);
      const { error } = await supabase
        .from("opt_out_events")
        .upsert(
          { phone_number: normalizedFrom, source: provider, reason: `Inbound STOP: "${upperBody}"` },
          { onConflict: "phone_number" }
        );
      if (error) console.error("❌ Failed to insert opt_out_event:", error);
      else console.log(`✅ Opt-out recorded for ${normalizedFrom}`);
    }

    // Return proper provider response
    if (provider === "twilio") {
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
