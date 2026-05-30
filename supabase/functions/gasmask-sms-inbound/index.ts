import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits[0] === "1") return "+" + digits;
  return "+" + digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Parse body — support form-encoded (Twilio) and JSON
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string> = {};

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => (body[k] = v));
    } else {
      body = await req.json().catch(() => ({}));
    }

    const fromNumber = body.From || body.from_number || "";
    const toNumber = body.To || body.to_number || "";
    const messageBody = body.Body || body.message || "";
    const messageSid = body.MessageSid || body.message_sid || `gm-inbound-${Date.now()}`;

    if (!fromNumber || !messageBody) {
      return new Response('<?xml version="1.0"?><Response/>', {
        headers: { "Content-Type": "text/xml" },
      });
    }

    const normalizedFrom = normalizePhone(fromNumber);
    const last10 = normalizedFrom.replace(/\D/g, "").slice(-10);

    // Find matching GasMask store by phone
    const { data: store } = await supabase
      .from("stores")
      .select("*")
      .ilike("phone", `%${last10}`)
      .limit(1)
      .maybeSingle();

    // Log to communication_messages (GasMask's messaging table)
    await supabase.from("communication_messages").insert({
      direction: "inbound",
      channel: "sms",
      content: messageBody.trim(),
      phone_number: normalizedFrom,
      from_number: normalizedFrom,
      to_number: toNumber,
      status: "received",
      provider: "twilio",
      metadata: {
        store_id: store?.id,
        store_name: store?.name,
        message_sid: messageSid,
        source: "gasmask_inbound",
      },
    });

    // If it's a known store and message shows interest, create visit trigger
    if (store) {
      const body_lower = messageBody.toLowerCase();
      const isInterested = [
        "yes", "interested", "sure", "ok", "need", "order", "send",
        "when", "how much", "come by", "stop by",
      ].some((kw) => body_lower.includes(kw));

      if (isInterested) {
        // Check for duplicate pending trigger
        const { data: existing } = await supabase
          .from("gasmask_visit_triggers")
          .select("id")
          .eq("store_name", store.name)
          .eq("trigger_type", "follow_up")
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();

        if (!existing) {
          await supabase.from("gasmask_visit_triggers").insert({
            store_id: store.id,
            store_name: store.name,
            store_city: store.address_city,
            store_state: store.address_state,
            store_phone: store.phone,
            store_address: store.address_street,
            trigger_source: "GasMask Inbound SMS",
            trigger_type: "follow_up",
            floor_source: "floor3_comms",
            urgency: "high",
            priority_score: 8,
            trigger_notes: `Store replied interested: "${messageBody.substring(0, 200)}"`,
            source_record_id: store.id,
            source_record_type: "store",
            status: "pending",
          });
        }
      }
    }

    console.log(`[GASMASK-SMS] Inbound from ${normalizedFrom} store=${store?.name || "unknown"}`);

    // Return TwiML empty response
    return new Response('<?xml version="1.0"?><Response/>', {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e: any) {
    console.error("[GASMASK-SMS] Error:", e.message);
    return new Response('<?xml version="1.0"?><Response/>', {
      headers: { "Content-Type": "text/xml" },
    });
  }
});
