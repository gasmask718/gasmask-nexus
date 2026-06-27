// generate-partner-snapshots
// Nightly job: writes one performance snapshot per partner (tt_partners + decorators)
// into partner_performance_snapshots for the current date.
//
// Adapted to the actual schema:
//   - No partner_notifications table → dispatch counts derived from booking_events
//     (event_type='assigned_to_partner' / 'assigned_to_decorator') with response
//     inferred from subsequent status changes on the same booking.
//   - tt_bookings has no tip / payout columns → tips and payouts default to 0.
//   - customer_ratings / partner_ratings live on Public Site → counts default to 0.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = "platinum" | "gold" | "silver" | "bronze" | "at_risk";

function computeTier(args: {
  acceptanceRate: number;
  completionRate: number;
  dispatchesReceived: number;
}): Tier {
  const { acceptanceRate, completionRate, dispatchesReceived } = args;
  if (acceptanceRate < 50 || completionRate < 70) return "at_risk";
  if (acceptanceRate >= 90 && completionRate >= 95 && dispatchesReceived >= 20) return "platinum";
  if (acceptanceRate >= 80 && completionRate >= 90 && dispatchesReceived >= 10) return "gold";
  if (acceptanceRate >= 70 && completionRate >= 85) return "silver";
  return "bronze";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const today = new Date();
    const snapshotDate = today.toISOString().split("T")[0];
    const thirtyDaysAgoIso = new Date(today.getTime() - 30 * 86400000).toISOString();

    // 1. Collect partners
    const [{ data: ttPartners }, { data: decorators }] = await Promise.all([
      supabase.from("tt_partners").select("id, business_name, name, partner_type"),
      supabase.from("decorators").select("id, name"),
    ]);

    const allPartners: Array<{ id: string; name: string; partner_type: string }> = [
      ...(ttPartners || []).map((p: any) => ({
        id: p.id,
        name: p.business_name || p.name || "Unnamed Partner",
        partner_type: p.partner_type || "transport",
      })),
      ...(decorators || []).map((d: any) => ({
        id: d.id,
        name: d.name || "Decorator",
        partner_type: "decorator",
      })),
    ];

    // 2. Pull recent booking_events once and bucket by partner_id from new_state metadata
    //    event_type assigned_to_partner stores { partner_id } in new_state per log-booking-event trigger.
    const { data: assignEvents } = await supabase
      .from("booking_events")
      .select("booking_id, event_type, new_state, created_at")
      .in("event_type", ["assigned_to_partner", "assigned_to_decorator"])
      .gte("created_at", thirtyDaysAgoIso);

    // Pull status_changed events to infer accept/decline outcomes per booking
    const { data: statusEvents } = await supabase
      .from("booking_events")
      .select("booking_id, event_type, new_state, previous_state, created_at")
      .eq("event_type", "status_changed")
      .gte("created_at", thirtyDaysAgoIso);

    const statusByBooking = new Map<string, Array<any>>();
    for (const ev of statusEvents || []) {
      const arr = statusByBooking.get(ev.booking_id) || [];
      arr.push(ev);
      statusByBooking.set(ev.booking_id, arr);
    }

    const dispatchByPartner = new Map<string, { received: number; accepted: number; declined: number; noResponse: number; responseMins: number[] }>();
    for (const ev of assignEvents || []) {
      const partnerId =
        (ev.new_state as any)?.partner_id ||
        (ev.new_state as any)?.decor_partner_id ||
        (ev.new_state as any)?.decorator_id;
      if (!partnerId) continue;
      const bucket = dispatchByPartner.get(partnerId) || {
        received: 0, accepted: 0, declined: 0, noResponse: 0, responseMins: [],
      };
      bucket.received += 1;

      const subsequent = (statusByBooking.get(ev.booking_id) || [])
        .filter((s) => new Date(s.created_at).getTime() >= new Date(ev.created_at).getTime())
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      const firstStatus = subsequent[0];
      if (firstStatus) {
        const newStatus = (firstStatus.new_state as any)?.status;
        if (newStatus === "accepted" || newStatus === "in_progress" || newStatus === "completed") {
          bucket.accepted += 1;
          bucket.responseMins.push(
            (+new Date(firstStatus.created_at) - +new Date(ev.created_at)) / 60000,
          );
        } else if (newStatus === "declined" || newStatus === "cancelled") {
          bucket.declined += 1;
        } else {
          bucket.noResponse += 1;
        }
      } else {
        bucket.noResponse += 1;
      }
      dispatchByPartner.set(partnerId, bucket);
    }

    const snapshots: any[] = [];

    for (const partner of allPartners) {
      const dispatch = dispatchByPartner.get(partner.id) || {
        received: 0, accepted: 0, declined: 0, noResponse: 0, responseMins: [],
      };

      const acceptanceRate = dispatch.received > 0 ? (dispatch.accepted / dispatch.received) * 100 : 0;
      const avgResp = dispatch.responseMins.length > 0
        ? dispatch.responseMins.reduce((a, b) => a + b, 0) / dispatch.responseMins.length
        : null;

      // Booking aggregates (use proper column per partner type)
      const idCol = partner.partner_type === "decorator" ? "decor_partner_id" : "partner_id";
      const { data: bookings } = await supabase
        .from("tt_bookings")
        .select("status, total_price")
        .eq(idCol, partner.id)
        .gte("created_at", thirtyDaysAgoIso);

      const accepted30 = (bookings || []).filter((b) =>
        ["accepted", "in_progress", "completed"].includes(b.status),
      ).length;
      const completed30 = (bookings || []).filter((b) => b.status === "completed").length;
      const cancelled30 = (bookings || []).filter((b) => b.status === "cancelled").length;
      const completionRate = accepted30 > 0 ? (completed30 / accepted30) * 100 : 0;
      const revenue = (bookings || [])
        .filter((b) => b.status === "completed")
        .reduce((s, b) => s + Number(b.total_price || 0), 0);

      const tier = computeTier({
        acceptanceRate,
        completionRate,
        dispatchesReceived: dispatch.received,
      });

      snapshots.push({
        snapshot_date: snapshotDate,
        partner_id: partner.id,
        partner_type: partner.partner_type,
        partner_name: partner.name,
        dispatches_received_30d: dispatch.received,
        dispatches_accepted_30d: dispatch.accepted,
        dispatches_declined_30d: dispatch.declined,
        dispatches_no_response_30d: dispatch.noResponse,
        acceptance_rate_30d: Number(acceptanceRate.toFixed(2)),
        avg_response_time_minutes_30d: avgResp !== null ? Number(avgResp.toFixed(2)) : null,
        bookings_accepted_30d: accepted30,
        bookings_completed_30d: completed30,
        bookings_cancelled_30d: cancelled30,
        completion_rate_30d: Number(completionRate.toFixed(2)),
        customer_ratings_count_30d: 0,
        partner_ratings_count_30d: 0,
        flags_received_30d: 0,
        revenue_generated_30d: Number(revenue.toFixed(2)),
        payout_earned_30d: 0,
        tips_received_30d: 0,
        performance_tier: tier,
      });
    }

    if (snapshots.length > 0) {
      const { error } = await supabase
        .from("partner_performance_snapshots")
        .upsert(snapshots, { onConflict: "snapshot_date,partner_id" });
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ ok: true, snapshots_created: snapshots.length, snapshot_date: snapshotDate }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("generate-partner-snapshots error", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
