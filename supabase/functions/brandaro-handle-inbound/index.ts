import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyTwilio } from "../_shared/dialer.ts";
import { verifiedInsertSoft } from "../_shared/verifiedWrite.ts";
import { sendSms, smsContentHash } from "../_shared/sendSms.ts";

// Auto-replies route through send-sms (conversational class): suppression,
// idempotency, and an outbound_messages row. An inbound text from someone
// who previously sent STOP does NOT re-consent them — if send-sms blocks the
// reply we record the suppressed outcome in brandaro_message_log and the
// inbound message still lands in brandaro_inbound_messages for a human.
// (Whether an inbound text legally re-opens SMS contact is a legal question,
// not a technical one — the code takes the conservative answer.)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STOP_RE = /^\s*(STOP|STOPALL|UNSUBSCRIBE|QUIT|CANCEL|END|REMOVE)\b/i;

/**
 * brandaro-handle-inbound
 * 
 * Receives inbound SMS/email replies from leads.
 * Detects intent and either auto-responds via AI or routes to VA queue.
 * 
 * Endpoints:
 *   - POST with JSON body: manual submission
 *   - POST with form data: Twilio webhook (signature verified)
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle both JSON and form-encoded (Twilio webhook)
    const contentType = req.headers.get("content-type") || "";
    let messageText = "";
    let senderPhone = "";
    let channel = "sms";
    let isTwilioForm = false;
    let inboundSid = "";
    let receivingNumber = ""; // the brandaro number they texted — reply sender

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Twilio webhook format
      isTwilioForm = true;
      const formData = await req.formData();
      const sigParams: Record<string, string> = {};
      formData.forEach((v, k) => (sigParams[k] = String(v)));

      // ── Signature verification ──
      const v = verifyTwilio(req, sigParams);
      if (!v.ok) {
        console.error(`[brandaro-handle-inbound] signature invalid: ${v.reason}`);
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }

      // ── SYNTHETIC PROBE SHORT-CIRCUIT ──
      // comms-health-monitor sends signed probes with MessageSid prefixed
      // "SMhealth" and From=+15005550006. ACK without writing opt_out_events
      // or sending SMS.
      const probeSid = sigParams.MessageSid || "";
      const probeFrom = sigParams.From || "";
      if (probeSid.startsWith("SMhealth") && probeFrom === "+15005550006") {
        console.log(`[brandaro-handle-inbound] synthetic probe ack sid=${probeSid}`);
        return new Response(
          JSON.stringify({ success: true, synthetic: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      messageText = sigParams.Body || "";
      senderPhone = sigParams.From || "";
      inboundSid = sigParams.MessageSid || "";
      receivingNumber = sigParams.To || "";
      channel = "sms";
    } else {
      const body = await req.json();
      if (body.dry_run) {
        return new Response(JSON.stringify({ ok: true, dry_run: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      messageText = body.message || body.Body || "";
      senderPhone = body.sender_phone || body.From || "";
      receivingNumber = body.To || body.to_number || "";
      channel = body.channel || "sms";
    }

    if (!messageText) {
      return new Response(JSON.stringify({ error: "No message content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── 1. Match sender to a lead ──────────────────────────────
    const normalizedPhone = normalizePhone(senderPhone);

    // ─── 1a. STOP / opt-out enforcement (CTIA-compliant) ────────
    if (STOP_RE.test(messageText.trim())) {
      console.log(`[brandaro-handle-inbound] 🛑 STOP from ${normalizedPhone}`);
      const optOut = await verifiedInsertSoft(supabase, 'record SMS opt-out', (c: any) =>
        c.from("opt_out_events").upsert(
          { phone_number: normalizedPhone, source: "brandaro_inbound", reason: `Inbound STOP: "${messageText.trim().slice(0, 80)}"` },
          { onConflict: "phone_number" },
        ),
      );
      if (!optOut.ok) {
        console.error(`[brandaro-handle-inbound] 🛑 COMPLIANCE: opt-out NOT recorded for ${normalizedPhone}: ${optOut.error}`);
      }
      await supabase
        .from("brandaro_qualified_leads")
        .update({ ai_paused: true, pipeline_stage: "lost", lead_status: "not_interested", updated_at: new Date().toISOString() })
        .or(`phone.eq.${normalizedPhone},phone.eq.${senderPhone},phone_number.eq.${normalizedPhone}`);
      return new Response(
        isTwilioForm
          ? `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`
          : JSON.stringify({ ok: true, opted_out: true }),
        { status: 200, headers: isTwilioForm ? { "Content-Type": "text/xml", ...corsHeaders } : { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: lead } = await supabase
      .from("brandaro_qualified_leads")
      .select("id, business_name, status, phone, email")
      .or(`phone.eq.${normalizedPhone},phone.eq.${senderPhone}`)
      .limit(1)
      .single();

    // ─── 2. Detect intent ───────────────────────────────────────
    const intent = detectIntent(messageText);

    // ─── 3. Determine if AI can auto-respond ────────────────────
    const autoRespondable = ["interested", "ready_to_buy", "question_simple"].includes(intent);
    const requiresVa = ["objection", "question_complex", "complaint", "unknown"].includes(intent);

    let aiResponse: string | null = null;
    let autoReplySent = false;

    if (autoRespondable) {
      aiResponse = await generateAutoResponse(intent, messageText, lead?.business_name);

      // Send auto-response via send-sms (conversational). A blocked result
      // means the sender previously STOPped: honour it, record the suppressed
      // outcome, and leave the inbound for a human — an inbound text is NOT
      // treated as re-consent (flagged as a legal question in the doc).
      if (senderPhone && aiResponse) {
        const reply = await sendAutoReply(
          normalizedPhone,
          aiResponse,
          receivingNumber,
          inboundSid || `manual-${await smsContentHash(`${normalizedPhone}|${messageText}`)}`,
        );
        autoReplySent = reply.sent;
        if (reply.blocked) {
          console.warn(`[brandaro-handle-inbound] auto-reply SUPPRESSED for ${normalizedPhone}: ${reply.reason}`);
          try {
            await supabase.from("brandaro_message_log").insert({
              lead_id: lead?.id || null,
              channel: "sms",
              provider: "twilio",
              destination: normalizedPhone,
              message_body: aiResponse,
              send_status: "suppressed",
              sent_at: null,
            });
          } catch (e) {
            console.error("[brandaro-handle-inbound] suppressed-outcome log failed:", (e as Error).message);
          }
        } else if (!reply.sent) {
          console.error(`[brandaro-handle-inbound] auto-reply failed: ${reply.reason}`);
        }
      }
    }

    // ─── 4. Log inbound message ─────────────────────────────────
    const { data: inbound, error: insertErr } = await supabase
      .from("brandaro_inbound_messages")
      .insert({
        lead_id: lead?.id || null,
        message: messageText,
        channel,
        sender_phone: senderPhone,
        intent_detected: intent,
        requires_va: requiresVa,
        ai_auto_responded: autoReplySent,
        ai_response: aiResponse,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // ─── 5. Update follow-up if reply matches ───────────────────
    if (lead?.id) {
      // Mark the most recent follow-up as replied
      await supabase
        .from("brandaro_followup_sequences")
        .update({ reply_received: true, status: "replied" })
        .eq("lead_id", lead.id)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1);

      // If ready to buy, advance pipeline
      if (intent === "ready_to_buy") {
        await supabase.from("brandaro_close_pipeline").update({
          stage: "negotiating",
          urgency_level: "critical",
          priority_score: 99,
        }).eq("lead_id", lead.id);
      }

      // If interested, advance to interested stage
      if (intent === "interested") {
        const { data: existing } = await supabase
          .from("brandaro_close_pipeline")
          .select("stage")
          .eq("lead_id", lead.id)
          .single();

        if (existing && ["demo_sent", "demo_viewed"].includes(existing.stage)) {
          await supabase.from("brandaro_close_pipeline").update({
            stage: "interested",
            interested_at: new Date().toISOString(),
            priority_score: 85,
          }).eq("lead_id", lead.id);
        }
      }
    }

    // For Twilio webhook, return EMPTY TwiML. The reply already went (or was
    // deliberately suppressed) through send-sms above — a TwiML <Message>
    // here would bypass the suppression gate and double-send.
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
        headers: { ...corsHeaders, "Content-Type": "text/xml" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      inbound_id: inbound.id,
      intent_detected: intent,
      auto_responded: autoReplySent,
      requires_va: requiresVa,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("brandaro-handle-inbound error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── INTENT DETECTION ─────────────────────────────────────────────────

function detectIntent(text: string): string {
  const lower = text.toLowerCase().trim();

  // Ready to buy signals
  if (/yes|let'?s do it|sign me up|i'?m in|ready|let'?s go|how do i pay|send.*link|i want it/i.test(lower)) {
    return "ready_to_buy";
  }

  // Interested signals
  if (/looks good|nice|love it|interested|tell me more|cool|awesome|great|impressive/i.test(lower)) {
    return "interested";
  }

  // Simple questions AI can handle
  if (/how much|what.*cost|price|what.*include|how long|when|timeline/i.test(lower)) {
    return "question_simple";
  }

  // Complex questions needing VA
  if (/custom|specific|particular|my.*situation|different|change|modify|edit/i.test(lower)) {
    return "question_complex";
  }

  // Objections
  if (/not interested|no thanks|stop|remove|unsubscribe|too expensive|already have|don'?t need/i.test(lower)) {
    return "objection";
  }

  // Complaints
  if (/spam|report|lawyer|sue|harass|annoying|stop texting/i.test(lower)) {
    return "complaint";
  }

  return "unknown";
}

// ─── AUTO RESPONSE GENERATION ─────────────────────────────────────────

async function generateAutoResponse(intent: string, message: string, businessName?: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  // If AI available, generate contextual response
  if (LOVABLE_API_KEY) {
    try {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You are a friendly sales assistant for Brandaro. You're texting a lead who replied to a follow-up about their custom website demo. Keep responses SHORT (1-2 sentences), natural, and push toward next step. Business: ${businessName || "their business"}.`
            },
            { role: "user", content: `Lead replied: "${message}"\nIntent: ${intent}\nRespond naturally:` }
          ],
          max_tokens: 100,
        }),
      });

      if (aiResponse.ok) {
        const data = await aiResponse.json();
        return data.choices?.[0]?.message?.content?.trim() || getFallbackResponse(intent, businessName);
      }
    } catch (e) {
      console.error("AI auto-response failed:", e);
    }
  }

  return getFallbackResponse(intent, businessName);
}

function getFallbackResponse(intent: string, businessName?: string): string {
  const name = businessName || "your business";
  
  switch (intent) {
    case "ready_to_buy":
      return `Awesome! Let me get everything set up for ${name}. Someone from our team will reach out shortly with next steps! 🚀`;
    case "interested":
      return `Glad you liked it! Want me to walk you through the details? I can hop on a quick call whenever works for you.`;
    case "question_simple":
      return `Great question! Our packages start at $750 for a full custom site. Includes design, hosting, and support. Want the full breakdown?`;
    default:
      return `Thanks for getting back to us! Let me connect you with someone who can help. We'll be in touch shortly.`;
  }
}

// ─── SMS SEND ─────────────────────────────────────────────────────────
// Routes through send-sms (conversational). Sender parity: the number the
// lead actually texted, falling back to TWILIO_PHONE_NUMBER (the previous
// helper's sender). Never throws — the webhook must always answer Twilio.

async function sendAutoReply(
  to: string,
  body: string,
  receivingNumber: string,
  dedupeId: string,
): Promise<{ sent: boolean; blocked: boolean; reason: string | null }> {
  const res = await sendSms({
    to,
    from: receivingNumber || Deno.env.get("TWILIO_PHONE_NUMBER"),
    body,
    sendClass: "conversational",
    idempotencyKey: `brandaro-ar-${dedupeId}`,
    skipCooldown: true, // one inbound text = one reply
    purpose: "brandaro_inbound_autoreply",
  });
  return { sent: res.success, blocked: res.blocked, reason: res.errorMessage };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
