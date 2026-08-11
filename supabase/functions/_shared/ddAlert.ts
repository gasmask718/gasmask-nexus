// Dynasty Direct — shared error logging + SMS escalation.
//
// Every DD money-path failure (checkout, pricing, description, product save)
// lands in public.dd_error_log. FAILURES on critical sources also SMS David,
// deduped per (source, severity) for DD_ALERT_DEDUPE_MINUTES.
//
// Never throws: alerting must not take down the path it is watching.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_API_SID = Deno.env.get("TWILIO_API_SID") || "";
const TWILIO_API_SECRET = Deno.env.get("TWILIO_API_SECRET") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const ESCALATION_PHONE =
  Deno.env.get("HEALTH_ESCALATION_PHONE") ||
  Deno.env.get("DAVID_PHONE_NUMBER") ||
  Deno.env.get("ADMIN_ALERT_PHONE") ||
  Deno.env.get("DAVID_PHONE") || "";
const ESCALATION_FROM =
  Deno.env.get("HEALTH_ESCALATION_FROM") ||
  Deno.env.get("TWILIO_FROM_NUMBER") ||
  Deno.env.get("TWILIO_PHONE_NUMBER") ||
  "+18776818621";
const DEDUPE_MINUTES = Number(Deno.env.get("DD_ALERT_DEDUPE_MINUTES") || "30");

export type DdErrorSeverity = "warn" | "error";

export interface DdErrorInput {
  source: string; // e.g. 'dd-create-checkout'
  message: string;
  severity?: DdErrorSeverity;
  context?: Record<string, unknown>;
  /** Set false to log without paging David (default true for severity=error). */
  alert?: boolean;
}

function twAuthHeader(): string | null {
  if (TWILIO_API_SID && TWILIO_API_SECRET) {
    return "Basic " + btoa(`${TWILIO_API_SID}:${TWILIO_API_SECRET}`);
  }
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    return "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  }
  return null;
}

async function sendSms(body: string): Promise<boolean> {
  const auth = twAuthHeader();
  if (!auth || !ESCALATION_PHONE) return false;
  try {
    const r = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: ESCALATION_PHONE,
          From: ESCALATION_FROM,
          Body: body.slice(0, 320),
        }),
      },
    );
    return r.ok;
  } catch (_e) {
    return false;
  }
}

/**
 * Log a Dynasty Direct failure and (for severity=error) page David over SMS.
 * Returns the log row id when persisted, otherwise null. Never throws.
 */
export async function logDdError(input: DdErrorInput): Promise<string | null> {
  const severity: DdErrorSeverity = input.severity ?? "error";
  const shouldAlert = input.alert ?? severity === "error";
  try {
    const client = createClient(SUPABASE_URL, SERVICE_KEY);

    let alerted = false;
    if (shouldAlert) {
      const cutoff = new Date(Date.now() - DEDUPE_MINUTES * 60_000)
        .toISOString();
      const { data: recent } = await client
        .from("dd_error_log")
        .select("id")
        .eq("source", input.source)
        .eq("alerted", true)
        .gte("created_at", cutoff)
        .limit(1);
      if (!recent || recent.length === 0) {
        alerted = await sendSms(
          `🚨 Dynasty Direct — ${input.source}\n${input.message}`,
        );
      }
    }

    const { data, error } = await client
      .from("dd_error_log")
      .insert({
        source: input.source,
        severity,
        message: String(input.message ?? "unknown").slice(0, 2000),
        context: input.context ?? {},
        alerted,
      })
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[ddAlert] insert failed", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[ddAlert] threw", (e as Error).message);
    return null;
  }
}
