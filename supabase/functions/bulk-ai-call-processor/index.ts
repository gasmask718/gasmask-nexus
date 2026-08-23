// Bulk AI call processor — orchestrates ambassador AI call blasts via Bland.ai.
// Same pattern as bulk-sms-processor: pacing, skip re-check, daily-cap awareness.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { verifiedInsertSoft } from "../_shared/verifiedWrite.ts";
import { outreachAllowed } from "../_shared/outreachGate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BLAND_API_KEY = Deno.env.get("BLAND_API_KEY")!;

const DEFAULT_EN_PERSONA = "358e79c7-fc23-4494-8c89-21d489253bef";
const AR_PERSONA = DEFAULT_EN_PERSONA;
const MAX_RUNTIME_MS = 140_000;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function isAiQuietHours() {
  const h = (new Date().getUTCHours() - 5 + 24) % 24;
  return h < 9 || h >= 19;
}
function hydrate(t: string, v: Record<string, any>) {
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] != null ? String(v[k]) : ""));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // OUTREACH GATE (2026-08-23): no AI call blast runs unless a human armed the switch.
  if (!(await outreachAllowed("bulk_ai_call_resume"))) {
    return json({ ok: true, gated: true, switch: "bulk_ai_call_resume" });
  }

  let job_id: string;
  try { ({ job_id } = await req.json()); } catch { return json({ error: "invalid_json" }, 400); }
  if (!job_id) return json({ error: "missing_job_id" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: job } = await admin.from("ambassador_bulk_jobs").select("*").eq("id", job_id).maybeSingle();
  if (!job) return json({ error: "job_not_found" }, 404);
  if (["complete", "cancelled", "failed"].includes(job.status)) return json({ ok: true, status: job.status });
  if (job.job_type !== "ai_call_blast") return json({ error: "wrong_job_type" }, 400);
  if (job.scheduled_for && new Date(job.scheduled_for) > new Date()) return json({ ok: true, message: "not_yet_scheduled" });

  const { data: amb } = await admin.from("ambassadors")
    .select("id, name, twilio_number, user_id, is_active, ai_call_daily_limit").eq("id", job.ambassador_id).maybeSingle();
  if (!amb?.is_active) {
    await admin.from("ambassador_bulk_jobs").update({ status: "failed", error_summary: { error: "ambassador_inactive" }, completed_at: new Date().toISOString() }).eq("id", job_id);
    return json({ error: "ambassador_inactive" }, 403);
  }

  let script: any = null;
  if (job.script_id) {
    const { data: s } = await admin.from("ambassador_call_scripts").select("*").eq("id", job.script_id).maybeSingle();
    script = s;
  }
  if (!script) {
    await admin.from("ambassador_bulk_jobs").update({ status: "failed", error_summary: { error: "no_script" }, completed_at: new Date().toISOString() }).eq("id", job_id);
    return json({ error: "no_script" }, 400);
  }

  await admin.from("ambassador_bulk_jobs").update({ status: "processing", started_at: job.started_at || new Date().toISOString() }).eq("id", job_id);

  const customVars = (job.custom_variables as Record<string, any>) || {};
  const pacingMs = Math.max(0, (job.pacing_seconds || 30) * 1000);
  const startedAt = Date.now();

  const projectRef = SUPABASE_URL.split("//")[1].split(".")[0];
  const webhook = `https://${projectRef}.functions.supabase.co/bland-call-webhook`;

  const PAGE = 25;
  let cursor = 0, processedThisRun = 0, timedOut = false, capHit = false;

  while (true) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) { timedOut = true; break; }
    const { data: items } = await admin.from("ambassador_bulk_job_items")
      .select("id, store_id, per_store_variables").eq("job_id", job_id).eq("status", "pending")
      .order("created_at").range(cursor, cursor + PAGE - 1);
    if (!items?.length) break;

    for (const item of items) {
      if (Date.now() - startedAt > MAX_RUNTIME_MS) { timedOut = true; break; }
      const { data: jc } = await admin.from("ambassador_bulk_jobs").select("status").eq("id", job_id).maybeSingle();
      if (jc?.status === "cancelled") {
        await admin.from("ambassador_bulk_job_items").update({ status: "cancelled", processed_at: new Date().toISOString() }).eq("job_id", job_id).eq("status", "pending");
        return json({ ok: true, message: "cancelled" });
      }

      // Daily cap check
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: dayCount } = await admin.from("communication_logs")
        .select("*", { count: "exact", head: true })
        .eq("ambassador_id", amb.id).eq("call_type", "ai_assisted").gte("created_at", dayAgo);
      if ((dayCount ?? 0) >= (amb.ai_call_daily_limit ?? 50)) { capHit = true; break; }

      const { data: store } = await admin.from("store_master")
        .select("id, store_name, phone, owner_name, owner_name_arabic, status, language_preference, last_order_date, outstanding_balance")
        .eq("id", item.store_id).maybeSingle();

      let skip: string | null = null;
      if (!store?.phone) skip = "no_phone";
      else if (store.status === "blacklisted") skip = "blacklist";
      else if (isAiQuietHours()) skip = "quiet_hours";
      else {
        const cd = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const { count } = await admin.from("communication_logs").select("*", { count: "exact", head: true })
          .eq("store_id", store!.id).eq("call_type", "ai_assisted").gte("created_at", cd);
        if ((count ?? 0) > 0) skip = "cooldown";
      }

      if (skip) {
        await admin.from("ambassador_bulk_job_items").update({ status: "skipped", skip_reason: skip, processed_at: new Date().toISOString() }).eq("id", item.id);
        const { data: jx } = await admin.from("ambassador_bulk_jobs").select("skipped_count").eq("id", job_id).maybeSingle();
        await admin.from("ambassador_bulk_jobs").update({ skipped_count: (jx?.skipped_count || 0) + 1 }).eq("id", job_id);
        processedThisRun++;
        continue;
      }

      const useAr = script.language === "ar" || (job.language_strategy === "auto" && store!.language_preference === "ar");
      const days = store!.last_order_date ? Math.floor((Date.now() - new Date(store!.last_order_date).getTime()) / 86400000) : 0;
      const vars: Record<string, any> = {
        store_name: store!.store_name || "",
        owner_name: (useAr && store!.owner_name_arabic) ? store!.owner_name_arabic : (store!.owner_name || "there"),
        ambassador_name: amb.name || "your rep",
        days_since_last_order: String(days),
        last_order_date: store!.last_order_date ? new Date(store!.last_order_date).toLocaleDateString() : "a while ago",
        outstanding_balance: store!.outstanding_balance != null ? `$${Number(store!.outstanding_balance).toFixed(2)}` : "$0",
        phone: store!.phone,
        ...customVars,
        ...((item.per_store_variables as Record<string, any>) || {}),
      };
      const persona = useAr ? AR_PERSONA : (script.voice_persona_id || DEFAULT_EN_PERSONA);
      const task = hydrate(script.script_body || "", vars);
      const opening = hydrate(script.opening_line || "", vars);

      // Pre-create log
      const { data: log } = await admin.from("communication_logs").insert({
        ambassador_id: amb.id, store_id: store!.id, channel: "voice", direction: "outbound",
        call_type: "ai_assisted", status: "dialing", started_at: new Date().toISOString(),
        script_template_id: job.script_id, call_objective: job.objective || script.objective,
        voice_persona_used: persona, transcript_status: "pending",
        recipient_phone: store!.phone, sender_phone: amb.twilio_number,
        ai_assisted: true,
        metadata: { bulk_job_id: job_id },
      }).select("id").single();

      let errMsg: string | null = null;
      let blandCallId: string | null = null;
      try {
        const r = await fetch("https://api.bland.ai/v1/calls", {
          method: "POST",
          headers: { Authorization: BLAND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            phone_number: store!.phone, from: amb.twilio_number || undefined,
            task, first_sentence: opening || undefined, voice: persona,
            language: useAr ? "ara" : "eng",
            max_duration: script.max_duration_seconds || 240,
            record: true, webhook,
            metadata: { log_id: log!.id, ambassador_id: amb.id, store_id: store!.id, bulk_job_id: job_id },
            answered_by_enabled: true, wait_for_greeting: true,
          }),
        });
        const bd = await r.json();
        if (!r.ok || bd.status === "error") errMsg = bd.message || `Bland ${r.status}`;
        else blandCallId = bd.call_id;
      } catch (e) { errMsg = (e as Error).message; }

      const success = !errMsg;
      if (success && blandCallId) {
        await admin.from("communication_logs").update({ bland_call_id: blandCallId }).eq("id", log!.id);
      } else {
        await admin.from("communication_logs").update({ status: "failed", notes: errMsg }).eq("id", log!.id);
      }

      await admin.from("ambassador_bulk_job_items").update({
        status: success ? "sent" : "failed", log_id: log?.id, error_message: errMsg,
        processed_at: new Date().toISOString(),
      }).eq("id", item.id);

      const { data: jc2 } = await admin.from("ambassador_bulk_jobs")
        .select("sent_count, success_count, failed_count").eq("id", job_id).maybeSingle();
      await admin.from("ambassador_bulk_jobs").update({
        sent_count: (jc2?.sent_count || 0) + 1,
        success_count: (jc2?.success_count || 0) + (success ? 1 : 0),
        failed_count: (jc2?.failed_count || 0) + (success ? 0 : 1),
      }).eq("id", job_id);

      processedThisRun++;
      if (pacingMs) await new Promise((r) => setTimeout(r, pacingMs));
    }
    if (capHit || timedOut) break;
    cursor += PAGE;
    if (items.length < PAGE) break;
  }

  const { count: stillPending } = await admin.from("ambassador_bulk_job_items")
    .select("*", { count: "exact", head: true }).eq("job_id", job_id).eq("status", "pending");

  if ((stillPending ?? 0) > 0 || capHit || timedOut) {
    await admin.from("ambassador_bulk_jobs").update({
      status: "paused",
      error_summary: capHit ? { reason: "daily_cap_reached" } : null,
    }).eq("id", job_id);
    return json({ ok: true, status: "paused", processed: processedThisRun, cap_hit: capHit });
  }

  await admin.from("ambassador_bulk_jobs").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", job_id);
  const { data: fj } = await admin.from("ambassador_bulk_jobs")
    .select("sent_count, success_count, failed_count, skipped_count").eq("id", job_id).maybeSingle();
  await verifiedInsertSoft(admin, 'log ambassador bulk AI-call job', (c: any) => c.from("ambassador_activity_log").insert({
    ambassador_id: amb.id, action_type: "bulk_job_completed",
    metadata: { job_id, type: "ai_call_blast", ...fj },
  }));

  return json({ ok: true, status: "complete", processed: processedThisRun });
});
