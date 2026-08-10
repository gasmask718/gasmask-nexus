// grant-opportunity-intake
// Parses a grant_opportunities row into structured grant_requirements
// via the Lovable AI Gateway (google/gemini-3-flash-preview).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { requireGrantsStaff, grantsAuthResponse } from "../_shared/grantsAuth.ts";

const BodySchema = z.object({
  grant_opportunity_id: z.string().uuid(),
});

const REQ_TYPES = [
  "certification", "revenue", "employees", "location",
  "industry", "years_in_business", "document", "other",
] as const;
const OPERATORS = [
  "is_true", "is_not_null", "greater_than", "less_than", "equals", "contains",
] as const;

const RequirementSchema = z.object({
  requirement_type: z.enum(REQ_TYPES),
  field_name: z.string().min(1),
  operator: z.enum(OPERATORS),
  required_value: z.union([z.string(), z.number(), z.null()]).transform((v) =>
    v === null || v === undefined ? null : String(v)
  ),
  is_mandatory: z.boolean(),
  weight: z.number().int().min(1).max(20),
  description: z.string(),
});

const SYSTEM_PROMPT =
  "You are a grant eligibility analyst. Extract structured eligibility requirements from grant descriptions. Only include requirements verifiable from the grant_business_profiles table. Return ONLY a JSON array — no markdown, no prose.";

function buildUserPrompt(g: {
  title: string | null;
  description: string | null;
  eligibility_requirements: string | null;
}) {
  return `Grant Title: ${g.title ?? "(none)"}
Grant Description: ${g.description ?? "(none)"}
Eligibility Text: ${g.eligibility_requirements ?? "(none)"}

Return ONLY a JSON array of requirements shaped as:
[
  {
    "requirement_type": "certification|revenue|employees|location|industry|years_in_business|document|other",
    "field_name": "e.g. cert_mbe, annual_revenue_current, sam_registered, employee_count_ft, address_state, naics_primary",
    "operator": "is_true|is_not_null|greater_than|less_than|equals|contains",
    "required_value": "string or null",
    "is_mandatory": true,
    "weight": 10,
    "description": "plain English"
  }
]`;
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
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
    const { grant_opportunity_id } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // STEP 1 — load grant
    const { data: grant, error: loadErr } = await supabase
      .from("grant_opportunities")
      .select("id, title, description, eligibility_requirements, amount, deadline, funder")
      .eq("id", grant_opportunity_id)
      .maybeSingle();

    if (loadErr) {
      return new Response(
        JSON.stringify({ error: loadErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!grant) {
      return new Response(
        JSON.stringify({ error: "grant_opportunity not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 2 — call Lovable AI Gateway
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(grant) },
        ],
      }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 502;
      return new Response(
        JSON.stringify({ error: `AI gateway error ${aiResp.status}`, detail: text }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const raw: string = aiJson?.choices?.[0]?.message?.content ?? "";
    let extracted: unknown;
    try {
      extracted = JSON.parse(stripFences(raw));
    } catch {
      return new Response(
        JSON.stringify({ error: "AI returned non-JSON", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!Array.isArray(extracted)) {
      return new Response(
        JSON.stringify({ error: "AI response was not an array", raw }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate each requirement; skip malformed ones
    const rows: z.infer<typeof RequirementSchema>[] = [];
    const skipped: unknown[] = [];
    for (const item of extracted) {
      const r = RequirementSchema.safeParse(item);
      if (r.success) rows.push(r.data);
      else skipped.push({ item, issues: r.error.flatten() });
    }

    // STEP 3 — insert
    if (rows.length > 0) {
      const insertPayload = rows.map((r) => ({
        grant_opportunity_id,
        requirement_type: r.requirement_type,
        field_name: r.field_name,
        operator: r.operator,
        required_value: r.required_value,
        is_mandatory: r.is_mandatory,
        weight: r.weight,
        description: r.description,
      }));

      const { error: insErr } = await supabase
        .from("grant_requirements")
        .insert(insertPayload);

      if (insErr) {
        return new Response(
          JSON.stringify({ error: insErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // STEP 4 — return
    const mandatory_count = rows.filter((r) => r.is_mandatory).length;
    return new Response(
      JSON.stringify({
        grant_opportunity_id,
        requirements_extracted: rows.length,
        mandatory_count,
        optional_count: rows.length - mandatory_count,
        skipped_count: skipped.length,
        skipped,
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
