// Dynasty Connect — manual disposition override.
// Updates the canonical status column on the underlying lead row and
// records the change in dc_lead_sync_log.

import { createClient } from "npm:@supabase/supabase-js@2";
import { logComplianceEvent } from "../_shared/dc_sync_log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Explicit column map — never take column names from user input.
// { business_unit_key: { table, statusColumn, idColumn } }
const UNIT_MAP: Record<string, { table: string; statusColumn: string; idColumn: string }> = {
  top_tier:            { table: "crm_partners",              statusColumn: "tt_last_disposition",   idColumn: "id" },
  unforgettable_times: { table: "ut_partner_leads",          statusColumn: "last_outcome",          idColumn: "id" },
  surplus_funds:       { table: "surplus_funds_leads",       statusColumn: "status",                idColumn: "id" },
  real_estate:         { table: "re_leads",                  statusColumn: "status",                idColumn: "id" },
  dynasty_direct:      { table: "wholesalers",               statusColumn: "last_call_disposition", idColumn: "id" },
  gasmask:             { table: "sales_prospects",           statusColumn: "gasmask_call_status",   idColumn: "id" },
  brandaro:            { table: "brandaro_qualified_leads",  statusColumn: "lead_status",           idColumn: "id" },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Invalid JSON body" }, 400);

    const { lead_id, business_unit_key, new_disposition, reason } = body as {
      lead_id?: string;
      business_unit_key?: string;
      new_disposition?: string;
      reason?: string;
    };

    if (!lead_id || !business_unit_key || !new_disposition || !reason) {
      return json({ error: "Missing required fields: lead_id, business_unit_key, new_disposition, reason" }, 400);
    }
    if (typeof reason !== "string" || reason.trim().length < 10) {
      return json({ error: "Reason must be at least 10 characters" }, 400);
    }

    const mapping = UNIT_MAP[business_unit_key];
    if (!mapping) {
      return json({ error: `Unsupported business_unit_key: ${business_unit_key}` }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1. Validate disposition code is canonical
    const { data: codeRow, error: codeErr } = await supabase
      .from("dc_disposition_codes")
      .select("code")
      .eq("code", new_disposition)
      .maybeSingle();
    if (codeErr) return json({ error: `Disposition lookup failed: ${codeErr.message}` }, 500);
    if (!codeRow) return json({ error: `Unknown disposition code: ${new_disposition}` }, 400);

    // 2. Read current value from the source table
    const { data: leadRow, error: readErr } = await supabase
      .from(mapping.table)
      .select(`${mapping.idColumn}, ${mapping.statusColumn}`)
      .eq(mapping.idColumn, lead_id)
      .maybeSingle();
    if (readErr) return json({ error: `Lead read failed: ${readErr.message}` }, 500);
    if (!leadRow) return json({ error: `Lead not found in ${mapping.table}` }, 404);

    const status_before = (leadRow as Record<string, unknown>)[mapping.statusColumn] as string | null;

    // 3. UPDATE the status column
    const { error: updErr } = await supabase
      .from(mapping.table)
      .update({ [mapping.statusColumn]: new_disposition })
      .eq(mapping.idColumn, lead_id);
    if (updErr) return json({ error: `Update failed: ${updErr.message}` }, 500);

    // 4. INSERT sync log row
    const { error: logErr } = await supabase.from("dc_lead_sync_log").insert({
      sync_source: "manual_override",
      sync_direction: "out",
      business_unit_key,
      lead_id,
      status_before,
      status_after: new_disposition,
      error_message: reason,
      success: true,
    });
    if (logErr) {
      // Best-effort: the update already succeeded; surface warning but don't rollback.
      return json({
        success: true,
        lead_id,
        business_unit_key,
        old_disposition: status_before,
        new_disposition,
        reason,
        warning: `Sync log insert failed: ${logErr.message}`,
      });
    }

    // 5. Append immutable compliance-audit event (fire-and-forget).
    await logComplianceEvent(supabase, {
      event_type: "manual_disposition_override",
      business_unit_key,
      lead_id,
      source_table: mapping.table,
      actor: "manual_admin",
      event_data: {
        old_disposition: status_before,
        new_disposition,
        reason,
      },
    });


    return json({
      success: true,
      lead_id,
      business_unit_key,
      old_disposition: status_before,
      new_disposition,
      reason,
    });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Unknown error" }, 500);
  }
});
