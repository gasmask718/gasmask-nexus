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

// Messaging-Service inbound destinations hosted on a FOREIGN Supabase project
// that are deliberate, not leaks. Key: project ref from the URL host. A service
// pointing here reports pass — the destination is owned by a system we control
// elsewhere, and warning on it trains people to ignore the monitor.
const INTENTIONAL_FOREIGN_MS_DESTINATIONS: Record<string, string> = {
  // UT Platform. Service "Unforgettable Times" (MGcb31bd…) points its inbound
  // at UT's own twilio-inbound-sms. Brought up 2026-08-15 with a same-day
  // four-STOP bring-up test against +19294990837; handler probed and answers.
  // See docs/comms/ITEMS-3-4-5-REPORT-2026-08-20.md.
  pxylmrmwqmxotqffejbe: "UT Platform inbound (owned since 2026-08-15)",
};

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

// Probe cache — one HTTP call per function name per monitor run.
const deployProbeCache = new Map<string, { deployed: boolean; detail: string }>();

/**
 * Is this edge function actually deployed and answering?
 *
 * 2026-08-20: this used to be assumed rather than measured — any Supabase URL
 * whose handler name wasn't in ACCEPTED_ALTERNATES was reported as "not
 * deployed". That is wrong for every signature-verifying webhook: they answer
 * 403 to an unsigned probe, which is the CORRECT answer and proves the handler
 * is live. As signature verification rolls out across the Twilio-signable
 * webhooks, treating 403 as missing would manufacture a wave of false alarms in
 * the one system meant to tell us when something is really broken.
 *
 * Deployed = anything our code answered: 2xx, 401/403 (auth/signature reject),
 * 400/405/422 (reached the handler, bad input). Not deployed = 404, or a 5xx
 * with an HTML body (gateway/stale build).
 */
async function probeDeployed(fn: string): Promise<{ deployed: boolean; detail: string }> {
  const hit = deployProbeCache.get(fn);
  if (hit) return hit;
  let result: { deployed: boolean; detail: string };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "From=%2B10000000000&To=%2B10000000000&Body=healthcheck&MessageSid=SMhealth",
    });
    const body = (await r.text()).slice(0, 200);
    const ourCode =
      (r.status >= 200 && r.status < 300) ||
      r.status === 400 || r.status === 401 || r.status === 403 ||
      r.status === 405 || r.status === 422 ||
      body.startsWith("<?xml");
    result = {
      deployed: ourCode,
      detail: `HTTP ${r.status}${r.status === 403 ? " (signature reject — handler live)" : ""}`,
    };
  } catch (e) {
    result = { deployed: false, detail: `unreachable: ${(e as Error).message}` };
  }
  deployProbeCache.set(fn, result);
  return result;
}

/**
 * Same deployed/not-deployed rule as probeDeployed, but for JSON APIs.
 * send-sms is the outbound chokepoint for campaign/transactional/workforce
 * traffic — dispatch now fails if it 5xx's — but it expects a JSON body, so
 * the form-encoded webhook probe would get a 500 from `req.json()` throwing
 * and read a LIVE function as missing. POSTing `{}` gets a 400 ("Missing
 * required fields") from live code: that is the healthy answer.
 */
async function probeDeployedJson(fn: string): Promise<{ deployed: boolean; detail: string }> {
  const key = `json:${fn}`;
  const hit = deployProbeCache.get(key);
  if (hit) return hit;
  let result: { deployed: boolean; detail: string };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const ourCode =
      (r.status >= 200 && r.status < 300) ||
      r.status === 400 || r.status === 401 || r.status === 403 ||
      r.status === 405 || r.status === 422;
    result = {
      deployed: ourCode,
      detail: `HTTP ${r.status}${r.status === 400 ? " (schema reject — handler live)" : ""}`,
    };
  } catch (e) {
    result = { deployed: false, detail: `unreachable: ${(e as Error).message}` };
  }
  deployProbeCache.set(key, result);
  return result;
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
      const classifyUrl = async (url: string | null | undefined, canonical: string, hasAppSid: boolean):
        Promise<{ status: "pass" | "warn" | "fail"; msg: string }> => {
        if (hasAppSid) return { status: "pass", msg: "Routed via TwiML App SID" };
        if (!url) return { status: "warn", msg: "EMPTY — Messaging Service must override or inbound will be dropped" };
        if (url === canonical) return { status: "pass", msg: `Canonical webhook` };
        if (url.startsWith(`${SUPABASE_URL}/functions/v1/`)) {
          const fn = (url.split("/functions/v1/")[1] || "").split("?")[0];
          if (ACCEPTED_ALTERNATES.has(fn)) {
            return { status: "pass", msg: `Routed to accepted alternate '${fn}' (intentional split)` };
          }
          // Measure, don't assume. A 403 here means the handler is deployed and
          // verifying signatures — healthy, not missing.
          const probe = await probeDeployed(fn);
          return probe.deployed
            ? { status: "pass", msg: `Alternate route '${fn}' — deployed and answering (${probe.detail})` }
            : { status: "warn", msg: `Alternate route '${fn}' — handler did not answer (${probe.detail}); inbound to this URL would 404 until it ships` };
        }
        if (/twilio\.com\/(welcome|demo)/i.test(url)) {
          return { status: "fail", msg: `Twilio demo URL — replace with your webhook` };
        }
        return { status: "fail", msg: `Non-Supabase URL '${url}' — Twilio will receive non-TwiML (12200 class)` };
      };
      for (const n of d.incoming_phone_numbers || []) {
        const num = n.phone_number;
        const smsC = await classifyUrl(n.sms_url, CANONICAL.sms, !!n.sms_application_sid);
        const voiceC = await classifyUrl(n.voice_url, CANONICAL.voice, !!n.voice_application_sid);
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
        } else if (url === CANONICAL.sms || url.split("?")[0] === CANONICAL.sms) {
          // Path-only match: canonical function carrying a ?biz= routing param
          // is still canonical — the param selects the brand, not the handler.
          const biz = new URLSearchParams(url.split("?")[1] || "").get("biz");
          msg = biz
            ? `Inbound → canonical SMS webhook (biz='${biz}')`
            : `Inbound → canonical SMS webhook`;
        } else if (url.includes("supabase.co/functions/v1/")) {
          const foreignRef = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] || "";
          const ownership = INTENTIONAL_FOREIGN_MS_DESTINATIONS[foreignRef];
          if (ownership) {
            msg = `Inbound → ${ownership} (intentional foreign project — documented, do not "fix")`;
          } else {
            status = "warn";
            msg = `Inbound → '${url}' (non-canonical Supabase function)`;
          }
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
  // Signature-verified webhooks answer 403 to this unsigned probe — that is the
  // correct, healthy answer. probeDeployed() is the single shared rule.
  const fns = [
    "twilio-sms-webhook",
    "twilio-voice-webhook",
    "twilio-sms-status",
    "dc-call-status",
    "va-dialer-status",
    "twilio-gather-webhook",
    "brandaro-call-twiml",
  ];
  for (const fn of fns) {
    const probe = await probeDeployed(fn);
    out.push({
      layer: "function_deployment",
      target: fn,
      status: probe.deployed ? "pass" : "fail",
      message: probe.deployed
        ? `Deployed and answering (${probe.detail})`
        : `Unhealthy: ${probe.detail}`,
      detail: { probe: probe.detail },
    });
  }
  // send-sms: the outbound chokepoint every campaign/transactional/workforce
  // send routes through. Dispatch fails when it 5xx's, so it gets watched
  // like the webhooks. JSON probe — see probeDeployedJson.
  const smsProbe = await probeDeployedJson("send-sms");
  out.push({
    layer: "function_deployment",
    target: "send-sms",
    status: smsProbe.deployed ? "pass" : "fail",
    message: smsProbe.deployed
      ? `Deployed and answering (${smsProbe.detail})`
      : `Unhealthy: ${smsProbe.detail} — ALL outbound SMS (dispatch included) is down`,
    detail: { probe: smsProbe.detail },
  });
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

  // Each entry: canonical + brand-split inbound handlers we expect to enforce
  // both Twilio signature verification AND STOP keyword handling. Same probe
  // pattern for all targets.
  const inboundTargets: { target: string; url: string }[] = [
    { target: "twilio-sms-webhook", url: CANONICAL.sms },
    {
      target: "brandaro-handle-inbound",
      url: `${SUPABASE_URL}/functions/v1/brandaro-handle-inbound`,
    },
  ];

  const sign = (url: string, params: Record<string, string>) => {
    const keys = Object.keys(params).sort();
    let data = url;
    for (const k of keys) data += k + params[k];
    return createHmac("sha1", token).update(data).digest("base64");
  };

  const post = async (url: string, params: Record<string, string>, sig: string) => {
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

  // SYNTHETIC PROBE CONVENTION (handlers must short-circuit on this combo):
  //   MessageSid prefix: "SMhealth..." (same as twilio-sms-status probe)
  //   From: SYNTHETIC_PROBE_FROM — Twilio "magic" test number, can never be a
  //         real customer; routing to it is also a no-op at Twilio's edge.
  // Handlers that see BOTH return 200 {synthetic:true} with zero side effects
  // (no opt_out_events write, no outbound SMS). This stops the every-20-min
  // "You've been unsubscribed" leak we observed in production.
  const SYNTHETIC_PROBE_FROM = "+15005550006";

  for (const { target, url } of inboundTargets) {
    const params: Record<string, string> = {
      From: SYNTHETIC_PROBE_FROM,
      To: VERIFIED_TOLL_FREE,
      Body: "synthetic-health-check",
      MessageSid: "SMhealthcheck" + Date.now(),
      AccountSid: TWILIO_ACCOUNT_SID,
    };
    const goodSig = sign(url, params);

    try {
      const okResp = await post(url, params, goodSig);
      const badResp = await post(url, params, "invalid-signature-xxxxxxxxxxxxxxxxxxxxxx==");
      const goodAccepted = okResp.status === 200;
      const badRejected = badResp.status === 403;
      let status: "pass" | "warn" | "fail" = "pass";
      let msg = `Good sig HTTP ${okResp.status}, bad sig HTTP ${badResp.status} (token: ${tokenSource})`;
      if (!goodAccepted && !badRejected) {
        status = "fail";
        msg = `Signature verify broken both ways: good=${okResp.status} bad=${badResp.status} — token mismatch or URL mismatch (${tokenSource})`;
      } else if (!goodAccepted) {
        status = "fail";
        msg = `${target} rejects VALID signature (HTTP ${okResp.status}) — ${tokenSource} does not match the account that signs inbound`;
      } else if (!badRejected) {
        status = "fail";
        msg = `${target} accepts INVALID signature (HTTP ${badResp.status}) — verification bypassed or disabled`;
      }

      // STOP keyword probe — synthetic marker (SMhealth* + reserved From).
      // Handlers must short-circuit and return 200 WITHOUT writing
      // opt_out_events and WITHOUT sending any SMS. We only verify the ACK.
      let stopStatus: "pass" | "warn" | "fail" = "pass";
      let stopMsg = "";
      try {
        const stopParams = {
          ...params,
          Body: "STOP",
          MessageSid: "SMhealthstop" + Date.now(), // <-- SMhealth* prefix (was "SMstop", caused side effects)
        };
        const stopSig = sign(url, stopParams);
        const stopResp = await post(url, stopParams, stopSig);
        if (stopResp.status === 200) {
          stopMsg = `STOP accepted (HTTP 200) — opt-out path reachable (synthetic, no side effects)`;
        } else if (stopResp.status === 403) {
          stopStatus = "warn";
          stopMsg = `STOP probe rejected (HTTP 403) — signature path inconsistent with main probe`;
        } else {
          stopStatus = "fail";
          stopMsg = `STOP probe returned HTTP ${stopResp.status} — handler may not acknowledge opt-outs`;
        }
      } catch (e) {
        stopStatus = "warn";
        stopMsg = `STOP probe threw: ${(e as Error).message}`;
      }

      const combinedStatus =
        status === "fail" || stopStatus === "fail"
          ? "fail"
          : status === "warn" || stopStatus === "warn"
          ? "warn"
          : "pass";

      out.push({
        layer: "signature_verify",
        target,
        status: combinedStatus,
        message: `${msg} · STOP: ${stopMsg}`,
        detail: {
          token_source: tokenSource,
          good_sig_http: okResp.status,
          bad_sig_http: badResp.status,
          stop_status: stopStatus,
          url,
        },
      });
    } catch (e) {
      out.push({
        layer: "signature_verify",
        target,
        status: "fail",
        message: `Signature check threw: ${(e as Error).message}`,
      });
    }
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

  // Heuristic: Bland AGENT ids start with `agent_…`; conversational PATHWAYS
  // are bare UUIDs. They are different resources with different endpoints.
  // Try the shape-matched endpoint first, then fall back to the other before
  // declaring a fail — many DC_* / RE_* / BRANDARO_* secrets are actually
  // pathway ids and would otherwise 404 forever against /v1/agents.
  const isAgentId = (v: string) => /^agent_/i.test(v);
  const tryAgent = (id: string) => bland(`/v1/agents/${id}`);
  const tryPathway = (id: string) => bland(`/v1/pathway/${id}`);

  for (const [name, id] of configured) {
    if (listOk && known.has(id)) {
      out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "pass", message: `Agent ${id} present in Bland account`, detail: { resource_id: id, kind: "agent" } });
      continue;
    }
    try {
      const primaryFetch = isAgentId(id) ? tryAgent : tryPathway;
      const fallbackFetch = isAgentId(id) ? tryPathway : tryAgent;
      const primaryKind = isAgentId(id) ? "agent" : "pathway";
      const fallbackKind = isAgentId(id) ? "pathway" : "agent";

      let r = await primaryFetch(id);
      let kind = primaryKind;
      if (r.status === 404) {
        const r2 = await fallbackFetch(id);
        if (r2.ok || (r2.status !== 404)) { r = r2; kind = fallbackKind; }
      }

      if (r.status === 404) {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "fail", message: `${id} not found in Bland account (404 on agent + pathway) — stale secret or deleted resource`, detail: { resource_id: id } });
      } else if (r.status === 401 || r.status === 403) {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "fail", message: `${id} fetch unauthorized (HTTP ${r.status})`, detail: { resource_id: id } });
      } else if (r.ok) {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "pass", message: `${kind} ${id} valid`, detail: { resource_id: id, kind } });
      } else {
        out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "warn", message: `${id} fetch returned HTTP ${r.status}`, detail: { resource_id: id, http_status: r.status } });
      }
    } catch (e) {
      out.push({ provider: "bland", layer: "credentials", target: `agent:${name}`, status: "warn", message: `Could not verify ${id}: ${(e as Error).message}`, detail: { resource_id: id } });
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
// ALERT SINK
// Detection existed; notification did not. Every `fail` result is escalated
// to Slack and/or SMS, deduped per (layer:target) for ALERT_DEDUPE_HOURS.
//
// Destinations (first configured wins; both fire if both are set):
//   COMMS_ALERT_SLACK_WEBHOOK  — Slack incoming-webhook URL
//   COMMS_ALERT_SMS_TO         — E.164 number (falls back to
//                                ADMIN_ALERT_PHONE, then DAVID_PHONE_NUMBER)
// Alert state lives in public.comms_health_alerts.
// ────────────────────────────────────────────────────────────────────────────
const ALERT_DEDUPE_HOURS = parseFloat(Deno.env.get("COMMS_ALERT_DEDUPE_HOURS") || "6");
const SLACK_WEBHOOK = Deno.env.get("COMMS_ALERT_SLACK_WEBHOOK") || "";
const ALERT_SMS_TO =
  Deno.env.get("COMMS_ALERT_SMS_TO") ||
  Deno.env.get("ADMIN_ALERT_PHONE") ||
  Deno.env.get("DAVID_PHONE_NUMBER") ||
  "";
const ALERT_SMS_FROM =
  Deno.env.get("TWILIO_FROM_NUMBER") || Deno.env.get("TWILIO_PHONE_NUMBER") || "";

async function sendSlack(text: string): Promise<boolean> {
  if (!SLACK_WEBHOOK) return false;
  try {
    const r = await fetch(SLACK_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) console.error(`[comms-health] slack alert failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.ok;
  } catch (e) {
    console.error("[comms-health] slack alert threw:", (e as Error).message);
    return false;
  }
}

async function sendAlertSms(body: string): Promise<boolean> {
  if (!ALERT_SMS_TO || !ALERT_SMS_FROM) return false;
  const auth = twAuth();
  if (!auth || !TWILIO_ACCOUNT_SID) return false;
  try {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: ALERT_SMS_TO, From: ALERT_SMS_FROM, Body: body.slice(0, 600) }),
      },
    );
    if (!r.ok) console.error(`[comms-health] sms alert failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.ok;
  } catch (e) {
    console.error("[comms-health] sms alert threw:", (e as Error).message);
    return false;
  }
}

async function escalateFailures(results: Result[]): Promise<number> {
  const failures = results.filter((r) => r.status === "fail");
  if (failures.length === 0) return 0;
  // NOTE (2026-08-20): this function used to return early when neither Slack
  // nor an SMS number was configured — which is exactly what happened for
  // weeks: correct detection, zero notification. sendOpsAlert() is the
  // canonical internal sink (email-first, always logged to
  // admin_notifications_log) and needs no per-monitor configuration, so it
  // ALWAYS runs. Slack/SMS remain optional extras on top of it.


  const supa = sb();
  const keys = failures.map((f) => `${f.layer}:${f.target}`);
  const { data: prior } = await supa
    .from("comms_health_alerts")
    .select("alert_key, last_alert_at")
    .in("alert_key", keys);
  const lastByKey = new Map<string, string>((prior ?? []).map((p: any) => [p.alert_key, p.last_alert_at]));

  const due = failures.filter((f) => {
    const last = lastByKey.get(`${f.layer}:${f.target}`);
    if (!last) return true;
    return (Date.now() - new Date(last).getTime()) / 3_600_000 >= ALERT_DEDUPE_HOURS;
  });
  if (due.length === 0) {
    console.log(`[comms-health] ${failures.length} failures, all within ${ALERT_DEDUPE_HOURS}h dedupe window`);
    return 0;
  }

  const lines = due.map((f) => `• [${f.provider || "twilio"}/${f.layer}] ${f.target} — ${f.message || "fail"}`);
  const header = `🚨 COMMS HEALTH: ${due.length} new failure${due.length === 1 ? "" : "s"} (${failures.length} failing total)`;
  const slackText = [header, ...lines].join("\n").slice(0, 3800);
  const smsText = [header, ...lines.slice(0, 5)].join("\n") + (due.length > 5 ? `\n…+${due.length - 5} more` : "");

  // Canonical sink first, then the optional extras.
  const ops = await sendOpsAlert({
    source: "comms-health-monitor",
    severity: "critical",
    subject: header,
    message: [header, ...lines].join("\n").slice(0, 6000),
    context: {
      new_failures: due.length,
      failing_total: failures.length,
      keys: due.map((f) => `${f.layer}:${f.target}`).slice(0, 40),
    },
  });
  const [slackOk, smsOk] = await Promise.all([sendSlack(slackText), sendAlertSms(smsText)]);
  // Dedupe keys on the ATTEMPT, not on success: a monitor that only records
  // itself as "alerted" when delivery succeeded goes quiet exactly when the
  // comms estate is broken. Delivery failures are visible in
  // admin_notifications_log and in this log line.
  if (!ops.emailSent && !ops.smsSent && !slackOk && !smsOk) {
    console.error(
      `[comms-health] alert attempted but ALL channels failed: ${ops.errors.join("; ")}`,
    );
  }


  const now = new Date().toISOString();
  const { error } = await supa.from("comms_health_alerts").upsert(
    due.map((f) => ({
      alert_key: `${f.layer}:${f.target}`,
      last_alert_at: now,
      last_status: f.status,
      last_message: f.message || null,
      updated_at: now,
    })),
    { onConflict: "alert_key" },
  );
  if (error) console.error("[comms-health] alert state upsert failed:", error.message);
  console.log(`[comms-health] alerted on ${due.length} failures (ops_email=${ops.emailSent} ops_sms=${ops.smsSent} slack=${slackOk} sms=${smsOk})`);
  return due.length;
}

// ────────────────────────────────────────────────────────────────────────────
// LAYER: Outbound dispatch health — failure RATE over a rolling window.
//
// brandaro_ai_calls writes a row BEFORE dispatch, so a row count proves
// nothing: the table sat at a 100% dispatch failure rate for two months while
// three dashboards rendered it as volume. This check reads outcomes, not rows.
//   fail  → >=50% of attempts in the window failed to dispatch
//   warn  → >=20%, or the whole window is empty when the 7d window is not
//   pass  → below 20%
// ────────────────────────────────────────────────────────────────────────────
const DISPATCH_FAIL_STATUSES = ["failed", "error", "rejected", "canceled", "cancelled"];

async function checkOutboundDispatch(): Promise<Result[]> {
  const out: Result[] = [];
  const supa = sb();

  const windows: Array<{ target: string; hours: number; minAttempts: number }> = [
    { target: "brandaro_ai_calls_24h", hours: 24, minAttempts: 5 },
    { target: "brandaro_ai_calls_7d", hours: 24 * 7, minAttempts: 10 },
  ];

  for (const w of windows) {
    try {
      const since = new Date(Date.now() - w.hours * 3600 * 1000).toISOString();
      const { data, error } = await supa
        .from("brandaro_ai_calls")
        .select("status, outcome, created_at")
        .gte("created_at", since)
        .limit(5000);

      if (error) {
        out.push({
          provider: "bland",
          layer: "dispatch_health",
          target: w.target,
          status: "warn",
          message: `Could not query brandaro_ai_calls: ${error.message}`,
        });
        continue;
      }

      const rows = data || [];
      const attempts = rows.length;
      const failures = rows.filter((r: Record<string, unknown>) =>
        DISPATCH_FAIL_STATUSES.includes(String(r.status || "").toLowerCase()),
      );
      const rate = attempts ? failures.length / attempts : 0;

      // Most common failure reason, for the alert body.
      const reasons: Record<string, number> = {};
      for (const f of failures) {
        const o = (f as Record<string, unknown>).outcome as Record<string, unknown> | string | null;
        let reason = "unknown";
        let parsed: unknown = o;
        if (typeof o === "string") {
          try { parsed = JSON.parse(o); } catch { reason = o.slice(0, 120); }
        }
        const p = parsed as Record<string, unknown> | null;
        if (p && typeof p === "object") {
          const resp = (p.bland_response || {}) as Record<string, unknown>;
          reason = String(p.reason || p.message || resp.message || resp.code || p.code || "unknown").slice(0, 120);
        }
        reasons[reason] = (reasons[reason] || 0) + 1;
      }
      const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];

      const detail = {
        window_hours: w.hours,
        attempts,
        failures: failures.length,
        failure_rate_pct: Math.round(rate * 100),
        top_reason: topReason ? { reason: topReason[0], count: topReason[1] } : null,
      };

      if (attempts === 0) {
        out.push({
          provider: "bland",
          layer: "dispatch_health",
          target: w.target,
          status: w.hours >= 24 * 7 ? "warn" : "pass",
          message:
            w.hours >= 24 * 7
              ? "No AI dial attempts at all in the last 7 days — campaigns are idle or not firing."
              : "No AI dial attempts in the last 24h.",
          detail,
        });
      } else if (attempts >= w.minAttempts && rate >= 0.5) {
        out.push({
          provider: "bland",
          layer: "dispatch_health",
          target: w.target,
          status: "fail",
          message: `${detail.failure_rate_pct}% of ${attempts} AI dial attempts failed to dispatch in the last ${w.hours}h${topReason ? ` — top reason: "${topReason[0]}" (${topReason[1]}x)` : ""}. Rows are written before dispatch, so dashboards will still show volume.`,
          detail,
        });
      } else if (attempts >= w.minAttempts && rate >= 0.2) {
        out.push({
          provider: "bland",
          layer: "dispatch_health",
          target: w.target,
          status: "warn",
          message: `${detail.failure_rate_pct}% of ${attempts} AI dial attempts failed to dispatch in the last ${w.hours}h${topReason ? ` — top reason: "${topReason[0]}"` : ""}.`,
          detail,
        });
      } else {
        out.push({
          provider: "bland",
          layer: "dispatch_health",
          target: w.target,
          status: "pass",
          message: `${attempts} AI dial attempts, ${failures.length} dispatch failures (${detail.failure_rate_pct}%) in the last ${w.hours}h.`,
          detail,
        });
      }
    } catch (e) {
      out.push({
        provider: "bland",
        layer: "dispatch_health",
        target: w.target,
        status: "fail",
        message: `Dispatch health check threw: ${(e as Error).message}`,
      });
    }
  }

  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// ALERT CHANNEL HEARTBEAT — watches for the ABSENCE of a positive signal.
//
// Both legs of the ops alert channel died within days of each other in
// 2026-06/07 and nobody noticed for six weeks: an alerting channel fails
// silently by definition, because silence is also what health looks like.
// `ops-alert-heartbeat` sends one real ops email a day; this layer fails when
// that row stops appearing. It reports into comms_health_checks (read by the
// UI directly) so it never depends on the channel it is judging.
// ────────────────────────────────────────────────────────────────────────────
const HEARTBEAT_EVENT = "ops_alert:ops-alert-heartbeat";
const HEARTBEAT_STALE_HOURS = 26; // daily cadence + 2h of slack

async function checkAlertChannel(): Promise<Result[]> {
  const supa = sb();
  try {
    const { data, error } = await supa
      .from("admin_notifications_log")
      .select("sent_at, status, channel, metadata")
      .eq("event_type", HEARTBEAT_EVENT)
      .order("sent_at", { ascending: false })
      .limit(5);
    if (error) {
      return [{
        provider: "resend",
        layer: "alert_channel",
        target: "ops_alert_heartbeat",
        status: "fail",
        message: `Cannot read admin_notifications_log: ${error.message}`,
      }];
    }

    const rows = data || [];
    const lastOk = rows.find((r: Record<string, unknown>) => r.status === "sent");
    const lastAny = rows[0] as Record<string, unknown> | undefined;

    if (!lastOk) {
      return [{
        provider: "resend",
        layer: "alert_channel",
        target: "ops_alert_heartbeat",
        status: "fail",
        message: lastAny
          ? `Ops alert heartbeat has NEVER delivered — last attempt ${lastAny.sent_at} was "${lastAny.status}". Every alert the platform raises is going nowhere.`
          : "No ops alert heartbeat has ever been recorded — the alert channel is unproven. Is the daily cron scheduled?",
        detail: { last_attempt: lastAny ?? null, attempts_seen: rows.length },
      }];
    }

    const ageH =
      (Date.now() - new Date(String(lastOk.sent_at)).getTime()) / 3_600_000;
    const detail = {
      last_success_at: lastOk.sent_at,
      age_hours: Math.round(ageH * 10) / 10,
      stale_after_hours: HEARTBEAT_STALE_HOURS,
      last_attempt_status: lastAny?.status ?? null,
    };

    if (ageH > HEARTBEAT_STALE_HOURS) {
      return [{
        provider: "resend",
        layer: "alert_channel",
        target: "ops_alert_heartbeat",
        status: "fail",
        message: `No ops alert has delivered in ${
          Math.round(ageH)
        }h (heartbeat is daily). The alert channel is DOWN — assume every other alert is silent too.`,
        detail,
      }];
    }
    if (ageH > 24) {
      return [{
        provider: "resend",
        layer: "alert_channel",
        target: "ops_alert_heartbeat",
        status: "warn",
        message: `Ops alert heartbeat is ${
          Math.round(ageH)
        }h old — cron may be late.`,
        detail,
      }];
    }
    return [{
      provider: "resend",
      layer: "alert_channel",
      target: "ops_alert_heartbeat",
      status: "pass",
      message: `Ops alert channel delivered ${detail.age_hours}h ago.`,
      detail,
    }];
  } catch (e) {
    return [{
      provider: "resend",
      layer: "alert_channel",
      target: "ops_alert_heartbeat",
      status: "fail",
      message: `Alert channel check threw: ${(e as Error).message}`,
    }];
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
    { name: "checkOutboundDispatch", provider: "bland", fn: checkOutboundDispatch },
    // Alerting channel — watches for the absence of the daily heartbeat.
    { name: "checkAlertChannel", provider: "resend", fn: checkAlertChannel },


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

  // ── ALERTING ── (6h dedupe per layer:target)
  const alerted = await escalateFailures(results);


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
      alerted,

      results,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
