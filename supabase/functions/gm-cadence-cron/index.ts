// gm-cadence-cron — nightly promote cadence-due stores into follow_up_queue.
// Dedupe: skip if an open (pending/in_progress/overdue) follow_up exists for the store.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { outreachAllowed } from "../_shared/outreachGate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // OUTREACH GATE (2026-08-23): enqueues to follow_up_queue only, but the
  // queue feeds human/AI outreach — gated with everything else.
  if (!(await outreachAllowed("gm_cadence_cron"))) {
    return new Response(JSON.stringify({ ok: true, gated: true, switch: "gm_cadence_cron", promoted: 0 }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // AI permission gate (T4a)
  const { data: permOk, error: permErr } = await sb.rpc("has_ai_permission", {
    p_domain: "cadence",
    p_action: "promote_followups",
  });
  if (permErr || permOk === false) {
    return new Response(JSON.stringify({ ok: false, blocked: true, reason: permErr?.message || "ai_permission_denied" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }



  // 1. Find cadence-due stores. Default cadence_days resolved via SQL fn when no per-store policy.
  // Strategy: pull all enabled per-store policies + all stores with relationship_status (uses default).
  const { data: dueStores, error } = await sb.rpc("gm_due_cadence_stores").select("*");
  // If RPC missing, fall back to raw SQL via .rpc is not possible — use a one-shot SELECT.
  let stores = dueStores as any[] | null;

  if (error || !stores) {
    // Inline query fallback
    const { data, error: e2 } = await sb
      .from("v_gm_cadence_due")
      .select("store_id, store_name, cadence_days, last_visit_date, relationship_status");
    if (e2) {
      return new Response(JSON.stringify({ error: e2.message, hint: "view v_gm_cadence_due missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    stores = data || [];
  }

  if (!stores.length) {
    return new Response(JSON.stringify({ ok: true, promoted: 0, skipped: 0, total_due: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Find which already have an open follow-up
  const ids = stores.map((s: any) => s.store_id);
  const { data: openFu } = await sb
    .from("follow_up_queue")
    .select("store_id")
    .in("store_id", ids)
    .in("status", ["pending", "in_progress", "overdue"]);
  const openSet = new Set((openFu || []).map((r: any) => r.store_id));

  const toInsert = stores
    .filter((s: any) => !openSet.has(s.store_id))
    .map((s: any) => ({
      store_id: s.store_id,
      reason: "cadence_due",
      recommended_action: "manual_call",
      priority: 3,
      status: "pending",
      due_at: new Date().toISOString(),
      context: {
        cadence_days: s.cadence_days,
        relationship_status: s.relationship_status,
        last_visit_date: s.last_visit_date,
        source: "gm-cadence-cron",
      },
    }));

  if (!toInsert.length) {
    return new Response(JSON.stringify({ ok: true, promoted: 0, skipped: stores.length, total_due: stores.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: insErr, data: ins } = await sb.from("follow_up_queue").insert(toInsert).select("id");
  if (insErr) {
    return new Response(JSON.stringify({ error: insErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      promoted: ins?.length || 0,
      skipped: stores.length - toInsert.length,
      total_due: stores.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
