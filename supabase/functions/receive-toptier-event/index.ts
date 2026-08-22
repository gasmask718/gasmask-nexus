// receive-toptier-event
// Receives HMAC-signed event bookings from the TopTier platform
// (project hruhkyvwtfpfviwnvhne). TopTier charges the customer IN FULL on its
// own Stripe, then posts the UT-shaped payload here. Lands in
// ut_event_bookings (source='toptier') already confirmed + paid, settles
// immediately via the shared ut-ingest pipe.
//
// Auth mirrors onboard-transport-partner EXACTLY: HMAC-SHA256 hex over the
// raw body in `x-webhook-signature`, constant-time compare, FAIL-CLOSED.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendOpsAlert } from "../_shared/opsAlert.ts";
import { settleEventBooking } from "../_shared/settleEventBooking.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-webhook-signature, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expectedHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // constant-time compare
  if (expectedHex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  try {
    const bodyText = await req.text();
    const signature = req.headers.get("x-webhook-signature");

    if (!signature) return json({ ok: false, error: "missing signature" }, 401);

    const secret = Deno.env.get("TOPTIER_EVENT_WEBHOOK_SECRET");
    if (!secret) {
      console.error("TOPTIER_EVENT_WEBHOOK_SECRET not configured");
      return json({ ok: false, error: "server misconfigured" }, 500);
    }

    const valid = await verifyHmac(bodyText, signature, secret);
    if (!valid) return json({ ok: false, error: "invalid signature" }, 401);

    let parsed: any;
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return json({ ok: false, error: "invalid json" }, 400);
    }

    // Idempotency key = TopTier-side booking id
    const sourceBookingId = String(
      parsed?.toptier_booking_id ?? parsed?.source_booking_id ?? "",
    ).trim();
    if (!sourceBookingId) {
      return json({ ok: false, error: "missing toptier_booking_id" }, 400);
    }
    if (!parsed?.name || !parsed?.email || !parsed?.phone) {
      return json({ ok: false, error: "missing required fields: name, email, phone" }, 400);
    }

    const fullPrice = num(parsed.full_price) ?? 0;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const baseFields = {
      name: String(parsed.name),
      email: String(parsed.email),
      phone: String(parsed.phone),
      event_type: parsed.event_type ?? null,
      event_date: parsed.event_date ?? null,
      city: parsed.city ?? null,
      guest_count: num(parsed.guest_count),
      budget: num(parsed.budget),
      preferences: parsed.preferences ?? null,
      package_name: parsed.package_name ?? null,
      full_price: fullPrice,
      // Paid in full upfront on TopTier's Stripe:
      deposit_amount: fullPrice,
      deposit_paid: true,
      stripe_payment_intent_id: parsed.stripe_payment_intent_id ?? null,
      source: "toptier",
      source_booking_id: sourceBookingId,
      updated_at: new Date().toISOString(),
    };

    // Idempotent upsert keyed on the TopTier booking id
    const { data: existing } = await supabase
      .from("ut_event_bookings")
      .select("id, status")
      .eq("source_booking_id", sourceBookingId)
      .maybeSingle();

    let booking: any;
    let upserted: "inserted" | "updated";
    if (existing) {
      // Never regress a terminal status on a retry
      const keepStatus = ["completed", "cancelled"].includes(existing.status);
      const { data, error } = await supabase
        .from("ut_event_bookings")
        .update({ ...baseFields, ...(keepStatus ? {} : { status: "confirmed" }) })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        console.error("Update error:", error);
        return json({ ok: false, error: error.message }, 500);
      }
      booking = data;
      upserted = "updated";
    } else {
      const { data, error } = await supabase
        .from("ut_event_bookings")
        .insert({ ...baseFields, status: "confirmed" })
        .select()
        .single();
      if (error) {
        console.error("Insert error:", error);
        return json({ ok: false, error: error.message }, 500);
      }
      booking = data;
      upserted = "inserted";
    }

    // Same ops alert shape as receive-event-booking so UT staff see it
    try {
      await sendOpsAlert({
        source: "receive-toptier-event",
        severity: "warn",
        subject: `TopTier event booking — ${parsed.name} (PAID)`,
        message: `💰 TOPTIER EVENT BOOKING (PAID IN FULL)\nEvent: ${parsed.event_type || "N/A"}\nDate: ${parsed.event_date || "TBD"}\nCity: ${parsed.city || "N/A"}\nGuests: ${parsed.guest_count || "N/A"}\nPackage: ${parsed.package_name || "Custom"}\nPaid: $${fullPrice}\nName: ${parsed.name}\nPhone: ${parsed.phone}\nEmail: ${parsed.email}\nTopTier ref: ${sourceBookingId}`,
        context: { booking_id: booking?.id, source_booking_id: sourceBookingId },
      });
    } catch (alertErr) {
      console.error("Ops alert failed (non-blocking):", alertErr);
    }

    // Close the settlement loop immediately (dedupe-safe via ut-ingest)
    const settlement = await settleEventBooking(booking);
    if (!settlement.settled) {
      console.error("Settlement failed for TopTier booking", sourceBookingId, settlement.error ?? settlement.skipped);
    }

    return json({
      ok: true,
      id: booking?.id,
      upserted,
      settlement,
    });
  } catch (err: any) {
    console.error("Edge function error:", err);
    return json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});
