// dd-sla-snapshot — nightly cron
// Computes per-supplier fulfillment-speed snapshot from marketplace_fulfillments.
// Window = last 30 days; "shipped" = status in ('shipped','delivered'); duration =
// updated_at - created_at (the row's status flipped at updated_at). Writes one
// row per supplier into dd_sla_snapshots. Idempotent per night (truncates today's
// snapshots before re-writing).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WINDOW_DAYS = 30;
const LATE_HOURS = 72;

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[idx].toFixed(2));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const { data: rows, error } = await admin
    .from("marketplace_fulfillments")
    .select("wholesaler_id, status, created_at, updated_at")
    .gte("created_at", since)
    .not("wholesaler_id", "is", null);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // group by supplier
  const grouped = new Map<string, number[]>();
  for (const r of rows ?? []) {
    const shipped = ["shipped", "delivered"].includes(String(r.status));
    if (!shipped) continue;
    const hrs = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / 3_600_000;
    if (!Number.isFinite(hrs) || hrs < 0) continue;
    if (!grouped.has(r.wholesaler_id)) grouped.set(r.wholesaler_id, []);
    grouped.get(r.wholesaler_id)!.push(hrs);
  }

  // Wipe today's snapshots first (idempotent)
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  await admin.from("dd_sla_snapshots").delete().gte("computed_at", todayStart.toISOString());

  const writes: any[] = [];
  for (const [wid, hours] of grouped) {
    hours.sort((a, b) => a - b);
    writes.push({
      wholesaler_id: wid,
      window_days: WINDOW_DAYS,
      p50_hours: percentile(hours, 50),
      p90_hours: percentile(hours, 90),
      shipped_count: hours.length,
      late_count: hours.filter((h) => h > LATE_HOURS).length,
      late_threshold_hours: LATE_HOURS,
    });
  }
  if (writes.length) {
    const { error: insErr } = await admin.from("dd_sla_snapshots").insert(writes);
    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const slow = writes.filter((w) => (w.p50_hours ?? 0) > LATE_HOURS).length;
  return new Response(JSON.stringify({ suppliers_snapshotted: writes.length, slow_suppliers: slow, window_days: WINDOW_DAYS }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
