// Dynasty Direct — shared error logging + ops escalation.
//
// Every DD money-path failure (checkout, pricing, description, product save)
// lands in public.dd_error_log. FAILURES on critical sources also page ops,
// deduped per (source, severity) for DD_ALERT_DEDUPE_MINUTES.
//
// Delivery is delegated to _shared/opsAlert.ts (email-first, SMS only on
// severity=critical). This file no longer talks to Twilio directly — the
// direct-SMS path is what produced a 96% silent failure rate in June/July.
//
// Never throws: alerting must not take down the path it is watching.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendOpsAlert } from "./opsAlert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEDUPE_MINUTES = Number(Deno.env.get("DD_ALERT_DEDUPE_MINUTES") || "30");

export type DdErrorSeverity = "warn" | "error";

export interface DdErrorInput {
  source: string; // e.g. 'dd-create-checkout'
  message: string;
  severity?: DdErrorSeverity;
  context?: Record<string, unknown>;
  /** Set false to log without paging ops (default true for severity=error). */
  alert?: boolean;
  /** Escalate to SMS as well as email (money-path outages). */
  critical?: boolean;
}

/**
 * Log a Dynasty Direct failure and (for severity=error) page ops.
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
        const res = await sendOpsAlert({
          source: input.source,
          message: `🚨 Dynasty Direct — ${input.message}`,
          severity: input.critical ? "critical" : severity,
          subject: `[Dynasty Direct] ${input.source}`,
          context: input.context,
        });
        alerted = res.emailSent || res.smsSent;
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
