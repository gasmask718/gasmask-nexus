/**
 * _shared/twilioSend.ts — in-process SMS module for Groups A–D.
 *
 * Two send paths exist on purpose:
 *
 *   Group E (campaign / outreach)  → `_shared/sendSms.ts` → the `send-sms`
 *     edge function. It owns idempotency, daily caps, per-number cooldown,
 *     duplicate-content detection and the `outbound_messages` audit trail.
 *     Campaigns are exactly what those budgets exist for.
 *
 *   Groups A–D (internal alerts, test harnesses, transactional receipts,
 *     workforce/partner dispatch) → THIS module. It talks to Twilio in
 *     process: no extra network hop, no shared rate budget that lets a
 *     campaign starve a payment receipt, and no new single point of failure
 *     in front of a customer's booking confirmation.
 *
 * The class param is MANDATORY and has NO default. A compile-time answer
 * beats a review-time one: a new function physically cannot land in the wrong
 * bucket silently.
 *
 * ONE rule crosses class boundaries: `legalStopBlocked()`. It is written once
 * and called once, from `sendTwilioSms()`, for every class. A rule expressed
 * four times becomes a rule enforced three times.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isSuppressed, normalizeE164, phoneLast10 } from "./dnc.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_API_SID = Deno.env.get("TWILIO_API_SID") || "";
const TWILIO_API_SECRET = Deno.env.get("TWILIO_API_SECRET") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const DEFAULT_FROM = Deno.env.get("TWILIO_FROM_NUMBER") ||
  Deno.env.get("TWILIO_PHONE_NUMBER") || "";

/**
 * Suppression class. No default — every call site must state what it is.
 *
 *  internal      Group A. Ops/admin recipients on constant, staff-owned
 *                numbers. Not marketing, not DNC-eligible, never suppressed
 *                (including by a legal STOP — a staff handset that texts STOP
 *                is a staffing problem, not a consent one).
 *  test          Group B. Credential/deliverability harnesses. Exempt by
 *                design; they exist to test the pipe itself.
 *  transactional Group C. Customer-initiated: receipts, confirmations, OTPs.
 *                Not marketing-suppressed, but a legal STOP is absolute.
 *  workforce     Group D. Contracted relationship: VAs, drivers, partners,
 *                dispatch. Exempt from marketing DNC; legal STOP is absolute.
 *  campaign      Group E. Full suppression. Do NOT use this module — route
 *                through `_shared/sendSms.ts`. Passing it here is refused so
 *                the mistake is loud instead of silent.
 */
export type SuppressionClass =
  | "internal"
  | "test"
  | "transactional"
  | "workforce"
  | "campaign";

/** Classes that bypass the legal STOP gate. Nothing else may. */
const STOP_EXEMPT: ReadonlySet<SuppressionClass> = new Set([
  "internal",
  "test",
]);

export interface TwilioSendOptions {
  to: string;
  body: string;
  /** MANDATORY. See SuppressionClass. */
  suppressionClass: SuppressionClass;
  /** Emitting function, for logs. */
  source: string;
  from?: string | null;
  messagingServiceSid?: string | null;
  statusCallback?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TwilioSendResult {
  success: boolean;
  /** "sent" | "blocked" | "invalid_number" | "not_configured" | "wrong_channel" | "error" */
  status: string;
  sid: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  /** True only when suppression refused the send (never an error). */
  blocked: boolean;
  blockedReason?: string;
}

function sb() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

function result(
  status: string,
  errorMessage: string | null,
  extra: Partial<TwilioSendResult> = {},
): TwilioSendResult {
  return {
    success: false,
    status,
    sid: null,
    errorCode: status,
    errorMessage,
    blocked: status === "blocked",
    ...extra,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// THE ONE CROSS-CLASS RULE
// ───────────────────────────────────────────────────────────────────────────

/**
 * A legal STOP is absolute for every class except `internal` and `test`.
 * A carrier-level STOP keyword revokes consent for ALL non-emergency traffic
 * to that handset — transactional and workforce included. This is the only
 * rule that crosses class boundaries and it lives in exactly one place.
 *
 * Fails CLOSED: if the lookup errors we refuse the send.
 */
export async function legalStopBlocked(
  supabase: unknown,
  phone: string,
): Promise<{ blocked: boolean; reason?: string }> {
  const last10 = phoneLast10(phone);
  if (!last10) return { blocked: false };
  const client = supabase as ReturnType<typeof sb>;

  try {
    // opt_out_events is the SMS STOP ledger — every row is a keyword opt-out.
    const { data: oo, error: ooErr } = await client
      .from("opt_out_events")
      .select("id")
      .eq("phone_last10", last10)
      .limit(1);
    if (ooErr) throw ooErr;
    if (oo && oo.length) {
      return { blocked: true, reason: "sms_stop:opt_out_events" };
    }

    // dnc_list carries both voice DNC and mirrored SMS STOPs. Only the STOP
    // rows are legally absolute; a manual/marketing DNC entry is not.
    const { data: dnc, error: dncErr } = await client
      .from("dnc_list")
      .select("reason, source")
      .eq("phone_last10", last10)
      .limit(5);
    if (dncErr) throw dncErr;
    const stopRow = (dnc || []).find((r: Record<string, unknown>) =>
      /stop|opt.?out|unsubscrib/i.test(
        `${r.source ?? ""} ${r.reason ?? ""}`,
      )
    );
    if (stopRow) return { blocked: true, reason: "sms_stop:dnc_list" };

    return { blocked: false };
  } catch (e) {
    console.error("[twilioSend] legal STOP lookup failed:", (e as Error).message);
    return { blocked: true, reason: "stop_lookup_failed" };
  }
}

// ───────────────────────────────────────────────────────────────────────────

function twAuthHeader(): { header: string; mode: string } | null {
  if (TWILIO_API_SID && TWILIO_API_SECRET) {
    return {
      header: "Basic " + btoa(`${TWILIO_API_SID}:${TWILIO_API_SECRET}`),
      mode: "api_key",
    };
  }
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    // Standing rule: an account SID must start with "AC". An API key SID (SK)
    // in this slot is the 20003 class of failure that killed ops alerting.
    if (!TWILIO_ACCOUNT_SID.startsWith("AC")) {
      console.error("[twilioSend] TWILIO_ACCOUNT_SID must start with 'AC'");
      return null;
    }
    return {
      header: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      mode: "account_token",
    };
  }
  return null;
}

async function logSend(
  opts: TwilioSendOptions,
  to: string,
  res: TwilioSendResult,
  authMode: string | null,
) {
  try {
    await sb().from("admin_notifications_log").insert({
      event_type: `sms:${opts.suppressionClass}:${opts.source}`,
      channel: "sms",
      recipient: to,
      body: opts.body.slice(0, 4000),
      status: res.success ? "sent" : res.blocked ? "blocked" : "failed",
      metadata: {
        provider: "twilio",
        suppression_class: opts.suppressionClass,
        source: opts.source,
        sid: res.sid,
        error_code: res.errorCode,
        error_message: res.errorMessage,
        blocked_reason: res.blockedReason ?? null,
        auth_mode: authMode,
        ...(opts.metadata || {}),
      },
    });
  } catch (e) {
    console.error("[twilioSend] log insert failed:", (e as Error).message);
  }
}

/**
 * Send one SMS through Twilio, in process, with class-appropriate suppression.
 * Never throws.
 */
export async function sendTwilioSms(
  opts: TwilioSendOptions,
): Promise<TwilioSendResult> {
  const cls = opts.suppressionClass;

  if (cls === "campaign") {
    const r = result(
      "wrong_channel",
      "campaign traffic must route through _shared/sendSms.ts (send-sms), not twilioSend",
    );
    console.error(`[twilioSend] ${opts.source}: ${r.errorMessage}`);
    return r;
  }

  const to = normalizeE164(opts.to);
  if (!to) return result("invalid_number", `unparseable destination: ${opts.to}`);
  if (!opts.body?.trim()) return result("error", "empty body");

  const supabase = sb();

  // 1) The one cross-class rule.
  if (!STOP_EXEMPT.has(cls)) {
    const stop = await legalStopBlocked(supabase, to);
    if (stop.blocked) {
      const r = result("blocked", `legal STOP in effect (${stop.reason})`, {
        blockedReason: stop.reason,
      });
      await logSend(opts, to, r, null);
      return r;
    }
  }

  // 2) Class-specific suppression. Only marketing-class traffic consults the
  //    full DNC/marketing suppression surface — and that class does not use
  //    this module, so this is the belt to the campaign guard's braces.
  if (cls !== "internal" && cls !== "test" && cls !== "transactional" &&
    cls !== "workforce") {
    const sup = await isSuppressed(supabase, to);
    if (sup.blocked) {
      const r = result("blocked", `suppressed (${sup.reason})`, {
        blockedReason: sup.reason,
      });
      await logSend(opts, to, r, null);
      return r;
    }
  }

  // 3) Credentials.
  const auth = twAuthHeader();
  if (!auth) {
    const r = result("not_configured", "Twilio credentials not configured");
    await logSend(opts, to, r, null);
    return r;
  }
  const from = opts.from || DEFAULT_FROM;
  if (!from && !opts.messagingServiceSid) {
    const r = result("not_configured", "no From number or Messaging Service SID");
    await logSend(opts, to, r, auth.mode);
    return r;
  }

  // 4) Send.
  const params = new URLSearchParams({ To: to, Body: opts.body.slice(0, 1500) });
  if (opts.messagingServiceSid) {
    params.set("MessagingServiceSid", opts.messagingServiceSid);
  } else {
    params.set("From", from);
  }
  if (opts.statusCallback) params.set("StatusCallback", opts.statusCallback);

  try {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: auth.header,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    const text = await r.text();
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text); } catch { /* keep raw */ }

    if (!r.ok) {
      const res = result(
        "error",
        `twilio ${r.status}: ${String(parsed.message ?? text).slice(0, 300)}`,
        { errorCode: String(parsed.code ?? r.status) },
      );
      console.error(`[twilioSend] ${opts.source} -> ${to}: ${res.errorMessage}`);
      await logSend(opts, to, res, auth.mode);
      return res;
    }

    const ok: TwilioSendResult = {
      success: true,
      status: String(parsed.status || "queued"),
      sid: (parsed.sid as string) || null,
      errorCode: null,
      errorMessage: null,
      blocked: false,
    };
    await logSend(opts, to, ok, auth.mode);
    return ok;
  } catch (e) {
    const res = result("error", (e as Error).message);
    await logSend(opts, to, res, auth.mode);
    return res;
  }
}
