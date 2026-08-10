// grant-profile-completeness
// Scores a grant_business_profile against 12 critical fields (weights sum to 105)
// and writes completeness_pct + completeness_missing back to the row.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { requireGrantsStaff, grantsAuthResponse } from "../_shared/grantsAuth.ts";

type CriticalField = {
  field: string;
  weight: number;
  label: string;
  type: "value" | "doc"; // "doc" means boolean flag; "value" means text/number
};

const CRITICAL_FIELDS: CriticalField[] = [
  { field: "ein",                     weight: 15, label: "EIN Number",              type: "value" },
  { field: "date_incorporated",       weight: 10, label: "Date Incorporated",       type: "value" },
  { field: "naics_primary",           weight: 10, label: "NAICS Code",              type: "value" },
  { field: "address_street",          weight: 8,  label: "Business Address",        type: "value" },
  { field: "owner_name",              weight: 8,  label: "Owner Name",              type: "value" },
  { field: "owner_race",              weight: 8,  label: "Owner Race/Ethnicity",    type: "value" },
  { field: "annual_revenue_current",  weight: 10, label: "Current Annual Revenue",  type: "value" },
  { field: "employee_count_ft",       weight: 6,  label: "Full-Time Employees",     type: "value" },
  { field: "doc_ein_letter",          weight: 8,  label: "EIN Letter (document)",   type: "doc"   },
  { field: "doc_tax_returns_current", weight: 8,  label: "Current Tax Return",      type: "doc"   },
  { field: "doc_bank_statements",     weight: 7,  label: "Bank Statements",         type: "doc"   },
  { field: "doc_profit_loss",         weight: 7,  label: "Profit & Loss Statement", type: "doc"   },
];

const MAX_WEIGHT = CRITICAL_FIELDS.reduce((s, f) => s + f.weight, 0); // 105

const BodySchema = z.object({
  business_profile_id: z.string().uuid(),
});

function isFilled(field: CriticalField, value: unknown): boolean {
  if (field.type === "doc") return value === true;
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  return Boolean(value);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Runs with the service role (RLS bypass) — the caller must be grants staff.
  const auth = await requireGrantsStaff(req);
  if (!auth.ok) return grantsAuthResponse(auth, corsHeaders);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { business_profile_id } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Load profile (only the fields we need)
    const columns = CRITICAL_FIELDS.map((f) => f.field).join(",");
    const { data: profile, error: loadErr } = await supabase
      .from("grant_business_profiles")
      .select(`id, ${columns}`)
      .eq("id", business_profile_id)
      .maybeSingle();

    if (loadErr) {
      return new Response(
        JSON.stringify({ error: loadErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!profile) {
      return new Response(
        JSON.stringify({ error: "business_profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2 + 3. Score critical fields
    let filledWeight = 0;
    const missing: { label: string; weight: number }[] = [];

    for (const f of CRITICAL_FIELDS) {
      const val = (profile as Record<string, unknown>)[f.field];
      if (isFilled(f, val)) {
        filledWeight += f.weight;
      } else {
        missing.push({ label: f.label, weight: f.weight });
      }
    }

    const completeness_pct = Math.round((filledWeight / MAX_WEIGHT) * 100);

    // 4. Sort missing by weight desc, take labels only
    const completeness_missing = missing
      .sort((a, b) => b.weight - a.weight)
      .map((m) => m.label);

    // 5. Persist
    const { error: updateErr } = await supabase
      .from("grant_business_profiles")
      .update({
        completeness_pct,
        completeness_missing,
        completeness_score: completeness_pct, // keep legacy column in sync
        updated_at: new Date().toISOString(),
      })
      .eq("id", business_profile_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 6. Return
    return new Response(
      JSON.stringify({
        profile_id: business_profile_id,
        completeness_pct,
        missing_fields: completeness_missing,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
