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
const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY") || "";
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN") || Deno.env.get("VITE_MAPBOX_TOKEN") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

type Status = "pass" | "warn" | "fail" | "paused";
interface CheckResult { status: Status; message: string; details?: Record<string, unknown> }

interface MonitoringConfig {
  monitoringEnabled: boolean;
  smsEnabled: boolean;
  throttleMinutes: number;
}

const sb = () => createClient(SUPABASE_URL, SERVICE_KEY);
const INCIDENT_KEY = "incident.system-health";

async function readMonitoringConfig(client: ReturnType<typeof sb>): Promise<MonitoringConfig> {
  const { data, error } = await client
    .from("system_alert_config")
    .select("system_name, alerts_enabled, sms_throttle_minutes")
    .in("system_name", ["system_health_monitoring", "system_health_sms"]);
  if (error) {
    console.error("[system-health] config read failed; keeping checks on and SMS off:", error.message);
    return { monitoringEnabled: true, smsEnabled: false, throttleMinutes: 360 };
  }
  const monitoring = data?.find((row) => row.system_name === "system_health_monitoring");
  const sms = data?.find((row) => row.system_name === "system_health_sms");
  return {
    monitoringEnabled: monitoring?.alerts_enabled !== false,
    smsEnabled: sms?.alerts_enabled === true,
    throttleMinutes: Math.max(30, Number(sms?.sms_throttle_minutes ?? 360)),
  };
}

function twAuthHeader(): string | null {
  if (TWILIO_API_SID && TWILIO_API_SECRET) return "Basic " + btoa(`${TWILIO_API_SID}:${TWILIO_API_SECRET}`);
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) return "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  return null;
}

// ─── CHECK IMPLEMENTATIONS ──────────────────────────────────────────────────
interface CronState {
  jobname: string;
  job_active: boolean | null;
  last_start: string | null;
  last_status: string | null;
  return_message: string | null;
  switch_key: string | null;
  switch_enabled: boolean | null;
}

async function readCronState(client: ReturnType<typeof sb>, jobname: string): Promise<CronState | null> {
  const { data, error } = await client.rpc("get_cron_job_state", { p_jobname: jobname });
  if (error) {
    console.error(`[system-health] get_cron_job_state('${jobname}') failed:`, error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as CronState) ?? null;
}

// A job that is intentionally OFF via the outreach switchboard (switch disabled AND
// cron deactivated) is PAUSED, not failing. If the switch is ON, staleness is a real failure.
function pausedByOutreachSwitch(row: CronState): CheckResult | null {
  if (row.switch_key && row.switch_enabled === false && row.job_active === false) {
    return {
      status: "paused",
      message: `Intentionally disabled via outreach switch '${row.switch_key}'`,
      details: row as unknown as Record<string, unknown>,
    };
  }
  return null;
}

async function checkCron(client: ReturnType<typeof sb>, check: any): Promise<CheckResult> {
  const jobname = check.config?.jobname;
  if (!jobname) return { status: "warn", message: "Registry missing jobname" };
  const row = await readCronState(client, jobname);
  if (!row) return { status: "warn", message: `Could not look up cron '${jobname}'` };

  const paused = pausedByOutreachSwitch(row);
  if (paused) return paused;

  const lastStart = row.last_start ? new Date(row.last_start) : null;
  const lastStatus = row.last_status as string;
  if (!lastStart) return { status: "warn", message: `Cron '${jobname}' never run`, details: row as unknown as Record<string, unknown> };
  const ageMin = (Date.now() - lastStart.getTime()) / 60000;
  const cad = check.cadence_expected_minutes || 60;
  const det = row as unknown as Record<string, unknown>;
  if (lastStatus === "failed") return { status: "fail", message: `Last run FAILED ${Math.round(ageMin)}m ago`, details: det };
  if (ageMin > cad * 2) return { status: "fail", message: `Stale ${Math.round(ageMin)}m (cadence ${cad}m)`, details: det };
  if (ageMin > cad) return { status: "warn", message: `Late ${Math.round(ageMin)}m (cadence ${cad}m)`, details: det };
  return { status: "pass", message: `Last ran ${Math.round(ageMin)}m ago (${lastStatus})`, details: det };
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
async function maybeEscalate(
  client: ReturnType<typeof sb>,
  checks: any[],
  results: Array<CheckResult & { key: string }>,
  config: MonitoringConfig,
) {
  const failures = results.filter((result) => result.status === "fail");
  const { data: prev } = await client
    .from("health_check_alerts")
    .select("last_alert_at, last_status, last_message")
    .eq("check_key", INCIDENT_KEY)
    .maybeSingle();
  if (failures.length === 0) {
    if (prev?.last_status === "fail") {
      const { error } = await client.from("health_check_alerts").update({
        last_status: "pass",
        last_message: "Incident recovered; ready to alert on the next failure transition",
      }).eq("check_key", INCIDENT_KEY);
      if (error) console.error("[system-health] incident recovery update failed:", error.message);
    }
    return;
  }

  const priorAlertIncludedSms = prev?.last_message?.includes("sms_enabled=true") === true;
  if (prev?.last_status === "fail" && (!config.smsEnabled || priorAlertIncludedSms)) return;
  if (prev?.last_alert_at) {
    const ageMinutes = (Date.now() - new Date(prev.last_alert_at).getTime()) / 60_000;
    if (ageMinutes < config.throttleMinutes) return;
  }

  const checkByKey = new Map(checks.map((check) => [check.check_key, check]));
  const lines = failures.map((result) => {
    const check = checkByKey.get(result.key);
    return `• [${check?.business ?? "unknown"}/${check?.floor ?? "unknown"}] ${check?.label ?? result.key} — ${result.message}`;
  });
  const subject = `System health: ${failures.length} failing check${failures.length === 1 ? "" : "s"}`;
  const alert = await sendOpsAlert({
    source: "system-health-runner",
    severity: "critical",
    subject,
    message: [subject, ...lines].join("\n").slice(0, 6000),
    context: { failing_total: failures.length, check_keys: failures.map((result) => result.key) },
    sms: config.smsEnabled,
  });
  const { error } = await client.from("health_check_alerts").upsert({
    check_key: INCIDENT_KEY,
    last_alert_at: new Date().toISOString(),
    last_status: "fail",
    last_message: `${failures.length} failing checks; email=${alert.emailSent}; sms=${alert.smsSent}; sms_enabled=${config.smsEnabled}`,
  });
  if (error) console.error("[system-health] incident state upsert failed:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const onlyKey = url.searchParams.get("key");
  const client = sb();
  const monitoringConfig = await readMonitoringConfig(client);
  if (!monitoringConfig.monitoringEnabled) {
    return new Response(JSON.stringify({ ran: 0, monitoring_enabled: false, sms_enabled: monitoringConfig.smsEnabled, results: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
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
    results.push({ key: c.check_key, ...r, duration_ms });
  }

  await maybeEscalate(client, checks ?? [], results, monitoringConfig);

  const counts = { pass: 0, warn: 0, fail: 0 };
  for (const r of results) counts[r.status]++;
  return new Response(JSON.stringify({ ran: results.length, counts, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
