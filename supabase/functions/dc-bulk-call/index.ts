// Dynasty Connect — company-level bulk Bland call processor.
// Wraps the proven dc-outbound-call pipeline with concurrency control + progress tracking.
//
// Actions:
//   POST { action: "launch", business, agent_type, agent_bland_id, agent_name,
//          concurrency, source, targets: [{ to_number, lead_name?, store_id? }], source_metadata? }
//     → creates dc_bulk_batches + dc_bulk_targets rows, kicks off async worker, returns { batch_id }.
//
//   POST { action: "run", batch_id }
//     → internal worker. Pulls queued targets, dials up to `concurrency` in parallel
//        via dc-outbound-call, updates target/batch progress. Re-invokes itself if more
//        work remains and runtime cap is hit.
//
//   POST { action: "cancel", batch_id }
//     → marks batch + remaining queued targets cancelled.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAX_RUNTIME_MS = 110_000;
const DC_OUTBOUND_URL = `${SUPABASE_URL}/functions/v1/dc-outbound-call`;
const SELF_URL = `${SUPABASE_URL}/functions/v1/dc-bulk-call`;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.length === 10) d = `1${d}`;
  return d ? `+${d}` : "";
}

async function refreshBatchCounts(admin: any, batch_id: string) {
  const { data: rows } = await admin
    .from("dc_bulk_targets")
    .select("status")
    .eq("batch_id", batch_id);
  const c = { queued: 0, dialing: 0, connected: 0, done: 0, failed: 0, skipped: 0 };
  for (const r of rows || []) {
    if (r.status === "queued") c.queued++;
    else if (r.status === "dialing") c.dialing++;
    else if (r.status === "connected") c.connected++;
    else if (r.status === "done") c.done++;
    else if (r.status === "failed") c.failed++;
    else if (r.status === "skipped") c.skipped++;
  }
  await admin
    .from("dc_bulk_batches")
    .update({
      queued_count: c.queued,
      dialing_count: c.dialing,
      connected_count: c.connected,
      done_count: c.done,
      failed_count: c.failed,
      skipped_count: c.skipped,
    })
    .eq("id", batch_id);
  return c;
}

async function dialOne(
  admin: any,
  batch: any,
  target: any,
  serviceAuth: string,
): Promise<void> {
  // mark dialing
  await admin
    .from("dc_bulk_targets")
    .update({ status: "dialing", started_at: new Date().toISOString() })
    .eq("id", target.id);

  try {
    const resp = await fetch(DC_OUTBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceAuth}`,
      },
      body: JSON.stringify({
        to_number: target.to_number,
        lead_name: target.lead_name || undefined,
        lead_id: target.store_id || undefined,
        business: batch.business,
        agent_type: batch.agent_type || undefined,
        agent_id_override: batch.agent_bland_id || undefined,
        campaign_id: batch.id,
      }),
    });
    const body = await resp.json().catch(() => ({}));

    if (!resp.ok || !body?.success) {
      await admin
        .from("dc_bulk_targets")
        .update({
          status: "failed",
          error_message:
            body?.error || body?.details?.message || `dc-outbound-call ${resp.status}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      return;
    }

    // Successful placement → mark connected (call placed). Done state is set once
    // the post-call webhook chain fires (we treat placement success as "connected"
    // for live progress; final analytics live in dynasty_ai_calls).
    await admin
      .from("dc_bulk_targets")
      .update({
        status: "done",
        call_id: body.call_id || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", target.id);
  } catch (e) {
    await admin
      .from("dc_bulk_targets")
      .update({
        status: "failed",
        error_message: (e as Error).message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", target.id);
  }
}

async function runWorker(admin: any, batch_id: string) {
  const startedAt = Date.now();

  // Load batch
  const { data: batch } = await admin
    .from("dc_bulk_batches")
    .select("*")
    .eq("id", batch_id)
    .maybeSingle();
  if (!batch) return { ok: false, error: "batch_not_found" };
  if (["complete", "cancelled", "failed"].includes(batch.status)) {
    return { ok: true, status: batch.status };
  }

  await admin
    .from("dc_bulk_batches")
    .update({
      status: "running",
      started_at: batch.started_at || new Date().toISOString(),
    })
    .eq("id", batch_id);

  const concurrency = Math.max(1, Math.min(20, batch.concurrency || 3));

  while (true) {
    if (Date.now() - startedAt > MAX_RUNTIME_MS) {
      // re-invoke self for continuation
      fetch(SELF_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ action: "run", batch_id }),
      }).catch(() => {});
      await refreshBatchCounts(admin, batch_id);
      return { ok: true, status: "running", continued: true };
    }

    // cancellation check
    const { data: cur } = await admin
      .from("dc_bulk_batches")
      .select("status")
      .eq("id", batch_id)
      .maybeSingle();
    if (cur?.status === "cancelled") {
      await admin
        .from("dc_bulk_targets")
        .update({
          status: "skipped",
          skip_reason: "batch_cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("batch_id", batch_id)
        .eq("status", "queued");
      await refreshBatchCounts(admin, batch_id);
      return { ok: true, status: "cancelled" };
    }

    // pull next slice of queued targets up to `concurrency`
    const { data: items } = await admin
      .from("dc_bulk_targets")
      .select("id, to_number, lead_name, store_id")
      .eq("batch_id", batch_id)
      .eq("status", "queued")
      .order("created_at")
      .limit(concurrency);

    if (!items?.length) break;

    await Promise.all(items.map((t: any) => dialOne(admin, batch, t, SERVICE_KEY)));
    await refreshBatchCounts(admin, batch_id);
  }

  await admin
    .from("dc_bulk_batches")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", batch_id);

  return { ok: true, status: "complete" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const action = body?.action || "launch";

  if (action === "run") {
    if (!body.batch_id) return json({ error: "missing_batch_id" }, 400);
    const out = await runWorker(admin, body.batch_id);
    return json(out);
  }

  if (action === "cancel") {
    if (!body.batch_id) return json({ error: "missing_batch_id" }, 400);
    await admin
      .from("dc_bulk_batches")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", body.batch_id);
    return json({ ok: true });
  }

  if (action === "launch") {
    const {
      business,
      agent_type,
      agent_bland_id,
      agent_name,
      concurrency,
      source,
      source_metadata,
      targets,
      created_by,
    } = body;

    if (!business) return json({ error: "missing_business" }, 400);
    if (!Array.isArray(targets) || targets.length === 0) {
      return json({ error: "no_targets" }, 400);
    }

    // normalize + dedupe phones
    const seen = new Set<string>();
    const clean: { to_number: string; lead_name?: string; store_id?: string }[] = [];
    for (const t of targets) {
      const phone = normalizePhone(t?.to_number || "");
      if (!phone || phone.length < 8) continue;
      if (seen.has(phone)) continue;
      seen.add(phone);
      clean.push({
        to_number: phone,
        lead_name: t?.lead_name || undefined,
        store_id: t?.store_id || undefined,
      });
    }
    if (clean.length === 0) return json({ error: "no_valid_targets" }, 400);

    // opt-out filter against store_master (do_not_call / last_opt_out_timestamp)
    const optedOut = new Set<string>();
    try {
      const phones = clean.map((t) => t.to_number);
      const { data: blocked } = await admin
        .from("store_master")
        .select("phone, do_not_call, last_opt_out_timestamp")
        .in("phone", phones);
      for (const r of blocked || []) {
        if (r.do_not_call === true || r.last_opt_out_timestamp) {
          if (r.phone) optedOut.add(r.phone as string);
        }
      }
    } catch (_) {
      // table may not contain all phones — ignore
    }

    const dialable = clean.filter((t) => !optedOut.has(t.to_number));
    const skippedCount = clean.length - dialable.length;

    const { data: batch, error: bErr } = await admin
      .from("dc_bulk_batches")
      .insert({
        business,
        agent_type: agent_type || null,
        agent_bland_id: agent_bland_id || null,
        agent_name: agent_name || null,
        concurrency: Math.max(1, Math.min(20, Number(concurrency) || 3)),
        status: "queued",
        total_count: clean.length,
        queued_count: dialable.length,
        skipped_count: skippedCount,
        source: source || "paste",
        source_metadata: source_metadata || null,
        created_by: created_by || null,
      })
      .select("id")
      .single();
    if (bErr || !batch) return json({ error: "batch_insert_failed", details: bErr }, 500);

    // insert opted-out rows as already-skipped
    if (skippedCount > 0) {
      const skipRows = clean
        .filter((t) => optedOut.has(t.to_number))
        .map((t) => ({
          batch_id: batch.id,
          to_number: t.to_number,
          lead_name: t.lead_name,
          store_id: t.store_id,
          status: "skipped",
          skip_reason: "opted_out",
          completed_at: new Date().toISOString(),
        }));
      if (skipRows.length) await admin.from("dc_bulk_targets").insert(skipRows);
    }

    // insert dialable rows
    const queuedRows = dialable.map((t) => ({
      batch_id: batch.id,
      to_number: t.to_number,
      lead_name: t.lead_name,
      store_id: t.store_id,
      status: "queued",
    }));
    // chunk inserts for safety
    for (let i = 0; i < queuedRows.length; i += 500) {
      const { error } = await admin
        .from("dc_bulk_targets")
        .insert(queuedRows.slice(i, i + 500));
      if (error) {
        await admin
          .from("dc_bulk_batches")
          .update({ status: "failed", error_summary: { error: error.message } })
          .eq("id", batch.id);
        return json({ error: "targets_insert_failed", details: error }, 500);
      }
    }

    // fire-and-forget worker
    fetch(SELF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ action: "run", batch_id: batch.id }),
    }).catch(() => {});

    return json({
      ok: true,
      batch_id: batch.id,
      total: clean.length,
      queued: dialable.length,
      skipped_opted_out: skippedCount,
    });
  }

  return json({ error: "unknown_action" }, 400);
});
