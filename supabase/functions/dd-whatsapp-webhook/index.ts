// Dynasty Direct — Twilio WhatsApp inbound webhook.
// Suppliers reply "DONE 1Z999AA10123456784" (or "SHIPPED ...") to mark a PO shipped.
// Posts back to Twilio as TwiML so the supplier sees an ack.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function twiml(message: string) {
  const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`,
    { status: 200, headers: { ...corsHeaders, "Content-Type": "text/xml" } },
  );
}

function detectCarrier(t: string): string | null {
  const s = t.toUpperCase();
  if (/^1Z[0-9A-Z]{16}$/.test(s)) return "UPS";
  if (/^(\d{12}|\d{15}|\d{20})$/.test(s)) return "FedEx";
  if (/^(94|93|92|95|96)\d{20}$/.test(s)) return "USPS";
  if (/^\d{10}$/.test(s)) return "DHL";
  return null;
}

function buildTrackingUrl(carrier: string | null, tracking: string): string {
  const c = (carrier ?? "").toUpperCase();
  const t = encodeURIComponent(tracking);
  switch (c) {
    case "UPS": return `https://www.ups.com/track?tracknum=${t}`;
    case "FEDEX": return `https://www.fedex.com/tracking?trackingnum=${t}`;
    case "USPS": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
    case "DHL": return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${t}`;
    case "AMAZON": return `https://track.amazon.com/tracking/${t}`;
    default: return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Twilio posts application/x-www-form-urlencoded
    const ct = req.headers.get("content-type") || "";
    let from = ""; let body = "";
    if (ct.includes("application/json")) {
      const j = await req.json();
      from = String(j.From ?? j.from ?? "");
      body = String(j.Body ?? j.body ?? "");
    } else {
      const form = await req.formData();
      from = String(form.get("From") ?? "");
      body = String(form.get("Body") ?? "");
    }

    const text = (body ?? "").trim();
    if (!text) return twiml("Empty message received.");

    const upper = text.toUpperCase();
    const isShipped = upper.startsWith("DONE") || upper.startsWith("SHIPPED");
    if (!isShipped) {
      return twiml("Thanks — your message was received. Reply 'DONE <tracking#>' when shipped.");
    }

    // Extract tracking token: everything after first word, take first non-space chunk.
    const remainder = text.replace(/^(DONE|SHIPPED)[:\s-]*/i, "").trim();
    const tracking = (remainder.split(/\s+/)[0] ?? "").trim();
    if (!tracking) {
      return twiml("Got DONE but no tracking number. Reply: DONE 1Z999AA10123456784");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve wholesaler by whatsapp From (strip 'whatsapp:' prefix)
    const cleanFrom = from.replace(/^whatsapp:/i, "").trim();
    const { data: wh } = await supabase
      .from("wholesalers")
      .select("id, name, whatsapp")
      .or(`whatsapp.eq.${cleanFrom},whatsapp.eq.${from}`)
      .maybeSingle();

    if (!wh) {
      console.warn("[dd-whatsapp-webhook] no wholesaler match for", from);
      return twiml("Sender not recognized. Contact Dynasty Direct ops.");
    }

    // Find newest open PO for this wholesaler
    const { data: po } = await supabase
      .from("dd_purchase_orders")
      .select("id, po_number, marketplace_order_id, status")
      .eq("wholesaler_id", wh.id)
      .in("status", ["sent", "acknowledged", "processing", "draft"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!po) {
      return twiml(`No open PO found for ${wh.name}. Reply ignored.`);
    }

    const carrier = detectCarrier(tracking);
    const tracking_url = buildTrackingUrl(carrier, tracking);

    const { error: upErr } = await supabase
      .from("dd_purchase_orders")
      .update({
        tracking_number: tracking,
        carrier: carrier ?? null,
        status: "shipped",
        actual_ship_date: new Date().toISOString(),
      } as never)
      .eq("id", po.id);
    if (upErr) {
      console.error("[dd-whatsapp-webhook] PO update failed", upErr);
      return twiml("Error updating PO. Dynasty Direct ops has been notified.");
    }

    // Notify customer (non-blocking)
    if (po.marketplace_order_id) {
      await supabase.functions
        .invoke("dd-notify-customer-order-update", {
          body: {
            order_id: po.marketplace_order_id,
            event_type: "shipped",
            tracking_number: tracking,
            carrier,
            tracking_url,
          },
        })
        .catch((e) => console.error("[dd-whatsapp-webhook] customer notify failed", e));
    }

    return twiml(
      `Thanks! PO ${po.po_number} marked SHIPPED with tracking ${tracking}${carrier ? ` (${carrier})` : ""}. Customer notified.`,
    );
  } catch (e) {
    console.error("[dd-whatsapp-webhook] fatal", e);
    return twiml("System error. Dynasty Direct ops will follow up.");
  }
});
