// Sends 24h + 2h SMS reminders for confirmed tt_bookings.
// Runs every 15 minutes via pg_cron. Respects opt_out_events,
// uses shared SMS template library, idempotent via
// reminder_24h_sent_at / reminder_2h_sent_at columns.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { SMS_TEMPLATES } from "../_shared/smsTemplates.ts";

const SERVICE_LABELS: Record<string, string> = {
  black_truck: "Black Truck Chauffeur",
  sprinter: "Sprinter Van",
  private_jet: "Private Jet",
  helicopter: "Helicopter",
  yacht: "Yacht Charter",
  party_bus: "Party Bus",
  exotic_cars: "Exotic Car",
  hotel_stay: "Hotel Stay",
  club_reservation: "Club Reservation",
  luxury_transport: "Luxury Transport",
};

function formatService(svc?: string, fallback?: string): string {
  if (!svc) return fallback || "booking";
  return SERVICE_LABELS[svc] || (fallback ?? svc.replace(/_/g, " "));
}

function fmtFull(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "long", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function fmtShort(dt: string) {
  return new Date(dt).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = Date.now();
    const in24h = new Date(now + 24 * 3600_000).toISOString();
    const in25h = new Date(now + 25 * 3600_000).toISOString();
    const in2h  = new Date(now + 2  * 3600_000).toISOString();
    const in3h  = new Date(now + 3  * 3600_000).toISOString();

    async function isOptedOut(phone?: string | null) {
      if (!phone) return true;
      const { data } = await supabase
        .from("opt_out_events")
        .select("id")
        .eq("phone_number", phone)
        .limit(1)
        .maybeSingle();
      return !!data;
    }

    async function processWindow(
      kind: "24h" | "2h",
      from: string,
      to: string,
      stampCol: "reminder_24h_sent_at" | "reminder_2h_sent_at"
    ) {
      const { data: rows, error } = await supabase
        .from("tt_bookings")
        .select("id, client_phone, service_type, service_name, scheduled_at, pickup_location, booking_reference")
        .eq("status", "confirmed")
        .gte("scheduled_at", from)
        .lt("scheduled_at", to)
        .is(stampCol, null);
      if (error) throw error;

      const results: any[] = [];
      for (const b of rows ?? []) {
        if (!b.client_phone || !b.scheduled_at) {
          results.push({ booking_id: b.id, status: "skipped_missing_data" });
          continue;
        }
        if (await isOptedOut(b.client_phone)) {
          await supabase.from("tt_bookings").update({ [stampCol]: new Date().toISOString() }).eq("id", b.id);
          results.push({ booking_id: b.id, status: "skipped_opt_out" });
          continue;
        }

        const serviceName = formatService(b.service_type, b.service_name);
        const body = kind === "24h"
          ? SMS_TEMPLATES.booking_reminder_24h({
              service_name: serviceName,
              scheduled_time: fmtFull(b.scheduled_at),
              pickup_location: b.pickup_location ?? undefined,
            })
          : SMS_TEMPLATES.booking_reminder_2h({
              service_name: serviceName,
              scheduled_time: fmtShort(b.scheduled_at),
              verification_code: b.booking_reference ?? undefined,
            });

        try {
          const resp = await supabase.functions.invoke("send-sms", {
            body: { to: b.client_phone, body },
          });
          if (resp.error) throw new Error(resp.error.message);
          await supabase.from("tt_bookings")
            .update({ [stampCol]: new Date().toISOString() })
            .eq("id", b.id);
          results.push({ booking_id: b.id, status: "sent" });
        } catch (err: any) {
          results.push({ booking_id: b.id, status: "failed", error: err?.message });
        }
      }
      return results;
    }

    const reminders_24h = await processWindow("24h", in24h, in25h, "reminder_24h_sent_at");
    const reminders_2h  = await processWindow("2h",  in2h,  in3h,  "reminder_2h_sent_at");

    return new Response(JSON.stringify({ ok: true, reminders_24h, reminders_2h }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-booking-reminders] error", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
