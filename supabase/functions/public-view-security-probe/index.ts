// public-view-security-probe
// ────────────────────────────────────────────────────────────────────────────
// SECURITY REGRESSION TEST (scheduled, daily via cron).
//
// Why this exists: public.products_public produced three distinct security
// issues in one day (cost-column leak, security-definer view, and full
// INSERT/UPDATE/DELETE grants to `anon`). Detection has to be continuous, not
// a one-time audit.
//
// What it does, for every view registered in public.public_view_contracts:
//   1. LIVE ANON PROBES — using the real public anon key, it attempts
//      GET / PATCH / POST / DELETE against the view through PostgREST.
//      Expected: GET succeeds, all writes fail with a permission error.
//      Any write that unexpectedly SUCCEEDS is a critical regression.
//   2. GRANT CONTRACT CHECK — calls public.assert_public_view_grants(), which
//      compares actual grants + columns against the declared safe state.
//
// Results are written to public.public_view_security_probes and the
// `public_view_security_probe` row in public.health_checks. Critical findings
// fire an immediate SMS/Slack alert (deduped 6h).
//
// Run manually:  POST /functions/v1/public-view-security-probe
// ────────────────────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
  "";

const SLACK_WEBHOOK = Deno.env.get("COMMS_ALERT_SLACK_WEBHOOK") || "";
const ALERT_SMS_TO =
  Deno.env.get("SECURITY_ALERT_PHONE") ||
  Deno.env.get("ADMIN_ALERT_PHONE") ||
  Deno.env.get("DAVID_PHONE_NUMBER") ||
  "";
const ALERT_DEDUPE_HOURS = 6;

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

type ProbeResult = {
  view: string;
  method: string;
  status: number;
  body: string;
  expected: "allow" | "deny";
  passed: boolean;
};

async function anonRequest(
  view: string,
  method: string,
  init: { query?: string; body?: unknown; prefer?: string } = {},
): Promise<{ status: number; body: string }> {
  const url = `${SUPABASE_URL}/rest/v1/${view}${init.query ?? ""}`;
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
  };
  if (init.prefer) headers["Prefer"] = init.prefer;
  const res = await fetch(url, {
    method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = (await res.text()).slice(0, 400);
  return { status: res.status, body };
}

// A write is "blocked" when PostgREST refuses it (permission denied / RLS).
function writeBlocked(status: number, body: string): boolean {
  if (status >= 200 && status < 300) return false;
  if (status === 401 || status === 403 || status === 404 || status === 405) return true;
  // 42501 = insufficient_privilege
  return body.includes("42501") || body.toLowerCase().includes("permission denied");
}

async function probeView(view: string): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];

  // 1. READ — must still work (storefront depends on it)
  const read = await anonRequest(view, "GET", { query: "?select=id&limit=1" });
  out.push({
    view,
    method: "GET",
    status: read.status,
    body: read.body,
    expected: "allow",
    passed: read.status >= 200 && read.status < 300,
  });

  // 2. PATCH — rename attempt
  const patch = await anonRequest(view, "PATCH", {
    query: `?id=eq.${ZERO_UUID}`,
    body: { product_name: "SECURITY_PROBE_DO_NOT_PERSIST" },
    prefer: "return=representation",
  });
  out.push({
    view, method: "PATCH", status: patch.status, body: patch.body,
    expected: "deny", passed: writeBlocked(patch.status, patch.body),
  });

  // 3. PATCH — delist attempt (status flip)
  const delist = await anonRequest(view, "PATCH", {
    query: `?id=eq.${ZERO_UUID}`,
    body: { status: "inactive" },
    prefer: "return=representation",
  });
  out.push({
    view, method: "PATCH(status)", status: delist.status, body: delist.body,
    expected: "deny", passed: writeBlocked(delist.status, delist.body),
  });

  // 4. POST — fake row insert
  const insert = await anonRequest(view, "POST", {
    body: { product_name: "SECURITY_PROBE_DO_NOT_PERSIST", status: "inactive" },
    prefer: "return=representation",
  });
  out.push({
    view, method: "POST", status: insert.status, body: insert.body,
    expected: "deny", passed: writeBlocked(insert.status, insert.body),
  });

  // 5. DELETE — removal attempt
  const del = await anonRequest(view, "DELETE", { query: `?id=eq.${ZERO_UUID}` });
  out.push({
    view, method: "DELETE", status: del.status, body: del.body,
    expected: "deny", passed: writeBlocked(del.status, del.body),
  });

  return out;
}

async function alert(text: string, supabase: ReturnType<typeof createClient>) {
  // dedupe on the health_checks row
  const { data: hc } = await supabase
    .from("health_checks")
    .select("details")
    .eq("check_key", "public_view_security_probe")
    .maybeSingle();
  const lastAlert = (hc?.details as any)?.last_alert_at as string | undefined;
  if (lastAlert && Date.now() - new Date(lastAlert).getTime() < ALERT_DEDUPE_HOURS * 3600_000) {
    console.log("[view-probe] alert suppressed (dedupe window)");
    return;
  }

  if (SLACK_WEBHOOK) {
    await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch((e) => console.error("[view-probe] slack failed", e));
  }
  if (ALERT_SMS_TO) {
    await supabase.functions
      .invoke("send-sms", { body: { to: ALERT_SMS_TO, message: text.slice(0, 300) } })
      .catch((e: unknown) => console.error("[view-probe] sms failed", e));
  }
  await supabase
    .from("health_checks")
    .update({ details: { ...((hc?.details as any) ?? {}), last_alert_at: new Date().toISOString() } })
    .eq("check_key", "public_view_security_probe");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = new Date().toISOString();

  try {
    if (!ANON_KEY) throw new Error("Anon key unavailable — cannot run anon probes");

    const { data: contracts, error: cErr } = await supabase
      .from("public_view_contracts")
      .select("view_name");
    if (cErr) throw cErr;

    const views: string[] = (contracts ?? []).map((c: any) => c.view_name);
    let probes: ProbeResult[] = [];
    for (const v of views) probes = probes.concat(await probeView(v));

    // Grant/column contract assertion (service-role side)
    const { data: violations, error: vErr } = await supabase.rpc("assert_public_view_grants");
    if (vErr) throw vErr;

    const failedProbes = probes.filter((p) => !p.passed);
    const writeBreaches = failedProbes.filter((p) => p.expected === "deny");
    const grantViolations = (violations ?? []) as any[];
    const critical = writeBreaches.length > 0 || grantViolations.length > 0;
    const status = critical ? "red" : failedProbes.length > 0 ? "yellow" : "green";

    const message = critical
      ? `${writeBreaches.length} anon write(s) succeeded, ${grantViolations.length} grant violation(s)`
      : failedProbes.length > 0
        ? `Read probe degraded on ${failedProbes.map((p) => p.view).join(", ")}`
        : `All ${probes.length} probes passed across ${views.length} view(s)`;

    await supabase.from("public_view_security_probes").insert({
      status,
      views_checked: views,
      probe_results: probes,
      grant_violations: grantViolations,
      message,
    });

    await supabase
      .from("health_checks")
      .update({
        last_run_at: startedAt,
        last_ok_at: status === "green" ? startedAt : undefined,
        last_status: status,
        last_message: message,
      })
      .eq("check_key", "public_view_security_probe");

    if (critical) {
      const lines = [
        "🚨 PUBLIC VIEW SECURITY REGRESSION",
        ...writeBreaches.map((p) => `• ${p.view}: anon ${p.method} SUCCEEDED (${p.status})`),
        ...grantViolations.map((v) => `• ${v.view_name}: ${v.violation} ${v.role_name} ${v.detail}`),
        "Revoke immediately — see products_public safe-state contract.",
      ];
      await alert(lines.join("\n"), supabase);
    }

    return new Response(
      JSON.stringify({ status, message, views, probes, grant_violations: grantViolations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[view-probe] failed:", msg);
    await supabase
      .from("health_checks")
      .update({ last_run_at: startedAt, last_status: "red", last_message: `probe error: ${msg}` })
      .eq("check_key", "public_view_security_probe");
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
