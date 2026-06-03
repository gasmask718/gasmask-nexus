// sync-call-to-source — post-call generic write-back.
// Updates the originating hub row (store_master / brandaro_qualified_leads /
// ut_partner_leads / re_leads / dc_leads) with last-contact + outcome metadata.
//
// SAFETY:
//  - Only tables in ALLOW_LIST may be written.
//  - Only columns in ALLOW_LIST[table].columns may be written.
//  - When the source row carries a business indicator, it MUST match
//    source_business before any UPDATE is issued (cross-business guard).
//
// verify_jwt = false (called server-to-server from bland-agent-webhook).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AllowEntry = {
  // Columns we may write
  columns: string[];
  // Business column (if any) to cross-check against source_business
  businessColumn?: string;
  // Fixed-business tables (e.g. ut_partner_leads is always 'unforgettable_times')
  fixedBusiness?: string;
};

const ALLOW_LIST: Record<string, AllowEntry> = {
  store_master: {
    columns: ["last_contacted_at", "total_attempts", "total_answers"],
    fixedBusiness: "gasmask",
  },
  brandaro_qualified_leads: {
    columns: [
      "last_called_at", "last_call_at", "last_dc_call_at",
      "call_attempts", "total_dc_calls",
      "call_notes", "excitement_level", "lead_status",
    ],
    businessColumn: "business_name",
  },
  ut_partner_leads: {
    columns: [
      "last_contacted_at", "last_outcome", "ai_call_result",
      "ai_call_last_attempt_at", "outreach_count",
    ],
    fixedBusiness: "unforgettable_times",
  },
  re_leads: {
    columns: ["last_called_at", "call_outcome", "call_count"],
    fixedBusiness: "real_estate",
  },
  dc_leads: {
    columns: ["last_called_at", "outcome", "status", "call_count"],
    businessColumn: "business_name",
  },
};

function svc() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function pickAllowed(table: string, patch: Record<string, unknown>): Record<string, unknown> {
  const allowed = ALLOW_LIST[table]?.columns || [];
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(patch)) if (allowed.includes(k)) out[k] = patch[k];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json().catch(() => ({}));
    const {
      source_table,
      source_id,
      source_business,
      outcome,
      sentiment,
      excitement_level,
      call_summary,
      call_completed_at,
    } = payload as Record<string, any>;

    if (!source_table || !source_id) {
      return new Response(JSON.stringify({ ok: false, error: "source_table + source_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const entry = ALLOW_LIST[source_table];
    if (!entry) {
      // Safety: silently drop unknown tables — never write to arbitrary tables.
      console.warn(`[sync-call-to-source] table '${source_table}' not in allow-list — skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: "not_in_allow_list" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sb = svc();

    // Cross-business guard: if the row has a business column, fetch + match.
    if (entry.businessColumn) {
      const { data: row } = await sb
        .from(source_table)
        .select(`id, ${entry.businessColumn}`)
        .eq("id", source_id)
        .maybeSingle();
      if (!row) {
        return new Response(JSON.stringify({ ok: false, error: "source row not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const rowBiz = (row as any)[entry.businessColumn];
      if (source_business && rowBiz && rowBiz !== source_business) {
        console.error(`[sync-call-to-source] business mismatch: row=${rowBiz} call=${source_business} table=${source_table} id=${source_id}`);
        return new Response(JSON.stringify({ ok: false, error: "business_mismatch", row_business: rowBiz, call_business: source_business }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else if (entry.fixedBusiness && source_business && entry.fixedBusiness !== source_business) {
      console.error(`[sync-call-to-source] fixed-business mismatch: expected=${entry.fixedBusiness} got=${source_business}`);
      return new Response(JSON.stringify({ ok: false, error: "business_mismatch_fixed", expected: entry.fixedBusiness, got: source_business }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build patch per table — only columns that exist in the allow-list.
    const nowIso = call_completed_at || new Date().toISOString();
    let patch: Record<string, unknown> = {};

    if (source_table === "store_master") {
      patch = { last_contacted_at: nowIso };
    } else if (source_table === "brandaro_qualified_leads") {
      patch = {
        last_called_at: nowIso,
        last_call_at: nowIso,
        last_dc_call_at: nowIso,
        ...(excitement_level ? { excitement_level } : {}),
        ...(call_summary ? { call_notes: call_summary } : {}),
      };
    } else if (source_table === "ut_partner_leads") {
      patch = {
        last_contacted_at: nowIso,
        ai_call_last_attempt_at: nowIso,
        ...(outcome ? { last_outcome: outcome, ai_call_result: outcome } : {}),
      };
    } else if (source_table === "re_leads") {
      patch = {
        last_called_at: nowIso,
        ...(outcome ? { call_outcome: outcome } : {}),
      };
    } else if (source_table === "dc_leads") {
      patch = {
        last_called_at: nowIso,
        ...(outcome ? { outcome } : {}),
      };
    }

    const safe = pickAllowed(source_table, patch);
    if (Object.keys(safe).length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_columns" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: updErr } = await sb
      .from(source_table)
      .update(safe)
      .eq("id", source_id);

    if (updErr) {
      console.error(`[sync-call-to-source] update failed table=${source_table} id=${source_id}`, updErr);
      return new Response(JSON.stringify({ ok: false, error: updErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[sync-call-to-source] updated ${source_table}:${source_id} cols=${Object.keys(safe).join(",")}`);
    return new Response(JSON.stringify({ ok: true, table: source_table, id: source_id, columns: Object.keys(safe) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync-call-to-source] error:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
