import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTwilio } from "../_shared/dialer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    // Parse body - support both form-encoded (Twilio) and JSON
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};
    let isTwilioForm = false;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      isTwilioForm = true;
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => (body[k] = v));
    } else if (contentType.includes("multipart/form-data")) {
      try {
        isTwilioForm = true;
        const formData = await req.formData();
        formData.forEach((v, k) => (body[k] = String(v)));
      } catch {
        isTwilioForm = false;
        body = await req.json().catch(() => ({}));
      }
    } else {
      body = await req.json().catch(() => ({}));
    }

    // ── Signature verification (only for Twilio form-encoded webhook hits;
    //     JSON callers must use the service role authorization). ──
    if (isTwilioForm) {
      const v = verifyTwilio(req, body);
      if (!v.ok) {
        console.error(`[sms-inbound-webhook] signature invalid: ${v.reason}`);
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
    }

    const fromNumber = body.From || body.from || body.from_number || "";
    const toNumber = body.To || body.to || body.to_number || "";
    const messageBody = body.Body || body.body || body.message || "";
    const messageSid = body.MessageSid || body.message_sid || `inbound-${Date.now()}`;

    console.log(`📨 [INBOUND] from=${fromNumber} to=${toNumber} body="${messageBody}" sid=${messageSid}`);

    if (!fromNumber || !messageBody) {
      return new Response(
        JSON.stringify({ error: "Missing from or body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedFrom = normalizePhone(fromNumber);
    const trimmedBody = messageBody.trim();
    const upperBody = trimmedBody.toUpperCase();

    // ── Check if sender is a GasMask store first ──
    const fromLast10 = normalizedFrom.replace(/\D/g, "").slice(-10);
    const { data: gasmaskStore } = await supabase
      .from("stores")
      .select("id, name")
      .ilike("phone", `%${fromLast10}`)
      .limit(1)
      .maybeSingle();

    if (gasmaskStore) {
      // Route to GasMask handler — this is a store owner, not a Brandaro lead
      console.log(`📨 [INBOUND] GasMask store detected: ${gasmaskStore.name}, routing to gasmask-sms-inbound`);
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      await fetch(`${supabaseUrl}/functions/v1/gasmask-sms-inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify(body),
      });
      return new Response('<?xml version="1.0"?><Response/>', {
        headers: { "Content-Type": "text/xml" },
      });
    }

    // ── Find Brandaro lead by phone number (try multiple formats) ──
    const { data: leads } = await supabase
      .from("brandaro_qualified_leads")
      .select("*")
      .or(
        `phone_number.eq.${normalizedFrom},phone_number.eq.${fromNumber},phone_number.ilike.%${fromLast10}`
      )
      .limit(5);

    console.log(`📨 [INBOUND] Brandaro leads found: ${leads?.length || 0}`);

    let lead = leads?.[0] || null;

    // If no lead found, create one
    if (!lead) {
      console.log(`📨 [INBOUND] Unknown number ${normalizedFrom}, creating new lead`);
      const { data: newLead } = await supabase
        .from("brandaro_qualified_leads")
        .insert({
          business_name: `Unknown (${normalizedFrom})`,
          phone_number: normalizedFrom,
          pipeline_stage: "responded",
          lead_status: "interested",
          priority_score: 7,
          engagement_score: 20,
          call_attempts: 0,
          has_website: false,
          website_status: "unknown",
          ai_paused: false,
          converted: false,
          city: "Unknown",
          industry: "unknown",
        })
        .select()
        .single();
      lead = newLead;
    }

    if (!lead) {
      return new Response(
        JSON.stringify({ error: "Could not find or create lead" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Save inbound message to conversation log ──
    await supabase
      .from("brandaro_conversations")
      .insert({
        lead_id: lead.id,
        direction: "inbound",
        message_body: trimmedBody,
        message_text: trimmedBody,
        from_number: normalizedFrom,
        to_number: toNumber,
        twilio_message_sid: messageSid,
        status: "received",
      })
      .then(({ error }) => {
        if (error) console.warn("📨 [INBOUND] Conversation log error:", error.message);
      });

    // ── Update lead's last reply info ──
    await supabase
      .from("brandaro_qualified_leads")
      .update({
        last_reply_at: new Date().toISOString(),
        last_reply_text: trimmedBody.substring(0, 500),
        engagement_score: Math.min(100, (lead.engagement_score || 0) + 25),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    // ── Handle STOP requests immediately ──
    if (STOP_WORDS.includes(upperBody)) {
      console.log(`🛑 STOP detected from ${normalizedFrom}`);

      await supabase
        .from("brandaro_qualified_leads")
        .update({
          ai_paused: true,
          pipeline_stage: "lost",
          lead_status: "not_interested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      // Also record opt-out
      await supabase
        .from("opt_out_events")
        .upsert(
          { phone_number: normalizedFrom, source: "twilio", reason: `Inbound STOP: "${upperBody}"` },
          { onConflict: "phone_number" }
        )
        .then(({ error }) => {
          if (error) console.warn("opt_out upsert error:", error.message);
        });

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
        { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } }
      );
    }

    // ── Run intent classification ──
    let intent = "neutral";
    let intentScore = 5;
    let suggestedStage = lead.pipeline_stage;
    let intentReason = "";

    try {
      const intentResult = await supabase.functions.invoke("intent-classifier", {
        body: {
          lead_id: lead.id,
          sms_text: trimmedBody,
          phone_number: normalizedFrom,
        },
      });

      const intentData = intentResult.data || {};
      intent = intentData.intent || "neutral";
      intentScore = intentData.score || 5;
      suggestedStage = intentData.suggested_stage || lead.pipeline_stage;
      intentReason = intentData.reason || "";

      console.log(`📨 [INBOUND] Intent: ${intent}, score: ${intentScore}, suggested: ${suggestedStage}`);
    } catch (intentErr: any) {
      console.error("📨 [INBOUND] Intent classification error:", intentErr.message);
    }

    // ── Update pipeline stage ──
    const stageOrder = ["new", "contacted", "responded", "interested", "booked", "closed"];
    const currentIdx = stageOrder.indexOf(lead.pipeline_stage);
    const newIdx = stageOrder.indexOf(suggestedStage);

    // Always move to at least 'responded' when they reply
    if (
      newIdx > currentIdx ||
      lead.pipeline_stage === "new" ||
      lead.pipeline_stage === "contacted"
    ) {
      const finalStage = newIdx > currentIdx ? suggestedStage : "responded";

      await supabase
        .from("brandaro_qualified_leads")
        .update({
          pipeline_stage: finalStage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", lead.id);

      console.log(`📨 [INBOUND] Stage: ${lead.pipeline_stage} → ${finalStage}`);

      // Fire pipeline event
      await fetch(`${supabaseUrl}/functions/v1/brandaro-pipeline-automator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          action: "record_event",
          lead_id: lead.id,
          event_type: "sms_reply",
          message_content: trimmedBody,
        }),
      }).catch((e) => console.warn("📨 [INBOUND] Pipeline event error:", e.message));
    }

    // ── Save intent classification result ──
    await supabase
      .from("brandaro_intent_log")
      .insert({
        lead_id: lead.id,
        message_text: trimmedBody,
        intent,
        intent_score: intentScore,
        suggested_stage: suggestedStage,
        reason: intentReason,
      })
      .then(({ error }) => {
        if (error) console.warn("📨 [INBOUND] Intent log error:", error.message);
      });

    // ── Also log to communication_messages for unified inbox ──
    await supabase
      .from("communication_messages")
      .insert({
        direction: "inbound",
        channel: "sms",
        content: trimmedBody,
        phone_number: normalizedFrom,
        from_number: fromNumber || null,
        to_number: toNumber || null,
        status: "delivered",
        provider: "twilio",
        ai_generated: false,
        metadata: { source: "sms-inbound-webhook", messageSid },
      })
      .then(({ error }) => {
        if (error) console.warn("📨 [INBOUND] communication_messages log error:", error.message);
      });

    // ── Queue AI response if interested and AI not paused ──
    if (
      ["interested", "question", "positive", "booking"].includes(intent) &&
      !lead.ai_paused
    ) {
      await supabase.functions
        .invoke("sms-writer", {
          body: {
            lead_id: lead.id,
            business_name: lead.business_name,
            city: lead.city,
            industry: lead.industry,
            call_attempts: lead.call_attempts,
            context: `Lead replied: "${trimmedBody}". Intent: ${intent}. Write a follow-up response.`,
          },
        })
        .catch((e: any) => console.warn("📨 [INBOUND] SMS writer error:", e.message));
    }

    // ── Price objection detection ──
    const priceKeywords = ["how much", "cost", "price", "expensive", "afford"];
    if (priceKeywords.some((kw) => trimmedBody.toLowerCase().includes(kw))) {
      await supabase.functions
        .invoke("objection-handler", {
          body: {
            lead_id: lead.id,
            objection_text: trimmedBody,
            current_stage: lead.pipeline_stage,
          },
        })
        .catch((e: any) => console.warn("📨 [INBOUND] Objection handler error:", e.message));
    }

    // Return TwiML (empty = no auto-reply, approval drawer handles it)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("❌ [INBOUND] Fatal:", error.message);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml", ...corsHeaders } }
    );
  }
});
