// Dynasty OS — canonical INTERNAL OPS ALERT channel (Group A).
//
// Why this exists: between 2026-06-27 and 2026-07-04 the platform's own
// alerting produced a 96% failure rate (740/770 SMS, Twilio 20003
// "Authenticate") and the email leg died with Gmail 534-5.7.9. Every alert
// we build — health banner, payout notice, manual review, dispatch monitor —
// fires into that channel. So the channel itself is now:
//
//   1. EMAIL FIRST. An ops mailbox is multi-recipient, has no STOP keyword,
//      no carrier filtering, no A2P registration, and no single handset.
//   2. SMS SECOND, and only as an escalation for severity="critical".
//   3. NEVER suppressed. Internal alerts go to constant, staff-owned
//      addresses; they are not marketing and are not DNC-eligible.
//   4. ALWAYS LOGGED. Every attempt writes admin_notifications_log with the
//      real provider error, so a dead channel is visible in one query
//      instead of two months later.
//
// Never throws: alerting must not take down the path it is watching.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const OPS_ALERT_FROM = Deno.env.get("OPS_ALERT_FROM") ||
  "Dynasty OS Alerts <onboarding@resend.dev>";
const OPS_ALERT_EMAIL = Deno.env.get("OPS_ALERT_EMAIL") ||
  Deno.env.get("ADMIN_ALERT_EMAIL") || "";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_API_SID = Deno.env.get("TWILIO_API_SID") || "";
const TWILIO_API_SECRET = Deno.env.get("TWILIO_API_SECRET") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const OPS_ALERT_PHONE = Deno.env.get("HEALTH_ESCALATION_PHONE") ||
  Deno.env.get("ADMIN_ALERT_PHONE") ||
  Deno.env.get("DAVID_PHONE_NUMBER") || "";
const OPS_ALERT_SMS_FROM = Deno.env.get("HEALTH_ESCALATION_FROM") ||
  Deno.env.get("TWILIO_FROM_NUMBER") ||
  Deno.env.get("TWILIO_PHONE_NUMBER") || "";

export type OpsAlertSeverity = "info" | "warn" | "error" | "critical";

export interface OpsAlertInput {
  /** Emitting system, e.g. "dd-create-checkout" or "comms-health-monitor". */
  source: string;
  message: string;
  severity?: OpsAlertSeverity;
  subject?: string;
  context?: Record<string, unknown>;
  /** Force/forbid the SMS escalation leg (default: only when severity=critical). */
  sms?: boolean;
}

export interface OpsAlertResult {
  emailSent: boolean;
  smsSent: boolean;
  errors: string[];
}

function client() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

async function logAttempt(
  source: string,
  channel: "email" | "sms",
  recipient: string,
  body: string,
  ok: boolean,
  meta: Record<string, unknown>,
) {
  try {
    await client().from("admin_notifications_log").insert({
      event_type: `ops_alert:${source}`,
      channel,
      recipient,
      body: body.slice(0, 4000),
      status: ok ? "sent" : "failed",
      metadata: meta,
    });
  } catch (e) {
    console.error("[opsAlert] log insert failed", (e as Error).message);
  }
}

async function sendOpsEmail(
  subject: string,
  text: string,
  source: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY not set" };
  if (!OPS_ALERT_EMAIL) {
    return { ok: false, error: "OPS_ALERT_EMAIL/ADMIN_ALERT_EMAIL not set" };
  }
  // Resend matches the sandbox recipient case-sensitively — normalise.
  const to = OPS_ALERT_EMAIL.split(",").map((s) => s.trim().toLowerCase()).filter(
    Boolean,
  );
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: OPS_ALERT_FROM,
        to,
        subject,
        text,
      }),
    });
    const bodyText = await r.text();
    if (!r.ok) {
      console.error(`[opsAlert] resend ${r.status}: ${bodyText}`);
      await logAttempt(source, "email", to.join(","), text, false, {
        provider: "resend",
        status: r.status,
        response: bodyText.slice(0, 800),
      });
      return { ok: false, error: `resend ${r.status}: ${bodyText.slice(0, 200)}` };
    }
    await logAttempt(source, "email", to.join(","), text, true, {
      provider: "resend",
      status: r.status,
    });
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    await logAttempt(source, "email", OPS_ALERT_EMAIL, text, false, {
      provider: "resend",
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

function twAuthHeader(): { header: string; mode: string } | null {
  if (TWILIO_API_SID && TWILIO_API_SECRET) {
    return {
      header: "Basic " + btoa(`${TWILIO_API_SID}:${TWILIO_API_SECRET}`),
      mode: "api_key",
    };
  }
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    if (!TWILIO_ACCOUNT_SID.startsWith("AC")) {
      console.error("[opsAlert] TWILIO_ACCOUNT_SID must start with 'AC'");
      return null;
    }
    return {
      header: "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
      mode: "account_token",
    };
  }
  return null;
}

async function sendOpsSms(
  text: string,
  source: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = twAuthHeader();
  if (!auth) return { ok: false, error: "twilio credentials not configured" };
  if (!OPS_ALERT_PHONE) return { ok: false, error: "OPS alert phone not set" };
  if (!OPS_ALERT_SMS_FROM) return { ok: false, error: "OPS alert from-number not set" };
  try {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: auth.header,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: OPS_ALERT_PHONE,
          From: OPS_ALERT_SMS_FROM,
          Body: text.slice(0, 320),
        }),
      },
    );
    const bodyText = await r.text();
    await logAttempt(source, "sms", OPS_ALERT_PHONE, text, r.ok, {
      provider: "twilio",
      auth_mode: auth.mode,
      status: r.status,
      response: r.ok ? undefined : bodyText.slice(0, 500),
    });
    if (!r.ok) {
      console.error(`[opsAlert] twilio ${r.status}: ${bodyText.slice(0, 300)}`);
      return { ok: false, error: `twilio ${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    await logAttempt(source, "sms", OPS_ALERT_PHONE, text, false, {
      provider: "twilio",
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

/**
 * Send an internal ops alert. Email first, SMS only as a critical escalation.
 * Internal alerts are NEVER suppression-checked — recipients are staff-owned
 * constants, not leads. Never throws.
 */
export async function sendOpsAlert(
  input: OpsAlertInput,
): Promise<OpsAlertResult> {
  const severity = input.severity ?? "error";
  const subject = input.subject ??
    `[${severity.toUpperCase()}] ${input.source}`;
  const ctx = input.context && Object.keys(input.context).length
    ? `\n\nContext:\n${JSON.stringify(input.context, null, 2).slice(0, 3000)}`
    : "";
  const text = `${input.message}\n\nSource: ${input.source}\nSeverity: ${severity}\nTime: ${
    new Date().toISOString()
  }${ctx}`;

  const errors: string[] = [];
  const email = await sendOpsEmail(subject, text, input.source);
  if (!email.ok && email.error) errors.push(`email: ${email.error}`);

  const wantSms = input.sms ?? severity === "critical";
  let smsSent = false;
  if (wantSms) {
    const sms = await sendOpsSms(`${subject}\n${input.message}`, input.source);
    smsSent = sms.ok;
    if (!sms.ok && sms.error) errors.push(`sms: ${sms.error}`);
  }

  if (!email.ok && !smsSent) {
    console.error(`[opsAlert] ALL CHANNELS FAILED for ${input.source}:`, errors);
  }
  return { emailSent: email.ok, smsSent, errors };
}
