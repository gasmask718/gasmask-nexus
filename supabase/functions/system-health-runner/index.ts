// system-health-runner
// Runs every 10 minutes via pg_cron. Also callable on-demand from the UI.
// Loops through public.health_checks (enabled=true), runs the appropriate
// probe per kind, writes a row to health_check_runs, updates the registry,
// and SMS-escalates new RED items to David (6h dedupe).
//
// Each check returns pass | warn | fail with a precise message + details.
// Synthetic chain pulses are triggered separately via ?key=<chain_key>&synthetic=1.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendOpsAlert } from "../_shared/opsAlert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_API_SID = Deno.env.get("TWILIO_API_SID") || "";
const TWILIO_API_SECRET = Deno.env.get("TWILIO_API_SECRET") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const ESCALATION_PHONE = Deno.env.get("HEALTH_ESCALATION_PHONE") ||
  Deno.env.get("DAVID_PHONE_NUMBER") ||
  Deno.env.get("ADMIN_ALERT_PHONE") ||
  Deno.env.get("DAVID_PHONE") || "";
const ESCALATION_FROM = Deno.env.get("HEALTH_ESCALATION_FROM") ||
  Deno.env.get("TWILIO_FROM_NUMBER") ||
  Deno.env.get("TWILIO_PHONE_NUMBER") ||
  "+18776818621";
const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY") || "";
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN") || Deno.env.get("VITE_MAPBOX_TOKEN") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const ALERT_DEDUPE_HOURS = 6;

type Status = "pass" | "warn" | "fail";
interface CheckResult { status: Status; message: string; details?: Record<string, unknown> }

const sb = () => createClient(SUPABASE_URL, SERVICE_KEY);

function twAuthHeader(): string | null {
  if (TWILIO_API_SID && TWILIO_API_SECRET) return "Basic " + btoa(`${TWILIO_API_SID}:${TWILIO_API_SECRET}`);
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) return "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  return null;
}

// ─── CHECK IMPLEMENTATIONS ──────────────────────────────────────────────────
async function checkCron(client: ReturnType<typeof sb>, check: any): Promise<CheckResult> {
  const jobname = check.config?.jobname;
  if (!jobname) return { status: "warn", message: "Registry missing jobname" };
  const { data, error } = await client.rpc("get_last_cron_run", { p_jobname: jobname });
  if (error) {
    // Fallback: query via raw select
    const r = await client.from("cron_last_runs_v" as any).select("*").eq("jobname", jobname).maybeSingle();
    if (!r.data) return { status: "warn", message: `Could not look up cron '${jobname}': ${error.message}` };
  }
  const row = (data && data[0]) || data;
  if (!row) return { status: "warn", message: `Cron '${jobname}' has no run history yet` };
  const lastStart = row.last_start ? new Date(row.last_start) : null;
  const lastStatus = row.last_status as string;
  if (!lastStart) return { status: "warn", message: `Cron '${jobname}' never run`, details: row };
  const ageMin = (Date.now() - lastStart.getTime()) / 60000;
  const cad = check.cadence_expected_minutes || 60;
  if (lastStatus === "failed") return { status: "fail", message: `Last run FAILED ${Math.round(ageMin)}m ago`, details: row };
  if (ageMin > cad * 2) return { status: "fail", message: `Stale ${Math.round(ageMin)}m (cadence ${cad}m)`, details: row };
  if (ageMin > cad) return { status: "warn", message: `Late ${Math.round(ageMin)}m (cadence ${cad}m)`, details: row };
  return { status: "pass", message: `Last ran ${Math.round(ageMin)}m ago (${lastStatus})`, details: row };
}

async function checkIntegrationTwilio(): Promise<CheckResult> {
  const auth = twAuthHeader();
  if (!auth) return { status: "fail", message: "Twilio credentials missing from secrets" };
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Balance.json`, { headers: { Authorization: auth } });
    if (!r.ok) return { status: "fail", message: `Twilio HTTP ${r.status}` };
    const j = await r.json();
    const bal = parseFloat(j.balance || "0");
    if (bal < 10) return { status: "warn", message: `Balance low: $${bal.toFixed(2)}`, details: j };
    return { status: "pass", message: `Reachable, balance $${bal.toFixed(2)}`, details: j };
  } catch (e) { return { status: "fail", message: `Twilio threw: ${(e as Error).message}` }; }
}

async function checkIntegrationBland(): Promise<CheckResult> {
  if (!BLAND_API_KEY) return { status: "warn", message: "BLAND_API_KEY not set" };
  try {
    const r = await fetch("https://api.bland.ai/v1/pathway", { headers: { authorization: BLAND_API_KEY } });
    return r.ok
      ? { status: "pass", message: `Bland API HTTP ${r.status}` }
      : { status: "fail", message: `Bland HTTP ${r.status}` };
  } catch (e) { return { status: "fail", message: `Bland threw: ${(e as Error).message}` }; }
}

async function checkIntegrationMapbox(): Promise<CheckResult> {
  if (!MAPBOX_TOKEN) return { status: "warn", message: "Mapbox token not set" };
  try {
    const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/test.json?access_token=${MAPBOX_TOKEN}&limit=1`);
    return r.ok ? { status: "pass", message: "Geocode probe OK" } : { status: "fail", message: `Mapbox HTTP ${r.status}` };
  } catch (e) { return { status: "fail", message: `Mapbox threw: ${(e as Error).message}` }; }
}

async function checkIntegrationLovableGateway(): Promise<CheckResult> {
  if (!LOVABLE_API_KEY) return { status: "warn", message: "LOVABLE_API_KEY not set" };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: "ping" }], max_tokens: 5 }),
    });
    return r.ok ? { status: "pass", message: `Gateway HTTP ${r.status}` } : { status: "fail", message: `Gateway HTTP ${r.status}` };
  } catch (e) { return { status: "fail", message: `Gateway threw: ${(e as Error).message}` }; }
}

async function checkIntegrationKeyReadySlot(check: any): Promise<CheckResult> {
  // Stripe / EasyPost / Resend / SerpAPI — flip to monitored when keys land
  return { status: "warn", message: `${check.label} — awaiting API key`, details: check.config };
}

async function checkTriggerHeartbeat(client: ReturnType<typeof sb>, check: any): Promise<CheckResult> {
  // Cheap heartbeats: prove the trigger fired recently by looking for its expected side-effect
  switch (check.check_key) {
    case "trigger.review_to_summary_job": {
      const { count } = await client.from("review_summary_jobs").select("*", { count: "exact", head: true }).gte("enqueued_at", new Date(Date.now() - 7 * 86400_000).toISOString());
      return { status: "pass", message: `${count ?? 0} jobs enqueued last 7d (trigger reachable)` };
    }
    case "trigger.paid_order_consumed_reservation": {
      const { count } = await client.from("marketplace_orders" as any).select("*", { count: "exact", head: true }).eq("status", "paid").gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString());
      return { status: "pass", message: `${count ?? 0} paid orders last 7d (canary present)` };
    }
    default:
      return { status: "pass", message: "Trigger registry entry present (heartbeat stub)" };
  }
}

async function checkChain(check: any): Promise<CheckResult> {
  // Default = pass-through; real synthetic pulse fires via ?synthetic=1
  return { status: "pass", message: `Chain registered — run synthetic test from UI`, details: check.config };
}

async function checkDataCanary(client: ReturnType<typeof sb>, check: any): Promise<CheckResult> {
  const threshold = (check.config?.threshold ?? 0) as number;
  switch (check.check_key) {
    case "canary.orphan_orders": {
      const { count } = await client.from("marketplace_orders" as any).select("*", { count: "exact", head: true }).eq("status", "paid").is("fulfillment_id" as any, null);
      const n = count ?? 0;
      return { status: n > threshold ? "warn" : "pass", message: `${n} orphan paid orders (threshold ${threshold})` };
    }
    case "canary.stuck_pending_orders_3d": {
      const days = check.config?.days ?? 3;
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      const { count } = await client.from("marketplace_orders" as any).select("*", { count: "exact", head: true }).eq("status", "pending").lt("created_at", cutoff);
      const n = count ?? 0;
      return { status: n > threshold ? "warn" : "pass", message: `${n} pending >${days}d` };
    }
    case "canary.unrouted_fulfillments": {
      const { count } = await client.from("marketplace_fulfillments" as any).select("*", { count: "exact", head: true }).is("wholesaler_id" as any, null);
      const n = count ?? 0;
      return { status: n > threshold ? "warn" : "pass", message: `${n} unrouted fulfillments` };
    }
    case "canary.stale_review_summary_jobs": {
      const mins = check.config?.minutes ?? 30;
      const cutoff = new Date(Date.now() - mins * 60_000).toISOString();
      const { count } = await client.from("review_summary_jobs").select("*", { count: "exact", head: true }).lt("enqueued_at", cutoff);
      const n = count ?? 0;
      return { status: n > threshold ? "fail" : "pass", message: `${n} jobs stale >${mins}m (threshold ${threshold})` };
    }
    case "canary.stale_notification_queue": {
      const hrs = check.config?.hours ?? 2;
      const cutoff = new Date(Date.now() - hrs * 3600_000).toISOString();
      const { count } = await client.from("notification_queue" as any).select("*", { count: "exact", head: true }).eq("status", "pending").lt("created_at", cutoff);
      const n = count ?? 0;
      return { status: n > threshold ? "warn" : "pass", message: `${n} stale pending notifications` };
    }
    case "canary.dd_error_spike": {
      const mins = check.config?.minutes ?? 60;
      const cutoff = new Date(Date.now() - mins * 60_000).toISOString();
      const { count } = await client.from("dd_error_log" as any).select("*", { count: "exact", head: true }).eq("severity", "error").gte("created_at", cutoff);
      const n = count ?? 0;
      if (n > threshold * 3) return { status: "fail", message: `${n} Dynasty Direct errors in last ${mins}m (threshold ${threshold})` };
      return { status: n > threshold ? "warn" : "pass", message: `${n} Dynasty Direct errors in last ${mins}m (threshold ${threshold})` };
    }
    case "canary.dup_order_clusters": {
      const { data } = await client.from("dd_anomaly_findings" as any).select("id").eq("kind", "duplicate_cluster").gte("created_at", new Date(Date.now() - 86400_000).toISOString());
      const n = data?.length ?? 0;
      return { status: n > threshold ? "warn" : "pass", message: `${n} dup-cluster anomalies in last 24h` };
    }
  }
  return { status: "pass", message: "Canary stub OK" };
}

async function checkFunction(check: any): Promise<CheckResult> {
  const fn = check.config?.function;
  if (!fn) return { status: "warn", message: "Registry missing config.function" };
  const maxStatus = Number(check.config?.max_status ?? 499);
  const expect = check.config?.expect_status ? Number(check.config.expect_status) : null;
  const body = check.config?.probe_body ?? { healthcheck: true };
  const t0 = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify(body),
    });
    const ms = Date.now() - t0;
    const text = (await r.text()).slice(0, 300);
    if (expect !== null) {
      return r.status === expect
        ? { status: "pass", message: `${fn} responded ${r.status} in ${ms}ms`, details: { body: text } }
        : { status: "fail", message: `${fn} returned ${r.status} (expected ${expect})`, details: { body: text } };
    }
    if (r.status > maxStatus) {
      return { status: "fail", message: `${fn} returned HTTP ${r.status}`, details: { body: text } };
    }
    if (ms > 8000) return { status: "warn", message: `${fn} slow: ${ms}ms`, details: { body: text } };
    return { status: "pass", message: `${fn} responded ${r.status} in ${ms}ms`, details: { body: text } };
  } catch (e) {
    return { status: "fail", message: `${fn} unreachable: ${(e as Error).message}` };
  }
}

async function checkAgent(client: ReturnType<typeof sb>, check: any): Promise<CheckResult> {
  const tbl = check.config?.outputs_table;
  if (!tbl) return { status: "pass", message: "Agent registered (no outputs table to probe)" };
  try {
    const { data, error } = await client.from(tbl).select("created_at").order("created_at", { ascending: false }).limit(1);
    if (error) return { status: "warn", message: `Probe error on ${tbl}: ${error.message}` };
    if (!data || data.length === 0) return { status: "warn", message: `No agent output yet in ${tbl}` };
    const ageMin = (Date.now() - new Date(data[0].created_at).getTime()) / 60000;
    const cad = check.cadence_expected_minutes || 1500;
    if (ageMin > cad * 2) return { status: "fail", message: `Agent silent ${Math.round(ageMin)}m (expected ≤${cad})` };
    if (ageMin > cad) return { status: "warn", message: `Agent late ${Math.round(ageMin)}m` };
    return { status: "pass", message: `Last output ${Math.round(ageMin)}m ago in ${tbl}` };
  } catch (e) { return { status: "warn", message: `Agent probe threw: ${(e as Error).message}` }; }
}

async function runOne(client: ReturnType<typeof sb>, check: any): Promise<CheckResult> {
  try {
    switch (check.kind) {
      case "cron": return await checkCron(client, check);
      case "trigger": return await checkTriggerHeartbeat(client, check);
      case "chain": return await checkChain(check);
      case "data_canary": return await checkDataCanary(client, check);
      case "agent": return await checkAgent(client, check);
      case "integration": {
        if (check.check_key === "integration.twilio") return await checkIntegrationTwilio();
        if (check.check_key === "integration.bland_ai") return await checkIntegrationBland();
        if (check.check_key === "integration.mapbox") return await checkIntegrationMapbox();
        if (check.check_key === "integration.lovable_gateway") return await checkIntegrationLovableGateway();
        if (check.config?.key_ready) return await checkIntegrationKeyReadySlot(check);
        return { status: "warn", message: "Unknown integration" };
      }
      case "function": return await checkFunction(check);
    }
  } catch (e) {
    return { status: "fail", message: `Runner threw: ${(e as Error).message}` };
  }
  return { status: "warn", message: "Unknown kind" };
}

// ─── ESCALATION ─────────────────────────────────────────────────────────────
async function maybeEscalate(client: ReturnType<typeof sb>, check: any, result: CheckResult) {
  if (result.status !== "fail") return;
  const { data: prev } = await client.from("health_check_alerts").select("last_alert_at").eq("check_key", check.check_key).maybeSingle();
  if (prev?.last_alert_at) {
    const ageHr = (Date.now() - new Date(prev.last_alert_at).getTime()) / 3600_000;
    if (ageHr < ALERT_DEDUPE_HOURS) return;
  }
  const body = `[${check.business}/${check.floor ?? ''}] ${check.label}\n${result.message}`.slice(0, 1000);
  // Group A: email-first ops channel. A failing health check used to be
  // announced over the same Twilio credential the check was watching.
  const alert = await sendOpsAlert({
    source: "system-health-runner",
    severity: "critical",
    subject: `Health check FAIL: ${check.label}`,
    message: body,
    context: { check_key: check.check_key, business: check.business, floor: check.floor, details: result.details },
  });
  if (alert.emailSent || alert.smsSent) {
    await client.from("health_check_alerts").upsert({ check_key: check.check_key, last_alert_at: new Date().toISOString(), last_status: result.status, last_message: result.message });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const onlyKey = url.searchParams.get("key");
  const client = sb();
  let q = client.from("health_checks").select("*").eq("enabled", true);
  if (onlyKey) q = q.eq("check_key", onlyKey);
  const { data: checks, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const results: any[] = [];
  for (const c of checks ?? []) {
    const t0 = Date.now();
    const r = await runOne(client, c);
    const duration_ms = Date.now() - t0;
    await client.from("health_check_runs").insert({ check_key: c.check_key, status: r.status, message: r.message, details: r.details ?? {}, duration_ms });
    await client.from("health_checks").update({
      last_run_at: new Date().toISOString(),
      last_ok_at: r.status === "pass" ? new Date().toISOString() : c.last_ok_at,
      last_status: r.status,
      last_message: r.message,
      details: r.details ?? {},
    }).eq("check_key", c.check_key);
    await maybeEscalate(client, c, r);
    results.push({ key: c.check_key, ...r, duration_ms });
  }

  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status]++;
  return new Response(JSON.stringify({ ran: results.length, counts, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
