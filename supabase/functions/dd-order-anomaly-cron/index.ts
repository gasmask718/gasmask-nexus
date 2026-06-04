// dd-order-anomaly-cron — nightly (≈06:00 UTC)
// Scans the day's marketplace_orders for: (a) volume spike vs 7d rolling avg,
// (b) duplicate-cluster patterns (same email/total within a window). One Gemini
// narrative pass per detected cluster (graceful fallback). Findings land in
// dd_anomaly_findings (status='open') and surface in the AlertBar via KPIs.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SPIKE_MULTIPLIER = 3.0;
const DUP_WINDOW_HOURS = 6;
const MODEL = "google/gemini-3-flash-preview";

async function narrate(kind: string, signals: Record<string, unknown>): Promise<string> {
  if (!LOVABLE_API_KEY) return "";
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You write 1-sentence operational findings for an ops dashboard. Plain, no fluff, no exclamation marks. Be specific about numbers." },
          { role: "user", content: `Anomaly kind: ${kind}\nSignals:\n${JSON.stringify(signals, null, 2)}\n\nReturn one sentence summarizing what an operator should know.` },
        ],
      }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    return String(data.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const j = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const now = new Date();
  const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

  // Pull 7 days of orders to compute baseline + today's slice
  const { data: orders, error } = await admin
    .from("marketplace_orders")
    .select("id, total, payment_status, customer_email, created_at")
    .gte("created_at", sevenDaysAgo.toISOString());
  if (error) return j({ error: error.message }, 500);

  const findings: any[] = [];
  const all = orders ?? [];
  const today = all.filter((o) => new Date(o.created_at) >= todayStart);

  // ── Spike detection ────────────────────────────────────────────
  const prior = all.filter((o) => new Date(o.created_at) < todayStart);
  const priorDailyAvg = prior.length / 7;
  if (today.length >= 5 && priorDailyAvg > 0 && today.length >= priorDailyAvg * SPIKE_MULTIPLIER) {
    const signals = { today_orders: today.length, prior_7d_avg: Number(priorDailyAvg.toFixed(2)), multiplier: Number((today.length / priorDailyAvg).toFixed(2)) };
    const summary = (await narrate("spike", signals)) || `Order volume ${signals.multiplier}× the 7-day average (${today.length} vs ${signals.prior_7d_avg}/day).`;
    findings.push({
      kind: "spike",
      severity: "warn",
      title: `Order volume spike — ${signals.multiplier}× baseline`,
      summary,
      signals,
      ai_generated: !!LOVABLE_API_KEY,
    });
  }

  // ── Duplicate cluster detection ────────────────────────────────
  // Same email + same total within DUP_WINDOW_HOURS = suspicious cluster
  const windowMs = DUP_WINDOW_HOURS * 3_600_000;
  const buckets = new Map<string, any[]>();
  for (const o of today) {
    if (!o.customer_email || o.total == null) continue;
    const k = `${(o.customer_email as string).toLowerCase()}::${Number(o.total).toFixed(2)}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(o);
  }
  for (const [key, arr] of buckets) {
    if (arr.length < 3) continue;
    arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const span = new Date(arr[arr.length - 1].created_at).getTime() - new Date(arr[0].created_at).getTime();
    if (span > windowMs) continue;
    const [email, total] = key.split("::");
    const signals = { email, total_per_order: total, count: arr.length, span_minutes: Math.round(span / 60_000) };
    const summary = (await narrate("duplicate_cluster", signals)) || `${arr.length} identical-total orders from ${email} within ${signals.span_minutes} minutes.`;
    findings.push({
      kind: "duplicate_cluster",
      severity: arr.length >= 5 ? "critical" : "warn",
      title: `Duplicate-cluster pattern — ${email}`,
      summary,
      signals,
      ai_generated: !!LOVABLE_API_KEY,
    });
  }

  if (findings.length) {
    const { error: insErr } = await admin.from("dd_anomaly_findings").insert(findings);
    if (insErr) return j({ error: insErr.message }, 500);
  }

  return j({
    scanned_today: today.length,
    prior_window_days: 7,
    findings_written: findings.length,
    detail: findings.map((f) => ({ kind: f.kind, severity: f.severity, title: f.title })),
  });
});
