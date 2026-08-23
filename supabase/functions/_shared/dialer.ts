// Shared utilities for the auto-dialer edge functions.
// - Twilio request signature validation (X-Twilio-Signature)
// - Bland webhook shared-secret validation
// - Idempotent event logging into dialer_call_events
// - Webhook deduplication via dialer_webhook_events
// - Severity-tagged structured logging

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-signature, x-bland-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export const xmlHeaders = { ...corsHeaders, "Content-Type": "text/xml; charset=utf-8" };

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function svc(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export type Severity = "info" | "warning" | "error" | "critical";

/**
 * Validate a Twilio request signature.
 * Twilio computes HMAC-SHA1 of (full_url + sorted concatenation of POST params)
 * using TWILIO_AUTH_TOKEN, then base64-encodes the result.
 *
 * https://www.twilio.com/docs/usage/security
 */
export function validateTwilioSignature(opts: {
  authToken: string;
  signature: string | null;
  url: string;          // exact URL Twilio called (including query string)
  params: Record<string, string>; // POST form params (empty for GET)
}): boolean {
  if (!opts.signature || !opts.authToken) return false;
  const sortedKeys = Object.keys(opts.params).sort();
  let data = opts.url;
  for (const k of sortedKeys) data += k + opts.params[k];
  const computed = createHmac("sha1", opts.authToken).update(data).digest("base64");
  // Constant-time-ish compare
  if (computed.length !== opts.signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ opts.signature.charCodeAt(i);
  return diff === 0;
}

/**
 * Reconstruct the original public URL Twilio used for this request.
 * Edge functions sit behind the Supabase function gateway; X-Forwarded headers
 * give us the original scheme/host. Falls back to the request URL.
 */
export function originalUrl(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const u = new URL(req.url);
    return `${proto}://${host}${u.pathname}${u.search}`;
  }
  return req.url;
}

/**
 * Build the canonical Supabase functions URL for this request, ignoring any
 * x-forwarded-* headers. This is what Twilio actually signs when the webhook
 * was configured with the canonical `https://<ref>.supabase.co/functions/v1/<fn>`
 * URL — which is the only stable form across the Supabase edge gateway.
 */
export function canonicalUrl(req: Request): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const u = new URL(req.url);
  // u.pathname for edge requests looks like "/<fn-name>" inside the runtime.
  // The public URL is "<SUPABASE_URL>/functions/v1<pathname>".
  let path = u.pathname;
  if (!path.startsWith("/functions/v1")) {
    path = `/functions/v1${path.startsWith("/") ? "" : "/"}${path}`;
  }
  return `${supabaseUrl.replace(/\/$/, "")}${path}${u.search}`;
}

/** Read form params into a plain object (for signature validation + business logic). */
export async function readForm(req: Request): Promise<Record<string, string>> {
  try {
    const fd = await req.formData();
    const out: Record<string, string> = {};
    for (const [k, v] of fd.entries()) out[k] = typeof v === "string" ? v : "";
    return out;
  } catch {
    return {};
  }
}

function computeSig(token: string, url: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + params[k];
  return createHmac("sha1", token).update(data).digest("base64");
}

/**
 * Verify Twilio request OR allow if explicitly disabled (DIALER_SKIP_TWILIO_VERIFY=true).
 * Tries multiple candidate URLs (canonical Supabase URL, x-forwarded URL, raw req.url)
 * because the edge gateway rewrites host headers — Twilio signs the exact configured URL,
 * which is the canonical `<SUPABASE_URL>/functions/v1/<fn>` form.
 * Logs a structured diagnostic when verification fails so the mismatch is visible.
 */
export function verifyTwilio(
  req: Request,
  params: Record<string, string>,
  opts?: { extraTokenEnvVars?: string[] },
): { ok: boolean; reason?: string; matchedUrl?: string; matchedToken?: string } {
  if ((Deno.env.get("DIALER_SKIP_TWILIO_VERIFY") || "").toLowerCase() === "true") {
    return { ok: true, reason: "skipped_by_env" };
  }
  // Prefer the dedicated webhook token (Account Auth Token for AC5833...).
  // Fall back to TWILIO_AUTH_TOKEN only if the dedicated one isn't set — note
  // that if TWILIO_AUTH_TOKEN holds an API Key Secret (starts with the API Key
  // pair), signature verification will ALWAYS fail. Twilio signs webhooks with
  // the Account Auth Token, not API Key secrets.
  //
  // Some flows place calls from a second Twilio account (e.g. Brandaro); those
  // callbacks are signed with THAT account's auth token. Pass the extra env var
  // names via opts.extraTokenEnvVars so a single endpoint can serve both.
  const tokenEnvVars = [
    "TWILIO_WEBHOOK_AUTH_TOKEN",
    "TWILIO_AUTH_TOKEN",
    ...(opts?.extraTokenEnvVars ?? []),
  ];
  const tokens = tokenEnvVars
    .map((name) => ({ name, value: Deno.env.get(name) || "" }))
    .filter((t) => t.value);
  if (tokens.length === 0) return { ok: false, reason: "no_auth_token" };

  const sig = req.headers.get("x-twilio-signature");
  if (!sig) return { ok: false, reason: "no_signature_header" };

  const candidates: { label: string; url: string }[] = [
    { label: "canonical", url: canonicalUrl(req) },
    { label: "x-forwarded", url: originalUrl(req) },
    { label: "req.url", url: req.url },
  ];

  const computed: Record<string, string> = {};
  for (const t of tokens) {
    for (const c of candidates) {
      const s = computeSig(t.value, c.url, params);
      computed[`${t.name}:${c.label}`] = s;
      if (s.length === sig.length) {
        let diff = 0;
        for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ sig.charCodeAt(i);
        if (diff === 0) return { ok: true, matchedUrl: c.label, matchedToken: t.name };
      }
    }
  }

  // Diagnostic — surface the exact mismatch so we can fix the URL/token.
  console.error("[verifyTwilio] signature mismatch", JSON.stringify({
    received_signature: sig,
    tokens_tried: tokens.map((t) => t.name),
    candidates: candidates.map((c) => ({ label: c.label, url: c.url })),
    x_forwarded_proto: req.headers.get("x-forwarded-proto"),
    x_forwarded_host: req.headers.get("x-forwarded-host"),
    host: req.headers.get("host"),
    twilio_account_sid_from_form: params.AccountSid || null,
    param_keys: Object.keys(params).sort(),
  }));
  return { ok: false, reason: "invalid_signature" };
}



/**
 * Verify Bland webhook via shared secret header (X-Bland-Secret) or query token.
 * Set BLAND_WEBHOOK_SECRET in env to enforce.
 */
export function verifyBland(req: Request): { ok: boolean; reason?: string } {
  const expected = Deno.env.get("BLAND_WEBHOOK_SECRET");
  if (!expected) return { ok: true, reason: "no_secret_configured" };
  const header = req.headers.get("x-bland-secret");
  const url = new URL(req.url);
  const qp = url.searchParams.get("secret");
  if (header === expected || qp === expected) return { ok: true };
  return { ok: false, reason: "invalid_bland_secret" };
}

/**
 * Build the Bland post-call webhook URL with the shared secret appended as a
 * query param. Bland's webhook delivery CANNOT set custom headers, so
 * ?secret= is the only auth channel verifyBland() can accept from real Bland
 * calls. Every function that registers a bland-agent-webhook URL with the
 * Bland API MUST pass it through this helper — a bare URL means every
 * post-call callback gets 401'd the moment BLAND_WEBHOOK_SECRET is set
 * (regression of 2026-07-22: a month of call results lost).
 * If the secret is unset the bare URL is returned (verification is a no-op).
 */
export function blandWebhookUrl(base: string): string {
  const secret = Deno.env.get("BLAND_WEBHOOK_SECRET");
  if (!secret) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}secret=${encodeURIComponent(secret)}`;
}

/**
 * Idempotent event log. The dedupe_key uses (call_sid|bland_call_id, event_type, optional bucket)
 * so duplicate webhook deliveries don't double-write.
 */
export async function logEvent(opts: {
  supabase: SupabaseClient;
  campaign_id?: string | null;
  queue_item_id?: string | null;
  call_session_id?: string | null;
  call_sid?: string | null;
  event_type: string;
  source: "twilio" | "bland" | "dispatcher" | "system";
  severity?: Severity;
  payload?: Record<string, unknown>;
  dedupe_bucket?: string; // optional extra bucket (e.g. status name) so the same call can have multiple events of same type at different stages
}): Promise<void> {
  const dedupe_key = (opts.call_sid || opts.queue_item_id)
    ? `${opts.call_sid || opts.queue_item_id}|${opts.event_type}|${opts.dedupe_bucket || ""}`
    : null;

  // Upsert by dedupe_key — duplicates are silently ignored.
  const row = {
    campaign_id: opts.campaign_id ?? null,
    queue_item_id: opts.queue_item_id ?? null,
    call_session_id: opts.call_session_id ?? null,
    call_sid: opts.call_sid ?? null,
    event_type: opts.event_type,
    source: opts.source,
    severity: opts.severity || "info",
    payload: opts.payload || {},
    dedupe_key,
  };
  const { error } = await opts.supabase
    .from("dialer_call_events")
    .upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error && !String(error.message || "").includes("duplicate")) {
    console.error("logEvent failed:", error.message);
  }
}

/**
 * Persist a webhook delivery to the idempotency ledger.
 * Returns true on first delivery, false if it was already processed.
 */
export async function recordWebhookDelivery(opts: {
  supabase: SupabaseClient;
  provider: "twilio" | "bland";
  external_id: string;
  event_type: string;
  call_session_id?: string | null;
  call_sid?: string | null;
  bland_call_id?: string | null;
  payload?: Record<string, unknown>;
}): Promise<boolean> {
  const { error } = await opts.supabase.from("dialer_webhook_events").insert({
    provider: opts.provider,
    external_id: opts.external_id,
    event_type: opts.event_type,
    call_session_id: opts.call_session_id ?? null,
    call_sid: opts.call_sid ?? null,
    bland_call_id: opts.bland_call_id ?? null,
    payload: opts.payload || {},
  });
  if (!error) return true;
  // Unique-violation = already processed; that's the success path for idempotency.
  if ((error as any).code === "23505" || /duplicate|unique/i.test(error.message || "")) return false;
  console.error("recordWebhookDelivery error:", error.message);
  return true; // if ledger write itself fails, default to processing rather than dropping events
}

/** Resolve queue + campaign context (call_session_id, campaign_id) by various keys. */
export async function resolveContext(
  supabase: SupabaseClient,
  keys: { queue_item_id?: string | null; call_sid?: string | null; bland_call_id?: string | null },
): Promise<{
  queue_item_id: string | null;
  campaign_id: string | null;
  call_session_id: string | null;
  business_id: string | null;
}> {
  const sel = "id, campaign_id, call_session_id, business_id";
  let row: any = null;
  if (keys.queue_item_id) {
    const { data } = await supabase.from("outbound_call_queue").select(sel).eq("id", keys.queue_item_id).maybeSingle();
    row = data;
  }
  if (!row && keys.call_sid) {
    const { data } = await supabase.from("outbound_call_queue").select(sel).eq("twilio_call_sid", keys.call_sid).maybeSingle();
    row = data;
  }
  if (!row && keys.bland_call_id) {
    const { data } = await supabase.from("outbound_call_queue").select(sel).eq("bland_call_id", keys.bland_call_id).maybeSingle();
    row = data;
  }
  return {
    queue_item_id: row?.id ?? keys.queue_item_id ?? null,
    campaign_id: row?.campaign_id ?? null,
    call_session_id: row?.call_session_id ?? null,
    business_id: row?.business_id ?? null,
  };
}
