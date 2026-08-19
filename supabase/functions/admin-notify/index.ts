// Real-time admin notification dispatcher.
// Routes platform events to SMS + email recipients, honors admin
// preferences + quiet hours, and logs every attempt.
//
// Event sources:
//   - new_booking / high_value_booking: create-tt-booking, receive-public-booking
//   - payment_failed: tt-finalize-accept (Stripe webhook path)
//   - sla_breach: detect-sla-breaches cron
//   - dispatch_failure: tt-smart-dispatch
//   - customer_flagged: Public Site customer_ratings INSERT (rating <= 2 OR
//     flags non-empty) -> receive-customer-rating-event -> admin-notify
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { SMS_TEMPLATES } from "../_shared/smsTemplates.ts";
import { sendEmail } from "../_shared/sendEmail.ts";
import { sendTwilioSms } from "../_shared/twilioSend.ts";

type EventType =
  | "new_booking"
  | "payment_failed"
  | "customer_flagged"
  | "sla_breach"
  | "high_value_booking"
  | "dispatch_failure";

interface Payload {
  event_type: EventType;
  related_id?: string;
  related_table?: string;
  data: Record<string, any>;
}

function buildMessage(event_type: EventType, data: Record<string, any>): { sms: string; subject: string; emailBody: string } {
  let sms = "";
  let subject = "";
  switch (event_type) {
    case "new_booking":
      sms = (SMS_TEMPLATES as any).admin_new_booking
        ? (SMS_TEMPLATES as any).admin_new_booking(data)
        : `🆕 New TopTier ${data.service_name} booking from ${data.customer_name} ($${data.amount}) #${data.booking_id_short}`;
      subject = `New TopTier ${data.service_name} booking`;
      break;
    case "payment_failed":
      sms = (SMS_TEMPLATES as any).admin_payment_failed
        ? (SMS_TEMPLATES as any).admin_payment_failed(data)
        : `⚠ Payment failed: ${data.customer_name} $${data.amount} #${data.booking_id_short}`;
      subject = `⚠ Payment failed`;
      break;
    case "customer_flagged":
      sms = (SMS_TEMPLATES as any).admin_customer_flagged
        ? (SMS_TEMPLATES as any).admin_customer_flagged(data)
        : `⚠ Customer flagged: ${data.customer_name} — ${data.reason}`;
      subject = `⚠ Customer flagged`;
      break;
    case "sla_breach":
      sms = (SMS_TEMPLATES as any).admin_pending_sla_breach
        ? (SMS_TEMPLATES as any).admin_pending_sla_breach(data)
        : `⏰ SLA breach: ${data.service_name} pending ${data.minutes_pending}m #${data.booking_id_short}`;
      subject = `⏰ TopTier pending SLA breach`;
      break;
    case "high_value_booking":
      sms = `💎 High-value TopTier booking: $${data.amount} ${data.service_name}\nCustomer: ${data.customer_name}\n#${data.booking_id_short}`;
      subject = `💎 High-value booking`;
      break;
    case "dispatch_failure":
      sms = `❌ TopTier dispatch failure\n${data.service_name} #${data.booking_id_short}\nReason: ${data.reason}\nNeeds manual handling.`;
      subject = `❌ Dispatch failure`;
      break;
  }
  const link = data.booking_id || data.related_id
    ? `\n\nReview: https://toptierexperience.com/admin/bookings/${data.booking_id || data.related_id}`
    : "";
  return { sms, subject, emailBody: sms + link };
}

function isInQuietHours(now: Date, startStr?: string | null, endStr?: string | null): boolean {
  if (!startStr || !endStr) return false;
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  // overnight window
  return minutes >= start || minutes < end;
}

const ADMIN_NOTIFY_VERSION = "2026-07-06T-sla-cooldown-v2";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Version probe: GET or ?version=1 returns the deployed version marker
  const url = new URL(req.url);
  if (req.method === "GET" || url.searchParams.get("version")) {
    return new Response(
      JSON.stringify({ ok: true, version: ADMIN_NOTIFY_VERSION, deployed_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }


  try {
    const body = (await req.json()) as Payload;
    const { event_type, related_id, related_table, data = {} } = body;

    if (!event_type) {
      return new Response(JSON.stringify({ ok: false, error: "event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { sms, subject, emailBody } = buildMessage(event_type, { ...data, related_id });
    const now = new Date();
    const results: any[] = [];

    // sla_breach cooldown: cron sends a string bucket key (e.g. "sla_breach:2026-07-06-14")
    // in data.related_id. related_id column is uuid so we stash the bucket in
    // metadata.dedup_key and gate on that. Scoped to sla_breach ONLY — all other
    // event_types keep their original behavior untouched.
    const slaDedupKey: string | null =
      event_type === "sla_breach"
        ? ((data?.related_id ?? related_id ?? null) as string | null)
        : null;

    if (event_type === "sla_breach" && slaDedupKey) {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("admin_notifications_log")
        .select("sent_at")
        .eq("event_type", "sla_breach")
        .eq("status", "sent")
        .filter("metadata->>dedup_key", "eq", slaDedupKey)
        .gte("sent_at", sixHoursAgo)
        .limit(1);
      if (recent && recent.length > 0) {
        await supabase.from("admin_notifications_log").insert({
          event_type,
          related_table,
          channel: "none",
          recipient: "none",
          body: sms,
          status: "suppressed",
          metadata: { ...data, dedup_key: slaDedupKey, reason: "cooldown_active" },
        });
        return new Response(
          JSON.stringify({ ok: true, suppressed: true, reason: "cooldown_active" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Fallback global recipients via secrets
    const globalSms = Deno.env.get("ADMIN_ALERT_PHONE");
    const globalEmail = Deno.env.get("ADMIN_ALERT_EMAIL");

    // Per-admin preferences override / extend
    const { data: prefs } = await supabase
      .from("admin_notification_preferences")
      .select("admin_user_id, channel, is_enabled, quiet_hours_start, quiet_hours_end")
      .eq("event_type", event_type);

    type Recipient = { channel: "sms" | "email"; address: string; quietSms?: boolean };
    const recipients: Recipient[] = [];

    if (globalSms) recipients.push({ channel: "sms", address: globalSms });
    if (globalEmail) recipients.push({ channel: "email", address: globalEmail });

    // Per-user prefs (best effort — pulls profile email/phone)
    if (prefs?.length) {
      const userIds = prefs.map((p) => p.admin_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, phone")
        .in("id", userIds);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      for (const pref of prefs) {
        if (!pref.is_enabled) continue;
        const prof: any = pmap.get(pref.admin_user_id);
        if (!prof) continue;
        const quiet = isInQuietHours(now, pref.quiet_hours_start, pref.quiet_hours_end);
        if ((pref.channel === "sms" || pref.channel === "both") && prof.phone && !quiet) {
          recipients.push({ channel: "sms", address: prof.phone });
        }
        if (pref.channel === "email" || pref.channel === "both") {
          if (prof.email) recipients.push({ channel: "email", address: prof.email });
        }
      }
    }

    // Dedup
    const seen = new Set<string>();
    const unique = recipients.filter((r) => {
      const k = `${r.channel}:${r.address}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    // For sla_breach, do NOT put the string bucket into the uuid related_id column,
    // and stamp metadata.dedup_key on every log row so the cooldown query above sees it.
    const logRelatedId = event_type === "sla_breach" ? null : related_id;
    const metaBase: Record<string, any> = { ...data };
    if (event_type === "sla_breach" && slaDedupKey) metaBase.dedup_key = slaDedupKey;

    for (const r of unique) {
      try {
        if (r.channel === "sms") {
          const idemKey =
            event_type === "sla_breach" && slaDedupKey
              ? slaDedupKey
              : (related_id ?? crypto.randomUUID());
          const idem = `admin-notify:${event_type}:${idemKey}:${r.address}`;
          // Group A: admin/staff recipients. In-process send with the class
          // stated — these are internal alerts, not campaign traffic, and
          // must not compete for the campaign daily budget.
          const resp = await sendTwilioSms({
            to: r.address,
            body: sms,
            suppressionClass: "internal",
            source: "admin-notify",
            metadata: { event_type, related_id, related_table, idempotency_key: idem },
          });
          if (!resp.success) throw new Error(resp.errorMessage || "sms failed");
        } else {
          const er = await sendEmail({ to: r.address, subject, text: emailBody });
          if (!er.success) throw new Error(er.error || "email failed");
        }
        await supabase.from("admin_notifications_log").insert({
          event_type, related_id: logRelatedId, related_table,
          channel: r.channel, recipient: r.address,
          body: r.channel === "sms" ? sms : emailBody,
          status: "sent", metadata: metaBase,
        });
        results.push({ ...r, ok: true });
      } catch (err: any) {
        await supabase.from("admin_notifications_log").insert({
          event_type, related_id: logRelatedId, related_table,
          channel: r.channel, recipient: r.address,
          body: r.channel === "sms" ? sms : emailBody,
          status: "failed", metadata: { ...metaBase, error: err?.message },
        });
        results.push({ ...r, ok: false, error: err?.message });
      }
    }

    if (unique.length === 0) {
      await supabase.from("admin_notifications_log").insert({
        event_type, related_id: logRelatedId, related_table,
        channel: "none", recipient: "none",
        body: sms, status: "suppressed", metadata: metaBase,
      });
    }

    return new Response(JSON.stringify({ ok: true, dispatched: unique.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[admin-notify] error", err);
    return new Response(JSON.stringify({ ok: false, error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
