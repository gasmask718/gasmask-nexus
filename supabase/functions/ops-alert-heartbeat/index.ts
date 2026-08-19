// Ops alert channel HEARTBEAT.
//
// Why this exists: between 2026-06-27 and 2026-07-04 BOTH legs of the ops
// alert channel died (Twilio 20003 on SMS, Gmail 534-5.7.9 on email) and
// nobody noticed for six weeks. An alerting channel fails silently by
// definition — silence is also what a healthy channel looks like. So the
// channel must emit a POSITIVE signal on a schedule, and something else must
// watch for the ABSENCE of that signal.
//
//   this function  → sends one heartbeat/day through the real sendOpsAlert()
//                    path, writing admin_notifications_log rows as a side
//                    effect of the real send (not a synthetic marker).
//   comms-health-monitor → layer "alert_channel", FAILS when no successful
//                    heartbeat row exists in the last 26h.
//
// The watcher never routes through the alert channel to report on it: it
// writes to comms_health_checks, which is read by the UI directly.
//
// verify_jwt = false — invoked by pg_cron. Idempotent; safe to spam.

import { sendOpsAlert } from "../_shared/opsAlert.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export const HEARTBEAT_SOURCE = "ops-alert-heartbeat";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const now = new Date();
  const res = await sendOpsAlert({
    source: HEARTBEAT_SOURCE,
    severity: "info",
    subject: `[Dynasty OS] Ops alert channel heartbeat — ${
      now.toISOString().slice(0, 10)
    }`,
    message:
      "This is the daily proof that the ops alert channel can deliver. " +
      "If you stop receiving it, the channel is down and every other alert " +
      "the platform raises is going nowhere. comms-health-monitor watches " +
      "for the absence of this message and will mark alert_channel as FAIL " +
      "after 26 hours without one.",
    context: { sent_at: now.toISOString(), kind: "heartbeat" },
    // Email only. The SMS leg is escalation-only and costs money; its health
    // is proven by comms-health-monitor's credentials layer, not by paging a
    // handset once a day.
    sms: false,
  });

  return new Response(
    JSON.stringify({
      ok: res.emailSent,
      source: HEARTBEAT_SOURCE,
      email_sent: res.emailSent,
      sms_sent: res.smsSent,
      errors: res.errors,
      sent_at: now.toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
