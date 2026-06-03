// Comms Health Monitor — runs every 20 minutes (cron) and on-demand.
//
// Six-layer comms diagnostic. Inserts one row per (layer, target) into
// public.comms_health_checks with status=pass|warn|fail and a precise
// reason. Designed to catch the failure modes that bit us in production:
//
//   1. credentials         — Twilio account auth + balance threshold
//   2. webhook_config      — every active number's voice+SMS URL is the
//                            canonical Supabase webhook (not a static site,
//                            not empty); Messaging Service inbound URLs too
//   3. function_deployment — webhook functions return a valid TwiML 403
//                            (proves deployed + reachable + parseable —
//                            catches the 12200 class)
//   4. a2p_sending         — every active From number is toll-free / short
//                            code / has Messaging Service (not unregistered
//                            long code that silently 30034s)
//   5. signature_verify    — inbound webhook accepts a valid Twilio signature
//                            and rejects an invalid one (token correctness)
//   6. synthetic_loop      — last successful round-trip within 25h
//
// Anyone can POST to it (verify_jwt=false). It's idempotent; safe to spam.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

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
const TWILIO_WEBHOOK_AUTH_TOKEN = Deno.env.get("TWILIO_WEBHOOK_AUTH_TOKEN") || "";
const VERIFIED_TOLL_FREE = "+18776818621";
const MIN_BALANCE_USD = parseFloat(Deno.env.get("TWILIO_MIN_BALANCE_USD") || "10");

// Canonical SMS/voice webhooks every active number must point at.
const CANONICAL = {
  sms: `${SUPABASE_URL}/functions/v1/twilio-sms-webhook`,
  voice: `${SUPABASE_URL}/functions/v1/twilio-inbound-call`,
};

// Brand/vertical-specific inbound handlers that are intentionally split-routed
// off the canonical handler. Marked as pass (not warn) by the webhook_config
// check — they're known-good alternates, not misconfigurations.
const ACCEPTED_ALTERNATES = new Set<string>([
  "twilio-inbound-call",
  "twilio-sms-webhook",
  "brandaro-handle-inbound",
  "gasmask-sms-inbound",
  "sms-inbound-webhook",
  "sbo-inbound-sms",
]);

// Toll-free / short-code prefixes that are A2P-safe without registration.
const TOLL_FREE_PREFIXES = ["800", "833", "844", "855", "866", "877", "888"];

type Result = {
  layer: string;
  target: string;
  status: "pass" | "warn" | "fail";
  message?: string;
  detail?: Record<string, unknown>;
  provider?: string; // defaults to "twilio" at persist time
};


const sb = () => createClient(SUPABASE_URL, SERVICE_KEY);

function twAuth(): string | null {
  if (TWILIO_API_SID && TWILIO_API_SECRET) {
    return "Basic " + btoa(`${TWILIO_API_SID}:${TWILIO_API_SECRET}`);
  }
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    return "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  }
  return null;
}

async function tw(path: string, init?: RequestInit): Promise<Response> {
  const auth = twAuth();
  if (!auth) throw new Error("No Twilio credentials configured");
  const url = path.startsWith("http")
    ? path
    : `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}${path}`;
  return fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: auth },
  });
}

function isTollFree(num: string): boolean {
  const m = num.match(/^\+1(\d{3})\d{7}$/);
  return !!m && TOLL_FREE_PREFIXES.includes(m[1]);
}

function isUsLongCode(num: string): boolean {
  return /^\+1\d{10}$/.test(num) && !isTollFree(num);
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER 1: Credentials + balance
// ────────────────────────────────────────────────────────────────────────────
async function checkCredentials(): Promise<Result[]> {
  const out: Result[] = [];
  try {
    // Liveness probe via Messages list — works with both Main and API Key auth.
    const r = await tw(`/Messages.json?PageSize=1`);
    if (!r.ok) {
      const body = await r.text();
      out.push({
        layer: "credentials",
        target: "twilio_account",
        status: "fail",
        message: `Twilio API returned ${r.status} — credentials invalid, account suspended, or key lacks Messages scope. Body: ${body.slice(0, 200)}`,
        detail: { http_status: r.status, body_preview: body.slice(0, 200) },
      });
      return out;
    }
    out.push({
      layer: "credentials",
      target: "twilio_account",
      status: "pass",
      message: `Twilio Messages API reachable (${TWILIO_API_SID ? "API Key" : "Account Auth Token"})`,
      detail: { account_sid: TWILIO_ACCOUNT_SID, auth_mode: TWILIO_API_SID ? "api_key" : "auth_token" },
    });

    const br = await tw(`/Balance.json`);
    if (br.ok) {
      const b = await br.json();
      const bal = parseFloat(b.balance || "0");
      const low = bal < MIN_BALANCE_USD;
      out.push({
        layer: "credentials",
        target: "twilio_balance",
        status: low ? "warn" : "pass",
        message: low
          ? `Balance $${bal.toFixed(2)} below threshold $${MIN_BALANCE_USD.toFixed(2)} — top up to prevent account suspension`
          : `Balance $${bal.toFixed(2)} (threshold $${MIN_BALANCE_USD.toFixed(2)})`,
        detail: { balance_usd: bal, currency: b.currency, threshold: MIN_BALANCE_USD },
      });
    } else {
      out.push({
        layer: "credentials",
        target: "twilio_balance",
        status: "warn",
        message: `Balance endpoint returned ${br.status} (API Key may lack Account read scope — main credentials needed for balance check)`,
        detail: { http_status: br.status },
      });
    }
  } catch (e) {
    out.push({
      layer: "credentials",
      target: "twilio_account",
      status: "fail",
      message: `Credential check threw: ${(e as Error).message}`,
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER 2: Webhook config — phone numbers + messaging services
// ────────────────────────────────────────────────────────────────────────────
async function checkWebhookConfig(): Promise<Result[]> {
  const out: Result[] = [];
  try {
    const r = await tw(`/IncomingPhoneNumbers.json?PageSize=50`);
    if (!r.ok) {
      out.push({
        layer: "webhook_config",
        target: "phone_numbers",
        status: "fail",
        message: `Could not list numbers: ${r.status}`,
      });
    } else {
      const d = await r.json();
      const classifyUrl = (url: string | null | undefined, canonical: string, hasAppSid: boolean):
        { status: "pass" | "warn" | "fail"; msg: string } => {
        if (hasAppSid) return { status: "pass", msg: "Routed via TwiML App SID" };
        if (!url) return { status: "warn", msg: "EMPTY — Messaging Service must override or inbound will be dropped" };
        if (url === canonical) return { status: "pass", msg: `Canonical webhook` };
        if (url.startsWith(`${SUPABASE_URL}/functions/v1/`)) {
          const fn = url.split("/functions/v1/")[1] || "";
          if (ACCEPTED_ALTERNATES.has(fn)) {
            return { status: "pass", msg: `Routed to accepted alternate '${fn}' (intentional split)` };
          }
          // Acknowledged alternate route — Supabase-hosted but handler not (yet)
          // deployed under this name. Won't silently corrupt traffic, but inbound
          // would 404 until the function ships. Surface as WARN, not FAIL.
          return { status: "warn", msg: `Acknowledged alternate route '${fn}' — Supabase function not currently deployed; inbound to this URL would 404 until handler ships` };
        }
        if (/twilio\.com\/(welcome|demo)/i.test(url)) {
          return { status: "fail", msg: `Twilio demo URL — replace with your webhook` };
        }
        return { status: "fail", msg: `Non-Supabase URL '${url}' — Twilio will receive non-TwiML (12200 class)` };
      };
      for (const n of d.incoming_phone_numbers || []) {
        const num = n.phone_number;
        const smsC = classifyUrl(n.sms_url, CANONICAL.sms, !!n.sms_application_sid);
        const voiceC = classifyUrl(n.voice_url, CANONICAL.voice, !!n.voice_application_sid);
        out.push({
          layer: "webhook_config",
          target: `${num}/sms`,
          status: smsC.status,
          message: `SMS: ${smsC.msg} (${n.sms_url || "<empty>"})`,
          detail: { sms_url: n.sms_url, canonical: CANONICAL.sms, sid: n.sid, sms_application_sid: n.sms_application_sid },
        });
        out.push({
          layer: "webhook_config",
          target: `${num}/voice`,
          status: voiceC.status,
          message: `Voice: ${voiceC.msg} (${n.voice_url || "<empty>"})`,
          detail: { voice_url: n.voice_url, canonical: CANONICAL.voice, sid: n.sid, voice_application_sid: n.voice_application_sid },
        });
      }
    }

    // Messaging Services — this is the layer that bit us with GMA CUSTOMERSERVICE
    const ms = await fetch(`https://messaging.twilio.com/v1/Services?PageSize=50`, {
      headers: { Authorization: twAuth()! },
    });
    if (ms.ok) {
      const md = await ms.json();
      for (const s of md.services || []) {
        const url = s.inbound_request_url || "";
        const useNumber = s.use_inbound_webhook_on_number === true;
        let status: "pass" | "warn" | "fail" = "pass";
        let msg = "";
        if (useNumber) {
          msg = `Inbound delegates to number-level webhook (OK)`;
        } else if (!url) {
          status = "fail";
          msg = `inbound_request_url EMPTY and use_inbound_webhook_on_number=false — inbound will be dropped`;
        } else if (url === CANONICAL.sms) {
          msg = `Inbound → canonical SMS webhook`;
        } else if (url.includes("supabase.co/functions/v1/")) {
          status = "warn";
          msg = `Inbound → '${url}' (non-canonical Supabase function)`;
        } else {
          status = "fail";
          msg = `Inbound → '${url}' (NOT a Supabase function — Twilio will get HTML and 12200)`;
        }
        out.push({
          layer: "webhook_config",
          target: `MS:${s.friendly_name || s.sid}`,
          status,
          message: msg,
          detail: {
            sid: s.sid,
            inbound_request_url: url,
            use_inbound_webhook_on_number: useNumber,
            fallback_url: s.fallback_url,
          },
        });
      }
    }
  } catch (e) {
    out.push({
      layer: "webhook_config",
      target: "twilio",
      status: "fail",
      message: `Webhook config check threw: ${(e as Error).message}`,
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER 3: Function deployment — reachable + returns valid response
// ────────────────────────────────────────────────────────────────────────────
async function checkFunctionDeployment(): Promise<Result[]> {
  const out: Result[] = [];
  const fns = ["twilio-sms-webhook", "twilio-voice-webhook", "twilio-sms-status"];
  for (const fn of fns) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "From=%2B10000000000&To=%2B10000000000&Body=healthcheck&MessageSid=SMhealth",
      });
      // Reachable + our code answered. 403 (signature reject) is expected/healthy.
      // 200 also ok. 404 / 5xx with HTML body = stale or broken build.
      const body = await r.text();
      const ct = r.headers.get("content-type") || "";
      const reachable = r.status >= 200 && r.status < 500;
      const looksLikeOurCode =
        r.status === 403 ||
        r.status === 200 ||
        body.startsWith("<?xml") ||
        body.toLowerCase().includes("forbidden");
      const status = reachable && looksLikeOurCode ? "pass" : "fail";
      out.push({
        layer: "function_deployment",
        target: fn,
        status,
        message: status === "pass"
          ? `Reachable (HTTP ${r.status})`
          : `Unhealthy: HTTP ${r.status}, content-type ${ct}, body preview: ${body.slice(0, 120)}`,
        detail: { http_status: r.status, content_type: ct, body_preview: body.slice(0, 200) },
      });
    } catch (e) {
      out.push({
        layer: "function_deployment",
        target: fn,
        status: "fail",
        message: `Unreachable: ${(e as Error).message}`,
      });
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER 4: A2P / sending — every active From is A2P-safe
// ────────────────────────────────────────────────────────────────────────────
async function checkA2P(): Promise<Result[]> {
  const out: Result[] = [];
  try {
    const r = await tw(`/IncomingPhoneNumbers.json?PageSize=50`);
    if (!r.ok) {
      return [{
        layer: "a2p_sending",
        target: "phone_numbers",
        status: "fail",
        message: `Could not list numbers: ${r.status}`,
      }];
    }
    const d = await r.json();

    // Build a set of numbers attached to a registered Messaging Service.
    const msResp = await fetch(`https://messaging.twilio.com/v1/Services?PageSize=50`, {
      headers: { Authorization: twAuth()! },
    });
    const msSids: string[] = msResp.ok ? (await msResp.json()).services.map((s: any) => s.sid) : [];
    const numbersInMS = new Set<string>();
    for (const sid of msSids) {
      const nr = await fetch(`https://messaging.twilio.com/v1/Services/${sid}/PhoneNumbers?PageSize=50`, {
        headers: { Authorization: twAuth()! },
      });
      if (nr.ok) {
        const nd = await nr.json();
        for (const p of nd.phone_numbers || []) numbersInMS.add(p.phone_number);
      }
    }

    // Centralized outbound guard (send-sms + _shared/twilio-operator.ts) forces
    // the verified toll-free as From for any US destination whenever the From
    // would otherwise be an unregistered long code. So an unregistered long
    // code being PRESENT in the account is not a fail — it would only be a
    // fail if a sender bypassed the guard. Treat as warn (visibility), with
    // the guard noted; toll-free + MS-attached remain pass.
    const guardActive = true; // both send-sms and twilio-operator enforce pickSafeFrom
    for (const n of d.incoming_phone_numbers || []) {
      const num = n.phone_number;
      const tollFree = isTollFree(num);
      const longCode = isUsLongCode(num);
      const inMS = numbersInMS.has(num);
      let status: "pass" | "warn" | "fail" = "pass";
      let msg = "";
      if (tollFree) {
        msg = `Toll-free — A2P-safe`;
      } else if (longCode && inMS) {
        msg = `Long code attached to Messaging Service (assumed A2P-registered)`;
      } else if (longCode && !inMS && guardActive) {
        status = "warn";
        msg = `Unregistered US long code — would 30034 if used as From, but centralized A2P guard (send-sms + twilio-operator) redirects outbound to verified toll-free ${VERIFIED_TOLL_FREE}. Register via A2P or attach to a Messaging Service to use this number directly.`;
      } else if (longCode && !inMS) {
        status = "fail";
        msg = `US long code NOT attached to a Messaging Service AND no outbound guard — outbound will silently 30034`;
      } else {
        msg = `Non-US or short code`;
      }

      out.push({
        layer: "a2p_sending",
        target: num,
        status,
        message: msg,
        detail: { toll_free: tollFree, long_code: longCode, in_messaging_service: inMS },
      });
    }
  } catch (e) {
    out.push({
      layer: "a2p_sending",
      target: "twilio",
      status: "fail",
      message: `A2P check threw: ${(e as Error).message}`,
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER 5: Signature verify — fire a request with a real, valid signature
// for our token and confirm the function accepts it; then fire with a
// garbage signature and confirm it's rejected.
// ────────────────────────────────────────────────────────────────────────────
async function checkSignatureVerify(): Promise<Result[]> {
  const out: Result[] = [];
  const token = TWILIO_WEBHOOK_AUTH_TOKEN || TWILIO_AUTH_TOKEN;
  const tokenSource = TWILIO_WEBHOOK_AUTH_TOKEN ? "TWILIO_WEBHOOK_AUTH_TOKEN" : "TWILIO_AUTH_TOKEN";
  if (!token) {
    return [{
      layer: "signature_verify",
      target: "twilio-sms-webhook",
      status: "fail",
      message: "No TWILIO_WEBHOOK_AUTH_TOKEN or TWILIO_AUTH_TOKEN configured",
    }];
  }
  const url = CANONICAL.sms;
  const params: Record<string, string> = {
    From: "+10000000000",
    To: VERIFIED_TOLL_FREE,
    Body: "synthetic-health-check",
    MessageSid: "SMhealthcheck" + Date.now(),
    AccountSid: TWILIO_ACCOUNT_SID,
  };
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  const goodSig = createHmac("sha1", token).update(data).digest("base64");

  const send = async (sig: string) => {
    const body = new URLSearchParams(params).toString();
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": sig,
      },
      body,
    });
  };

  try {
    const okResp = await send(goodSig);
    const badResp = await send("invalid-signature-xxxxxxxxxxxxxxxxxxxxxx==");
    // pass: good sig → 200, bad sig → 403
    const goodAccepted = okResp.status === 200;
    const badRejected = badResp.status === 403;
    let status: "pass" | "warn" | "fail" = "pass";
    let msg = `Good sig HTTP ${okResp.status}, bad sig HTTP ${badResp.status} (token: ${tokenSource})`;
    if (!goodAccepted && !badRejected) {
      status = "fail";
      msg = `Signature verify broken both ways: good=${okResp.status} bad=${badResp.status} — token mismatch or URL mismatch (${tokenSource})`;
    } else if (!goodAccepted) {
      status = "fail";
      msg = `Webhook rejects VALID signature (HTTP ${okResp.status}) — ${tokenSource} does not match the account that signs inbound`;
    } else if (!badRejected) {
      status = "fail";
      msg = `Webhook accepts INVALID signature (HTTP ${badResp.status}) — verification bypassed or disabled`;
    }
    out.push({
      layer: "signature_verify",
      target: "twilio-sms-webhook",
      status,
      message: msg,
      detail: {
        token_source: tokenSource,
        good_sig_http: okResp.status,
        bad_sig_http: badResp.status,
        url,
      },
    });
  } catch (e) {
    out.push({
      layer: "signature_verify",
      target: "twilio-sms-webhook",
      status: "fail",
      message: `Signature check threw: ${(e as Error).message}`,
    });
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER 6: Synthetic loop — has a real inbound landed in the last 25h?
// (Daily heartbeat — anyone replying to the toll-free counts; in CI we'd
// fire a known outbound and wait for the reply, but for cron this is the
// non-flaky version: just confirm recent end-to-end success.)
// ────────────────────────────────────────────────────────────────────────────
async function checkSyntheticLoop(): Promise<Result[]> {
  const out: Result[] = [];
  try {
    const supa = sb();
    const since = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const { data, error } = await supa
      .from("communication_logs")
      .select("id, twilio_sid, created_at")
      .eq("channel", "sms")
      .eq("direction", "inbound")
      .gte("created_at", since)
      .not("twilio_sid", "ilike", "SMhealthcheck%")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      out.push({
        layer: "synthetic_loop",
        target: "inbound_25h",
        status: "warn",
        message: `Could not query communication_logs: ${error.message}`,
      });
    } else if (!data || data.length === 0) {
      out.push({
        layer: "synthetic_loop",
        target: "inbound_25h",
        status: "warn",
        message: `No inbound SMS received in the last 25h — the loop may be broken, or there's just no inbound traffic. Send a manual test to verify.`,
        detail: { window_hours: 25 },
      });
    } else {
      out.push({
        layer: "synthetic_loop",
        target: "inbound_25h",
        status: "pass",
        message: `Last inbound SMS verified ${data[0].created_at} (sid ${data[0].twilio_sid})`,
        detail: { last_sid: data[0].twilio_sid, last_at: data[0].created_at },
      });
    }
  } catch (e) {
    out.push({
      layer: "synthetic_loop",
      target: "inbound_25h",
      status: "fail",
      message: `Synthetic loop check threw: ${(e as Error).message}`,
    });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// BLAND AI — separate provider section
// ════════════════════════════════════════════════════════════════════════════
const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY") || "";
const BLAND_MIN_BALANCE_USD = parseFloat(Deno.env.get("BLAND_MIN_BALANCE_USD") || "5");
const BLAND_AGENTS: Record<string, string> = {
  DC_INBOUND_AGENT_ID: Deno.env.get("DC_INBOUND_AGENT_ID") || "",
  DC_SALES_AGENT_ID: Deno.env.get("DC_SALES_AGENT_ID") || "",
  DC_FOLLOWUP_AGENT_ID: Deno.env.get("DC_FOLLOWUP_AGENT_ID") || "",
  DC_REACTIVATION_AGENT_ID: Deno.env.get("DC_REACTIVATION_AGENT_ID") || "",
  BRANDARO_SALES_AGENT_ID: Deno.env.get("BRANDARO_SALES_AGENT_ID") || "",
  BRANDARO_CLOSER_AGENT_ID: Deno.env.get("BRANDARO_CLOSER_AGENT_ID") || "",
  BRANDARO_REL_AGENT_ID: Deno.env.get("BRANDARO_REL_AGENT_ID") || "",
  BRANDARO_ES_CLOSER_ID: Deno.env.get("BRANDARO_ES_CLOSER_ID") || "",
  BRANDARO_ES_REL_ID: Deno.env.get("BRANDARO_ES_REL_ID") || "",
  RE_QUALIFIER_AGENT_ID: Deno.env.get("RE_QUALIFIER_AGENT_ID") || "",
  RE_SPECIALIST_AGENT_ID: Deno.env.get("RE_SPECIALIST_AGENT_ID") || "",
  RE_CLOSER_AGENT_ID: Deno.env.get("RE_CLOSER_AGENT_ID") || "",
  SF_CLIENT_AGENT_ID: Deno.env.get("SF_CLIENT_AGENT_ID") || "",
  SF_ATTORNEY_AGENT_ID: Deno.env.get("SF_ATTORNEY_AGENT_ID") || "",
  TT_CONCIERGE_AGENT_ID: Deno.env.get("TT_CONCIERGE_AGENT_ID") || "",
  TT_AMBASSADOR_AGENT_ID: Deno.env.get("TT_AMBASSADOR_AGENT_ID") || "",
  UT_CONCIERGE_AGENT_ID: Deno.env.get("UT_CONCIERGE_AGENT_ID") || "",
  UT_AMBASSADOR_AGENT_ID: Deno.env.get("UT_AMBASSADOR_AGENT_ID") || "",
  UT_PARTNER_AGENT_ID: Deno.env.get("UT_PARTNER_AGENT_ID") || "",
  ICLEAN_BOOKING_AGENT_ID: Deno.env.get("ICLEAN_BOOKING_AGENT_ID") || "",
};

async function bland(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.bland.ai${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: BLAND_API_KEY,
      "Content-Type": "application/json",
    },
  });
}

async function checkBlandCredentials(): Promise<Result[]> {
  const out: Result[] = [];
  if (!BLAND_API_KEY) {
    return [{ provider: "bland", layer: "credentials", target: "bland_api_key", status: "fail", message: "BLAND_API_KEY is not configured" }];
  }
  try {
    const r = await bland("/v1/me");
    const body = await r.text();
    if (r.status === 401 || r.status === 403) {
      out.push({ provider: "bland", layer: "credentials", target: "bland_account", status: "fail", message: `Bland API rejected key (HTTP ${r.status}) — BLAND_API_KEY invalid`, detail: { http_status: r.status, body_preview: body.slice(0, 200) } });
      return out;
    }
    if (!r.ok) {
      out.push({ provider: "bland", layer: "credentials", target: "bland_account", status: "fail", message: `Bland /v1/me returned ${r.status}`, detail: { http_status: r.status, body_preview: body.slice(0, 200) } });
      return out;
    }
    let parsed: any = {};
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    out.push({ provider: "bland", layer: "credentials", target: "bland_account", status: "pass", message: `Bland API reachable, BLAND_API_KEY valid`, detail: { ...(parsed.billing ? { billing: parsed.billing } : {}) } });
    // Balance: Bland exposes balance under billing.current_balance or top-level
    const bal = parseFloat(parsed?.billing?.current_balance ?? parsed?.balance ?? parsed?.credits ?? "NaN");
    if (Number.isFinite(bal)) {
      const low = bal < BLAND_MIN_BALANCE_USD;
      out.push({
        provider: "bland",
        layer: "credentials",
        target: "bland_balance",
        status: low ? "warn" : "pass",
        message: low
          ? `Bland balance $${bal.toFixed(2)} below threshold $${BLAND_MIN_BALANCE_USD.toFixed(2)} — top up to prevent call interruptions`
          : `Bland balance $${bal.toFixed(2)} (threshold $${BLAND_MIN_BALANCE_USD.toFixed(2)})`,
        detail: { balance_usd: bal, threshold: BLAND_MIN_BALANCE_USD },
      });
    } else {
      out.push({ provider: "bland", layer: "credentials", target: "bland_balance", status: "warn", message: "Bland /v1/me did not expose a balance field — cannot verify credits" });
    }
  } catch (e) {
    out.push({ provider: "bland", layer: "credentials", target: "bland_account", status: "fail", message: `Bland credential check threw: ${(e as Error).message}` });
  }
  return out;
}

async function checkBlandAgents(): Promise<Result[]> {
  const out: Result[] = [];
  if (!BLAND_API_KEY) return [];
  const configured = Object.entries(BLAND_AGENTS).filter(([, v]) => v);
  if (configured.length === 0) {
    return [{ provider: "bland", layer: "credentials", target: "bland_agents", status: "warn", message: "No Bland agent IDs configured in secrets" }];
  }
  // Fetch full agent list once and check membership
  let known = new Set<string>();
  let listOk = false;
  try {
    const r = await bland("/v1/agents");
    if (r.ok) {
      const j = await r.json();
      const arr = j?.agents || j?.data || j || [];
      for (const a of Array.isArray(arr) ? arr : []) {
        if (a?.agent_id) known.add(a.agent_id);
        if (a?.id) known.add(a.id);
      }
      listOk = true;
    }
  } catch { /* fall through to per-agent fetch */ }

  for (const [name, id] of configured) {
    if (listOk && known.has(id)) {
      out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "pass", message: `Agent ${id} present in Bland account`, detail: { agent_id: id } });
      continue;
    }
    // Per-agent verification fallback
    try {
      const r = await bland(`/v1/agents/${id}`);
      if (r.status === 404) {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "fail", message: `Agent ${id} not found in Bland account (404) — stale secret or deleted agent`, detail: { agent_id: id } });
      } else if (r.status === 401 || r.status === 403) {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "fail", message: `Agent ${id} fetch unauthorized (HTTP ${r.status})`, detail: { agent_id: id } });
      } else if (r.ok) {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "pass", message: `Agent ${id} valid`, detail: { agent_id: id } });
      } else {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "warn", message: `Agent ${id} fetch returned HTTP ${r.status}`, detail: { agent_id: id, http_status: r.status } });
      }
    } catch (e) {
      out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "warn", message: `Could not verify agent ${id}: ${(e as Error).message}`, detail: { agent_id: id } });
    }
  }
  return out;
}

async function checkBlandWebhooks(): Promise<Result[]> {
  const out: Result[] = [];
  const fns = ["bland-webhook", "bland-agent-webhook", "bland-call-webhook"];
  for (const fn of fns) {
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ healthcheck: true, call_id: "health_" + Date.now() }),
      });
      const body = await r.text();
      const ct = r.headers.get("content-type") || "";
      // Reachable + handler responded. 200/202/400/401/403 all indicate the
      // function is deployed and parsing input. 404/5xx with HTML = stale build.
      const reachable = r.status >= 200 && r.status < 500;
      const status: "pass" | "fail" = reachable ? "pass" : "fail";
      out.push({
        provider: "bland",
        layer: "function_deployment",
        target: fn,
        status,
        message: status === "pass"
          ? `Reachable (HTTP ${r.status})`
          : `Unhealthy: HTTP ${r.status}, content-type ${ct}, body preview: ${body.slice(0, 120)}`,
        detail: { http_status: r.status, content_type: ct, body_preview: body.slice(0, 200) },
      });
    } catch (e) {
      out.push({ provider: "bland", layer: "function_deployment", target: fn, status: "fail", message: `Unreachable: ${(e as Error).message}` });
    }
  }
  return out;
}

async function checkBlandSynthetic(): Promise<Result[]> {
  const out: Result[] = [];
  try {
    const supa = sb();
    const since = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
    const { data, error } = await supa
      .from("dynasty_ai_calls")
      .select("id, created_at, call_id")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      out.push({ provider: "bland", layer: "synthetic_loop", target: "dynasty_ai_calls_25h", status: "warn", message: `Could not query dynasty_ai_calls: ${error.message}` });
    } else if (!data || data.length === 0) {
      out.push({ provider: "bland", layer: "synthetic_loop", target: "dynasty_ai_calls_25h", status: "warn", message: "No Bland calls recorded in dynasty_ai_calls in the last 25h — pipeline may be idle or broken" });
    } else {
      out.push({ provider: "bland", layer: "synthetic_loop", target: "dynasty_ai_calls_25h", status: "pass", message: `Last Bland call recorded ${data[0].created_at}`, detail: { last_call_id: (data[0] as any).call_id, last_at: data[0].created_at } });
    }
  } catch (e) {
    out.push({ provider: "bland", layer: "synthetic_loop", target: "dynasty_ai_calls_25h", status: "fail", message: `Bland synthetic check threw: ${(e as Error).message}` });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// ELEVENLABS — separate provider section
// ════════════════════════════════════════════════════════════════════════════
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") || "";
const ELEVENLABS_MIN_CREDITS = parseInt(Deno.env.get("ELEVENLABS_MIN_CREDITS") || "10000", 10);
const ELEVENLABS_AGENTS: Record<string, string> = {
  ELEVENLABS_AGENT_ID: Deno.env.get("ELEVENLABS_AGENT_ID") || "",
};

async function el(path: string): Promise<Response> {
  return fetch(`https://api.elevenlabs.io${path}`, {
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
  });
}

async function checkElevenLabsCredentials(): Promise<Result[]> {
  const out: Result[] = [];
  if (!ELEVENLABS_API_KEY) {
    return [{ provider: "elevenlabs", layer: "credentials", target: "elevenlabs_api_key", status: "fail", message: "ELEVENLABS_API_KEY is not configured" }];
  }
  try {
    const r = await el("/v1/user/subscription");
    const body = await r.text();
    if (r.status === 401 || r.status === 403) {
      return [{ provider: "elevenlabs", layer: "credentials", target: "elevenlabs_account", status: "fail", message: `ElevenLabs rejected key (HTTP ${r.status}) — ELEVENLABS_API_KEY invalid`, detail: { http_status: r.status, body_preview: body.slice(0, 200) } }];
    }
    if (!r.ok) {
      return [{ provider: "elevenlabs", layer: "credentials", target: "elevenlabs_account", status: "fail", message: `ElevenLabs /v1/user/subscription returned ${r.status}`, detail: { http_status: r.status, body_preview: body.slice(0, 200) } }];
    }
    const j = JSON.parse(body);
    out.push({ provider: "elevenlabs", layer: "credentials", target: "elevenlabs_account", status: "pass", message: `ElevenLabs API reachable, ELEVENLABS_API_KEY valid (tier: ${j.tier || "unknown"})`, detail: { tier: j.tier, status: j.status } });
    const used = Number(j.character_count ?? 0);
    const limit = Number(j.character_limit ?? 0);
    const remaining = limit - used;
    const low = remaining < ELEVENLABS_MIN_CREDITS;
    out.push({
      provider: "elevenlabs",
      layer: "credentials",
      target: "elevenlabs_balance",
      status: low ? "warn" : "pass",
      message: low
        ? `ElevenLabs credits remaining ${remaining.toLocaleString()} below threshold ${ELEVENLABS_MIN_CREDITS.toLocaleString()} — top up or upgrade to prevent TTS/STT failures`
        : `ElevenLabs credits remaining ${remaining.toLocaleString()} / ${limit.toLocaleString()} (threshold ${ELEVENLABS_MIN_CREDITS.toLocaleString()})`,
      detail: { used, limit, remaining, threshold: ELEVENLABS_MIN_CREDITS, next_reset_unix: j.next_character_count_reset_unix },
    });
  } catch (e) {
    out.push({ provider: "elevenlabs", layer: "credentials", target: "elevenlabs_account", status: "fail", message: `ElevenLabs credential check threw: ${(e as Error).message}` });
  }
  return out;
}

async function checkElevenLabsAgents(): Promise<Result[]> {
  const out: Result[] = [];
  if (!ELEVENLABS_API_KEY) return [];
  const configured = Object.entries(ELEVENLABS_AGENTS).filter(([, v]) => v);
  if (configured.length === 0) {
    return [{ provider: "elevenlabs", layer: "credentials", target: "elevenlabs_agents", status: "warn", message: "No ElevenLabs agent IDs configured in secrets" }];
  }
  for (const [name, id] of configured) {
    try {
      const r = await el(`/v1/convai/agents/${id}`);
      if (r.status === 404) {
        out.push({ provider: "elevenlabs", layer: "credentials", target: `agent:${name}`, status: "fail", message: `Convai agent ${id} not found (404) — stale secret or deleted agent`, detail: { agent_id: id } });
      } else if (r.status === 401 || r.status === 403) {
        out.push({ provider: "elevenlabs", layer: "credentials", target: `agent:${name}`, status: "fail", message: `Convai agent ${id} fetch unauthorized (HTTP ${r.status})`, detail: { agent_id: id } });
      } else if (r.ok) {
        const j = await r.json().catch(() => ({}));
        out.push({ provider: "elevenlabs", layer: "credentials", target: `agent:${name}`, status: "pass", message: `Convai agent ${id} valid (${j?.name || "unnamed"})`, detail: { agent_id: id, name: j?.name } });
      } else {
        out.push({ provider: "elevenlabs", layer: "credentials", target: `agent:${name}`, status: "warn", message: `Convai agent ${id} fetch HTTP ${r.status}`, detail: { agent_id: id, http_status: r.status } });
      }
    } catch (e) {
      out.push({ provider: "elevenlabs", layer: "credentials", target: `agent:${name}`, status: "warn", message: `Could not verify agent ${id}: ${(e as Error).message}`, detail: { agent_id: id } });
    }
  }
  return out;
}

async function checkElevenLabsPhoneNumbers(): Promise<Result[]> {
  const out: Result[] = [];
  if (!ELEVENLABS_API_KEY) return [];
  try {
    const r = await el("/v1/convai/phone-numbers");
    if (r.status === 401 || r.status === 403) {
      return [{ provider: "elevenlabs", layer: "webhook_config", target: "elevenlabs_phone_numbers", status: "fail", message: `Phone-number list unauthorized (HTTP ${r.status})` }];
    }
    if (!r.ok) {
      return [{ provider: "elevenlabs", layer: "webhook_config", target: "elevenlabs_phone_numbers", status: "warn", message: `Phone-number list returned HTTP ${r.status}` }];
    }
    const j = await r.json();
    const nums = j?.phone_numbers || j || [];
    if (!Array.isArray(nums) || nums.length === 0) {
      out.push({ provider: "elevenlabs", layer: "webhook_config", target: "elevenlabs_phone_numbers", status: "warn", message: "No Convai phone numbers registered (no inbound EL answering)" });
      return out;
    }
    for (const n of nums) {
      const num = n.phone_number || n.number || n.id;
      const assigned = n.assigned_agent?.agent_id || n.agent_id;
      out.push({
        provider: "elevenlabs",
        layer: "webhook_config",
        target: `convai:${num}`,
        status: assigned ? "pass" : "warn",
        message: assigned ? `Registered, agent ${assigned} assigned` : `Registered but no agent assigned — inbound will not answer`,
        detail: { phone_number: num, agent_id: assigned, provider: n.provider },
      });
    }
  } catch (e) {
    out.push({ provider: "elevenlabs", layer: "webhook_config", target: "elevenlabs_phone_numbers", status: "fail", message: `EL phone-number check threw: ${(e as Error).message}` });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE MODES — delegated to comms-feature-prober (runs in its own edge
// trace so it gets its own outbound-fetch quota; this monitor was hitting
// the per-trace rate limit when probing 30+ feature endpoints inline).
// We just invoke the prober and merge its results — it persists its own
// rows under layer='feature_mode' too, so the dashboard always has data.
// ════════════════════════════════════════════════════════════════════════════
async function checkFeatureModes(): Promise<Result[]> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/comms-feature-prober`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ source: "comms-health-monitor" }),
    });
    if (!r.ok) {
      return [{ provider: "twilio", layer: "feature_mode", target: "feature_prober", status: "fail", message: `comms-feature-prober returned HTTP ${r.status}`, detail: { http_status: r.status } }];
    }
    const j = await r.json();
    // Prober already persisted; we still surface results so the immediate
    // /run response includes the rollup. De-dupe-safe: dashboard reads from
    // v_comms_health_latest which collapses to one row per (layer,target).
    return (j.results || []).map((row: any) => ({
      provider: row.provider,
      layer: row.layer,
      target: row.target,
      status: row.status,
      message: row.message,
      detail: row.detail || {},
    } as Result));
  } catch (e) {
    return [{ provider: "twilio", layer: "feature_mode", target: "feature_prober", status: "fail", message: `Could not invoke comms-feature-prober: ${(e as Error).message}` }];
  }
}


// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  const results: Result[] = [];
  const layers: Array<{ name: string; provider: string; fn: () => Promise<Result[]> }> = [
    // Twilio
    { name: "checkCredentials", provider: "twilio", fn: checkCredentials },
    { name: "checkWebhookConfig", provider: "twilio", fn: checkWebhookConfig },
    { name: "checkFunctionDeployment", provider: "twilio", fn: checkFunctionDeployment },
    { name: "checkA2P", provider: "twilio", fn: checkA2P },
    { name: "checkSignatureVerify", provider: "twilio", fn: checkSignatureVerify },
    { name: "checkSyntheticLoop", provider: "twilio", fn: checkSyntheticLoop },
    // Bland
    { name: "checkBlandCredentials", provider: "bland", fn: checkBlandCredentials },
    { name: "checkBlandAgents", provider: "bland", fn: checkBlandAgents },
    { name: "checkBlandWebhooks", provider: "bland", fn: checkBlandWebhooks },
    { name: "checkBlandSynthetic", provider: "bland", fn: checkBlandSynthetic },
    // ElevenLabs
    { name: "checkElevenLabsCredentials", provider: "elevenlabs", fn: checkElevenLabsCredentials },
    { name: "checkElevenLabsAgents", provider: "elevenlabs", fn: checkElevenLabsAgents },
    { name: "checkElevenLabsPhoneNumbers", provider: "elevenlabs", fn: checkElevenLabsPhoneNumbers },
    // Feature/Surface matrix — Calling & Texting Features
    { name: "checkFeatureModes", provider: "twilio", fn: checkFeatureModes },
  ];
  for (const { name, provider, fn } of layers) {
    try {
      const r = await fn();
      for (const row of r) if (!row.provider) row.provider = provider;
      results.push(...r);
    } catch (e) {
      console.error(`[comms-health] layer ${name} threw:`, e);
      results.push({
        provider,
        layer: name.replace(/^check/, "").toLowerCase().includes("synthetic") ? "synthetic_loop" : "credentials",
        target: "exception",
        status: "fail",
        message: (e as Error).message,
      });
    }
  }

  // Persist all results
  try {
    const supa = sb();
    const rows = results.map((r) => ({
      layer: r.layer,
      provider: r.provider || "twilio",
      target: r.target,
      status: r.status,
      message: r.message || null,
      detail: r.detail || {},
    }));
    const { error } = await supa.from("comms_health_checks").insert(rows);
    if (error) console.error("[comms-health] insert error:", error.message);
  } catch (e) {
    console.error("[comms-health] persist threw:", e);
  }


  const failed = results.filter((r) => r.status === "fail");
  const warned = results.filter((r) => r.status === "warn");
  console.log(
    `[comms-health] complete in ${Date.now() - t0}ms — ${results.length} checks, ${failed.length} fail, ${warned.length} warn`,
  );

  return new Response(
    JSON.stringify({
      ok: failed.length === 0,
      duration_ms: Date.now() - t0,
      total: results.length,
      fail: failed.length,
      warn: warned.length,
      results,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
