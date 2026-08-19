// Bulk SMS processor — orchestrates ambassador SMS blasts.
// Invoked by:
//   1. The frontend immediately after a "Send Now" job is created (user JWT).
//   2. pg_cron every 5 min for paused/scheduled jobs (service-role JWT).
// Processes pending items with pacing, re-checks skip conditions, sends via Twilio gateway,
// writes communication_messages rows, updates job + item counters in real time.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifiedInsertSoft } from "../_shared/verifiedWrite.ts";
import { sendSms } from "../_shared/sendSms.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const MAX_RUNTIME_MS = 140_000; // stay under 150s edge limit; pause and resume via cron

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
const DEFAULT_FROM = Deno.env.get("TWILIO_DEFAULT_FROM") || Deno.env.get("TWILIO_PHONE_NUMBER");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// SMS quiet hours = 8a–9p ET (UTC-5)
function isSmsQuietHours(): boolean {
  const h = (new Date().getUTCHours() - 5 + 24) % 24;
  return h < 8 || h >= 21;
}

function hydrate(tpl: string, vars: Record<string, any>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let job_id: string;
  try { ({ job_id } = await req.json()); } catch { return json({ error: "invalid_json" }, 400); }
  if (!job_id) return json({ error: "missing_job_id" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Load + lock job
  const { data: job, error: jobErr } = await admin
    .from("ambassador_bulk_jobs")
    .select("*")
    .eq("id", job_id)
    .maybeSingle();
  if (jobErr || !job) return json({ error: "job_not_found" }, 404);
  if (["complete", "cancelled", "failed"].includes(job.status)) {
    return json({ ok: true, status: job.status, message: "already_finalized" });
  }
  if (job.job_type !== "sms_blast") return json({ error: "wrong_job_type" }, 400);
  if (job.scheduled_for && new Date(job.scheduled_for) > new Date()) {
    return json({ ok: true, message: "not_yet_scheduled" });
  }

  // Load ambassador
  const { data: amb } = await admin
    .from("ambassadors")
    .select("id, twilio_number, name, user_id, is_active")
    .eq("id", job.ambassador_id).maybeSingle();
  if (!amb?.is_active) {
    await admin.from("ambassador_bulk_jobs")
      .update({ status: "failed", error_summary: { error: "ambassador_inactive" }, completed_at: new Date().toISOString() })
      .eq("id", job_id);
    return json({ error: "ambassador_inactive" }, 403);
  }

  // Load template if present
  let template: any = null;
  if (job.template_id) {
    const { data: tpl } = await admin
      .from("ambassador_message_templates").select("*")
      .eq("id", job.template_id).maybeSingle();
    template = tpl;
  }

  // Mark processing
  await admin.from("ambassador_bulk_jobs")
    .update({ status: "processing", started_at: job.started_at || new Date().toISOString() })
    .eq("id", job_id);

  const fromNumber = amb.twilio_number || DEFAULT_FROM;
  const customVars = (job.custom_variables as Record<string, any>) || {};
  const pacingMs = Math.max(0, (job.pacing_seconds || 3) * 1000);
  const startedAt = Date.now();

  // Page through pending items
  const PAGE_SIZE = 50;
  let cursor = 0;
  let processedThisRun = 0;
  let timedOut = false;

  while (true) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) { timedOut = true; break; }

    const { data: items } = await admin
      .from("ambassador_bulk_job_items")
      .select("id, store_id, per_store_variables")
      .eq("job_id", job_id).eq("status", "pending")
      .order("created_at").range(cursor, cursor + PAGE_SIZE - 1);
    if (!items || items.length === 0) break;

    for (const item of items) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) { timedOut = true; break; }

      // Re-fetch job to check for cancellation
      const { data: jobCheck } = await admin
        .from("ambassador_bulk_jobs").select("status").eq("id", job_id).maybeSingle();
      if (jobCheck?.status === "cancelled") {
        await admin.from("ambassador_bulk_job_items")
          .update({ status: "cancelled", processed_at: new Date().toISOString() })
          .eq("job_id", job_id).eq("status", "pending");
        return json({ ok: true, message: "cancelled" });
      }

      // Load store fresh
      const { data: store } = await admin
        .from("store_master")
        .select("id, store_name, phone, owner_name, owner_name_arabic, status, language_preference, last_order_date, outstanding_balance")
        .eq("id", item.store_id).maybeSingle();

      let skip: string | null = null;
      if (!store) skip = "no_phone";
      else if (!store.phone) skip = "no_phone";
      else if (store.status === "blacklisted") skip = "blacklist";
      else if (isSmsQuietHours()) skip = "quiet_hours";

      if (skip) {
        await admin.from("ambassador_bulk_job_items")
          .update({ status: "skipped", skip_reason: skip, processed_at: new Date().toISOString() })
          .eq("id", item.id);
        await admin.rpc("increment_bulk_job_counter", { p_job_id: job_id, p_field: "skipped_count" })
          .catch(async () => {
            // Fallback inline if RPC missing
            const { data: j } = await admin.from("ambassador_bulk_jobs").select("skipped_count").eq("id", job_id).maybeSingle();
            await admin.from("ambassador_bulk_jobs").update({ skipped_count: (j?.skipped_count || 0) + 1 }).eq("id", job_id);
          });
        processedThisRun++;
        continue;
      }

      // Build template body
      const langStrategy = job.language_strategy || "auto";
      const useAr = langStrategy === "ar" || (langStrategy === "auto" && store!.language_preference === "ar");
      const baseBody = (useAr && template?.body_ar) ? template.body_ar : (template?.body_en || template?.content || "");
      const daysSince = store!.last_order_date
        ? Math.floor((Date.now() - new Date(store!.last_order_date).getTime()) / 86400000) : 0;
      const vars: Record<string, any> = {
        store_name: store!.store_name || "",
        owner_name: (useAr && store!.owner_name_arabic) ? store!.owner_name_arabic : (store!.owner_name || "there"),
        ambassador_name: amb.name || "your rep",
        days_since_last_order: String(daysSince),
        last_order_date: store!.last_order_date ? new Date(store!.last_order_date).toLocaleDateString() : "a while ago",
        outstanding_balance: store!.outstanding_balance != null ? `$${Number(store!.outstanding_balance).toFixed(2)}` : "$0",
        phone: store!.phone,
        ...customVars,
        ...((item.per_store_variables as Record<string, any>) || {}),
      };
      const finalBody = hydrate(baseBody, vars);

      // Send through the canonical chokepoint. This is campaign traffic:
      // it gets marketing suppression, the campaign daily budget and a
      // per-campaign ceiling equal to the job's own recipient count, so a
      // loop bug re-sending the same list stops at the cap.
      let twilioSid: string | null = null;
      let providerStatus = "queued";
      let providerError: string | null = null;
      if (finalBody) {
        const res = await sendSms({
          to: store!.phone!,
          body: finalBody,
          idempotencyKey: `bulk-${job_id}-${item.id}`,
          sendClass: "campaign",
          from: fromNumber || undefined,
          storeId: store!.id,
          campaignId: job_id,
          campaignMaxSends: job.total_count ?? null,
          purpose: "ambassador_bulk",
          metadata: { bulk_job_id: job_id, item_id: item.id, ambassador_id: amb.id },
        });
        if (res.success) {
          twilioSid = res.providerMessageId;
          providerStatus = "sent";
        } else {
          providerStatus = res.blocked ? "blocked" : "failed";
          providerError = res.errorMessage || res.status;
        }
      } else {
        providerStatus = "failed";
        providerError = "empty_body";
      }

      // Persist message row
      const { data: msgRow } = await admin.from("communication_messages").insert({
        ambassador_id: amb.id,
        store_id: store!.id,
        owner_user_id: amb.user_id,
        created_by: amb.user_id,
        direction: "outbound",
        channel: "sms",
        content: finalBody,
        phone_number: store!.phone,
        to_number: store!.phone,
        from_number: fromNumber || null,
        status: providerStatus,
        provider_message_id: twilioSid,
        error_message: providerError,
        template_id: job.template_id,
        metadata: { bulk_job_id: job_id, sent_by_ambassador: amb.name },
      }).select("id").single();

      const success = providerStatus !== "failed";
      await admin.from("ambassador_bulk_job_items").update({
        status: success ? "sent" : "failed",
        message_id: msgRow?.id,
        error_message: providerError,
        processed_at: new Date().toISOString(),
      }).eq("id", item.id);

      // Atomic counter bump (best-effort)
      const { data: jCur } = await admin.from("ambassador_bulk_jobs")
        .select("sent_count, success_count, failed_count").eq("id", job_id).maybeSingle();
      await admin.from("ambassador_bulk_jobs").update({
        sent_count: (jCur?.sent_count || 0) + 1,
        success_count: (jCur?.success_count || 0) + (success ? 1 : 0),
        failed_count: (jCur?.failed_count || 0) + (success ? 0 : 1),
      }).eq("id", job_id);

      processedThisRun++;
      if (pacingMs) await new Promise((r) => setTimeout(r, pacingMs));
    }
    cursor += PAGE_SIZE;
    if (items.length < PAGE_SIZE) break;
  }

  // Determine final state
  const { count: stillPending } = await admin
    .from("ambassador_bulk_job_items").select("*", { count: "exact", head: true })
    .eq("job_id", job_id).eq("status", "pending");

  if ((stillPending ?? 0) > 0 || timedOut) {
    await admin.from("ambassador_bulk_jobs").update({ status: "paused" }).eq("id", job_id);
    return json({ ok: true, status: "paused", processed: processedThisRun, remaining: stillPending });
  }

  await admin.from("ambassador_bulk_jobs")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", job_id);

  // Activity log
  const { data: finalJob } = await admin.from("ambassador_bulk_jobs")
    .select("sent_count, success_count, failed_count, skipped_count").eq("id", job_id).maybeSingle();
  await verifiedInsertSoft(admin, 'log ambassador bulk SMS job', (c: any) => c.from("ambassador_activity_log").insert({
    ambassador_id: amb.id,
    action_type: "bulk_job_completed",
    metadata: { job_id, type: "sms_blast", ...finalJob },
  }));

  return json({ ok: true, status: "complete", processed: processedThisRun });
});
