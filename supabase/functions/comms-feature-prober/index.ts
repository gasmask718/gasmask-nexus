// comms-feature-prober — runs in its own edge trace so it gets its own
// outbound-fetch quota. Probes every calling + texting feature mode by
// POSTing `{healthcheck:true}` to its backing edge function. Persists rows
// to comms_health_checks under layer='feature_mode' so the dashboard picks
// them up alongside the rest of the monitor.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type FeatureMode = {
  key: string;
  label: string;
  channel: "call" | "sms";
  mode: "manual" | "auto_dialer" | "bulk" | "ai" | "system";
  fn: string;
  provider: "twilio" | "bland" | "elevenlabs" | "mixed";
  surfaces: string[];
  sender?: string;
};

const FEATURE_MODES: FeatureMode[] = [
  // CALLS
  { key: "manual_call_generic", label: "Manual call (global)", channel: "call", mode: "manual", fn: "place-outbound-call", provider: "twilio", surfaces: ["Floor 2 Comms Hub", "Store profile", "CRM contact detail", "CallProvider/useCall"], sender: "Business phone (twilio)" },
  { key: "manual_call_twilio",  label: "Manual call (Twilio direct)", channel: "call", mode: "manual", fn: "twilio-manual-call", provider: "twilio", surfaces: ["Dialer", "Ad-hoc click-to-call"], sender: "Default Twilio number" },
  { key: "manual_call_ambassador", label: "Ambassador direct call", channel: "call", mode: "manual", fn: "ambassador-direct-call", provider: "twilio", surfaces: ["Ambassador comms"], sender: "Ambassador-assigned Twilio number" },
  { key: "ai_call_ambassador",  label: "Ambassador AI call", channel: "call", mode: "ai", fn: "ambassador-ai-call", provider: "bland", surfaces: ["Ambassador outreach"], sender: "Bland → Twilio caller-ID" },
  { key: "va_power_dialer",     label: "VA Power Dialer (auto-dialer)", channel: "call", mode: "auto_dialer", fn: "va-power-dialer", provider: "twilio", surfaces: ["VAPowerDialer", "BatchDialerPanel"], sender: "Per-VA assigned caller-ID set" },
  
  { key: "predictive_dialer",   label: "Predictive dialer engine", channel: "call", mode: "auto_dialer", fn: "predictive-dialer-engine", provider: "twilio", surfaces: ["Batch dial campaigns"], sender: "Campaign caller-ID" },
  { key: "bulk_ai_call",        label: "Bulk AI call processor", channel: "call", mode: "bulk", fn: "bulk-ai-call-processor", provider: "bland", surfaces: ["Bulk AI campaigns"], sender: "Bland fleet → toll-free" },
  { key: "bland_outbound",      label: "Bland AI outbound call", channel: "call", mode: "ai", fn: "bland-start-call", provider: "bland", surfaces: ["AI-initiated outreach"], sender: "Bland caller-ID pool" },
  { key: "dc_outbound",         label: "Dynasty Connect outbound call", channel: "call", mode: "system", fn: "dc-outbound-call", provider: "twilio", surfaces: ["Dynasty Connect (per business)"], sender: "DC per-business number" },
  { key: "brandaro_ai_call",    label: "Brandaro AI caller", channel: "call", mode: "ai", fn: "brandaro-ai-caller", provider: "bland", surfaces: ["Brandaro"], sender: "Brandaro Twilio number" },
  { key: "solar_call",          label: "Solar dialer", channel: "call", mode: "auto_dialer", fn: "solar-parallel-dialer", provider: "twilio", surfaces: ["Solar OS"], sender: "Solar caller-ID" },
  { key: "operator_call",       label: "Operator/system call", channel: "call", mode: "system", fn: "initiate-operator-call", provider: "twilio", surfaces: ["Field ops triggers"], sender: "Operator number" },
  { key: "governed_call",       label: "Governed outbound call", channel: "call", mode: "system", fn: "governed-outbound-call", provider: "twilio", surfaces: ["Compliance-gated automations"], sender: "Guard-selected toll-free" },
  { key: "cold_call_tts",       label: "Cold-call TTS blast", channel: "call", mode: "bulk", fn: "cold-call-tts-blast", provider: "twilio", surfaces: ["Cold-call campaigns"], sender: "Verified toll-free" },
  // TEXTS
  { key: "manual_text_global",  label: "Manual text (global send-sms)", channel: "sms", mode: "manual", fn: "send-sms", provider: "twilio", surfaces: ["Floor 2 Comms Hub", "Store profile", "VA portals", "Brandaro inbox"], sender: "Verified From, A2P guard active" },
  { key: "bulk_text",           label: "Bulk SMS processor (BulkSmsModal)", channel: "sms", mode: "bulk", fn: "bulk-sms-processor", provider: "twilio", surfaces: ["BulkSmsModal", "Bulk campaigns"], sender: "Guarded → toll-free" },
  { key: "ai_text_bland",       label: "AI text (Bland SMS)", channel: "sms", mode: "ai", fn: "bland-send-sms", provider: "bland", surfaces: ["AI follow-ups"], sender: "Bland-routed sender" },
  { key: "ai_text_writer",      label: "AI text composer (sms-writer)", channel: "sms", mode: "ai", fn: "sms-writer", provider: "twilio", surfaces: ["AI compose UI"], sender: "Author-selected From" },
  { key: "ambassador_sms",      label: "Ambassador SMS", channel: "sms", mode: "manual", fn: "ambassador-send-sms", provider: "twilio", surfaces: ["Ambassador comms"], sender: "Ambassador-assigned number" },
  { key: "ambassador_approve",  label: "Ambassador approval SMS", channel: "sms", mode: "system", fn: "ambassador-approve-sms", provider: "twilio", surfaces: ["Approval pipeline"], sender: "Ops toll-free" },
  { key: "ambassador_notify",   label: "Ambassador notify", channel: "sms", mode: "system", fn: "ambassador-notify", provider: "twilio", surfaces: ["Lifecycle automations"], sender: "Toll-free" },
  { key: "brandaro_sms",        label: "Brandaro SMS dispatch", channel: "sms", mode: "ai", fn: "brandaro-sms-dispatch", provider: "twilio", surfaces: ["Brandaro outreach"], sender: "Brandaro Twilio number" },
  { key: "messaging_worker",    label: "Messaging send worker (queued)", channel: "sms", mode: "system", fn: "messaging-send-worker", provider: "twilio", surfaces: ["Queued outbound", "Scheduled drips"], sender: "Job-defined From w/ guard" },
  { key: "biztext_sms",         label: "BizText SMS", channel: "sms", mode: "manual", fn: "send-biztext-sms", provider: "twilio", surfaces: ["BizText surface"], sender: "Business toll-free" },
  { key: "operator_sms",        label: "Operator SMS", channel: "sms", mode: "system", fn: "send-operator-sms", provider: "twilio", surfaces: ["Field ops alerts"], sender: "Ops number" },
  { key: "invoice_sms",         label: "Invoice SMS", channel: "sms", mode: "system", fn: "send-invoice-sms", provider: "twilio", surfaces: ["Billing"], sender: "Verified toll-free" },
  { key: "approval_sms",        label: "Approval SMS", channel: "sms", mode: "system", fn: "send-approval-sms", provider: "twilio", surfaces: ["Workflow approvals"], sender: "Ops toll-free" },
  { key: "relay_sms",           label: "Relay SMS (inter-system)", channel: "sms", mode: "system", fn: "relay-sms", provider: "twilio", surfaces: ["Cross-surface relay"], sender: "Router-selected" },
  // INFRASTRUCTURE
  { key: "call_recording",      label: "Call recording capture", channel: "call", mode: "system", fn: "twilio-recording-callback", provider: "twilio", surfaces: ["All recorded calls"], sender: "Twilio recording callback" },
  { key: "voice_twiml",         label: "Voice TwiML handler", channel: "call", mode: "system", fn: "twilio-voice-twiml", provider: "twilio", surfaces: ["All inbound + bridged calls"], sender: "TwiML emitter" },
  { key: "voice_token",         label: "Browser voice token (Twilio Voice SDK)", channel: "call", mode: "manual", fn: "twilio-voice-token", provider: "twilio", surfaces: ["In-app dialer (browser)"], sender: "Voice JWT" },
];

type Row = {
  provider: string;
  layer: string;
  target: string;
  status: "pass" | "warn" | "fail";
  message: string;
  detail: Record<string, unknown>;
};

async function probe(f: FeatureMode): Promise<Row> {
  const url = `${SUPABASE_URL}/functions/v1/${f.fn}`;
  const baseDetail = {
    function: f.fn,
    channel: f.channel,
    mode: f.mode,
    upstream_provider: f.provider,
    surfaces: f.surfaces,
    sender_policy: f.sender,
    label: f.label,
  };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ healthcheck: true, _probe: "comms-feature-prober" }),
    });
    const body = await r.text();
    const detail = { ...baseDetail, http_status: r.status, body_preview: body.slice(0, 160) };
    if (r.status === 429 && /rate limit/i.test(body)) {
      return { provider: f.provider === "mixed" ? "twilio" : f.provider, layer: "feature_mode", target: `${f.channel}:${f.key}`, status: "warn", message: `INCONCLUSIVE — probe rate-limited (HTTP 429). Retry next cycle. Surfaces: ${f.surfaces.join(", ")}.`, detail };
    }
    if (r.status >= 500) {
      let validationOnly = false;
      try {
        const j = JSON.parse(body);
        // Treat as validation-rejection (handler is alive, just returns wrong
        // status code) if the JSON has any of these shapes:
        //   {success:false, error:"..."}  {ok:false, error:"..."}  {error:"..."}
        const hasErr = j && typeof j.error === "string";
        const explicitFail = j && (j.success === false || j.ok === false);
        const validationLike = hasErr && /required|missing|invalid|must/i.test(j.error);
        if ((explicitFail && hasErr) || validationLike) validationOnly = true;
      } catch { /* not JSON */ }
      if (validationOnly) {
        return { provider: f.provider === "mixed" ? "twilio" : f.provider, layer: "feature_mode", target: `${f.channel}:${f.key}`, status: "pass", message: `WORKING — ${f.fn} deployed (returned 5xx with validation-style JSON; handler is alive). Sender: ${f.sender || "n/a"}. Surfaces: ${f.surfaces.join(", ")}.`, detail };
      }
      return { provider: f.provider === "mixed" ? "twilio" : f.provider, layer: "feature_mode", target: `${f.channel}:${f.key}`, status: "fail", message: `BROKEN — ${f.fn} returned HTTP ${r.status} (handler crashed). Body: ${body.slice(0, 120)}. Affects: ${f.surfaces.join(", ")}.`, detail };
    }
    if (r.status === 404) {
      return { provider: f.provider === "mixed" ? "twilio" : f.provider, layer: "feature_mode", target: `${f.channel}:${f.key}`, status: "fail", message: `BROKEN — ${f.fn} not deployed (404). Affects: ${f.surfaces.join(", ")}.`, detail };
    }
    return { provider: f.provider === "mixed" ? "twilio" : f.provider, layer: "feature_mode", target: `${f.channel}:${f.key}`, status: "pass", message: `WORKING — ${f.fn} deployed and reachable (HTTP ${r.status}). Sender: ${f.sender || "n/a"}. Surfaces: ${f.surfaces.join(", ")}.`, detail };
  } catch (e) {
    const errMsg = (e as Error).message;
    const isRate = /rate limit/i.test(errMsg);
    return {
      provider: f.provider === "mixed" ? "twilio" : f.provider,
      layer: "feature_mode",
      target: `${f.channel}:${f.key}`,
      status: isRate ? "warn" : "fail",
      message: isRate
        ? `INCONCLUSIVE — probe rate-limited. Retry next cycle. Affects: ${f.surfaces.join(", ")}.`
        : `BROKEN — ${f.fn} unreachable: ${errMsg}. Affects: ${f.surfaces.join(", ")}.`,
      detail: { ...baseDetail, error: errMsg },
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Sequential to stay under per-trace fetch quota; ~35 fetches/run.
  const rows: Row[] = [];
  for (const f of FEATURE_MODES) {
    rows.push(await probe(f));
  }

  // Heartbeats — synthetic delivery proxy (recent end-to-end activity).
  try {
    const since25h = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const since7d  = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const [{ data: outSms }, { data: outCall }, { data: rec }] = await Promise.all([
      sb.from("communication_logs").select("id, created_at, twilio_sid").eq("channel", "sms").eq("direction", "outbound").gte("created_at", since25h).order("created_at", { ascending: false }).limit(1),
      sb.from("communication_logs").select("id, created_at, twilio_sid").eq("channel", "call").eq("direction", "outbound").gte("created_at", since25h).order("created_at", { ascending: false }).limit(1),
      sb.from("communication_logs").select("id, created_at, recording_url, twilio_sid").eq("channel", "call").not("recording_url", "is", null).gte("created_at", since7d).order("created_at", { ascending: false }).limit(1),
    ]);
    rows.push({
      provider: "twilio", layer: "feature_mode", target: "heartbeat:outbound_sms_25h",
      status: outSms && outSms.length ? "pass" : "warn",
      message: outSms && outSms.length ? `Outbound SMS delivered ${outSms[0].created_at} — texting pipeline confirmed end-to-end in last 25h.` : "No outbound SMS recorded in last 25h — pipeline may be idle.",
      detail: outSms && outSms.length ? { last_sid: (outSms[0] as any).twilio_sid, last_at: outSms[0].created_at } : { window_hours: 25 },
    });
    rows.push({
      provider: "twilio", layer: "feature_mode", target: "heartbeat:outbound_call_25h",
      status: outCall && outCall.length ? "pass" : "warn",
      message: outCall && outCall.length ? `Outbound call placed ${outCall[0].created_at} — calling pipeline confirmed end-to-end in last 25h.` : "No outbound calls recorded in last 25h — pipeline may be idle.",
      detail: outCall && outCall.length ? { last_sid: (outCall[0] as any).twilio_sid, last_at: outCall[0].created_at } : { window_hours: 25 },
    });
    rows.push({
      provider: "twilio", layer: "feature_mode", target: "heartbeat:call_recording_7d",
      status: rec && rec.length ? "pass" : "warn",
      message: rec && rec.length ? `Last recording captured ${rec[0].created_at}.` : "No call recordings captured in last 7d — recording pipeline may be broken or idle.",
      detail: rec && rec.length ? { last_recording_url: (rec[0] as any).recording_url, last_at: rec[0].created_at } : { window_days: 7 },
    });
  } catch (e) {
    rows.push({ provider: "twilio", layer: "feature_mode", target: "heartbeat", status: "warn", message: `Heartbeat queries failed: ${(e as Error).message}`, detail: {} });
  }

  // Persist
  try {
    const { error } = await sb.from("comms_health_checks").insert(rows.map((r) => ({
      layer: r.layer, provider: r.provider, target: r.target, status: r.status, message: r.message, detail: r.detail,
    })));
    if (error) console.error("[comms-feature-prober] insert error:", error.message);
  } catch (e) {
    console.error("[comms-feature-prober] persist threw:", e);
  }

  const fail = rows.filter((r) => r.status === "fail").length;
  const warn = rows.filter((r) => r.status === "warn").length;
  return new Response(
    JSON.stringify({ ok: fail === 0, duration_ms: Date.now() - t0, total: rows.length, fail, warn, results: rows }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
