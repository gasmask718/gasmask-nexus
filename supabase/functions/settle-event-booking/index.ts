// settle-event-booking
// Admin/owner-only settlement trigger for UT-origin event bookings.
// Called from UTEventBookings when a booking flips to 'confirmed' or
// 'completed' with deposit_paid=true. Settles through the shared
// settleEventBooking helper -> ut-ingest (dedupe on deterministic
// transaction_id prevents double-posts).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { settleEventBooking } from "../_shared/settleEventBooking.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate the caller's JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401);

    // Admin/owner gate
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "owner");
    if (!allowed) return json({ ok: false, error: "forbidden" }, 403);

    const body = await req.json().catch(() => null);
    const bookingId = String(body?.booking_id ?? "").trim();
    if (!bookingId) return json({ ok: false, error: "missing booking_id" }, 400);

    const { data: booking, error: fetchErr } = await supabase
      .from("ut_event_bookings")
      .select("*")
      .eq("id", bookingId)
      .maybeSingle();
    if (fetchErr) return json({ ok: false, error: fetchErr.message }, 500);
    if (!booking) return json({ ok: false, error: "booking not found" }, 404);

    if (!["confirmed", "completed"].includes(booking.status)) {
      return json({ ok: false, error: `status '${booking.status}' is not settleable` }, 400);
    }
    if (!booking.deposit_paid) {
      return json({ ok: false, error: "deposit_not_paid" }, 400);
    }

    const settlement = await settleEventBooking(booking);
    if (!settlement.settled) {
      return json({ ok: false, error: settlement.error ?? settlement.skipped }, 502);
    }
    return json({ ok: true, settlement });
  } catch (err: any) {
    console.error("settle-event-booking error:", err);
    return json({ ok: false, error: String(err?.message ?? err) }, 500);
  }
});
