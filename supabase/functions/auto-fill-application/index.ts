// auto-fill-application
// Takes { client_id? , business_profile_id?, funder_type: 'lender'|'grant', funder_id }
// Merges the client's funding_application_profile + AI-generated narratives,
// returns a filled JSON package. Optionally submits when submit=true and the
// funder has an API mapping.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

type Body = {
  client_id?: string;
  business_profile_id?: string;
  funder_type: "lender" | "grant";
  funder_id: string;
  submit?: boolean;
  extra_context?: string;
};

async function generateNarratives(input: Record<string, unknown>) {
  if (!LOVABLE_API_KEY) {
    return {
      cover_letter: "",
      business_narrative: "",
      use_of_funds_plan: "",
      warning: "LOVABLE_API_KEY missing — narratives skipped.",
    };
  }
  const prompt = `You are a professional funding writer. Generate three sections for a ${input.funder_type} application to "${input.funder_name}".
Client + business data:
${JSON.stringify(input, null, 2)}

Return STRICT JSON with keys:
- cover_letter (200-300 words, professional, addressed to the funder)
- business_narrative (300-500 words describing the business, traction, differentiators)
- use_of_funds_plan (200-300 words breaking down how the requested amount will be used)
No markdown, no preamble, JSON only.`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "You produce concise, high-quality funding application copy. Output JSON only." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!r.ok) {
    return {
      cover_letter: "",
      business_narrative: "",
      use_of_funds_plan: "",
      warning: `AI gateway ${r.status}: ${await r.text()}`,
    };
  }
  const j = await r.json();
  try {
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content);
  } catch {
    return { cover_letter: "", business_narrative: "", use_of_funds_plan: "", warning: "AI parse failed" };
  }
}

function computeMissing(profile: Record<string, unknown>) {
  const required = [
    "legal_business_name",
    "ein",
    "business_address_line1",
    "business_city",
    "business_state",
    "business_zip",
    "owner_first_name",
    "owner_last_name",
    "owner_email",
    "annual_revenue",
    "requested_amount",
  ];
  return required.filter((k) => {
    const v = profile[k];
    return v === null || v === undefined || v === "";
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body.funder_type || !body.funder_id) {
      return new Response(JSON.stringify({ error: "funder_type and funder_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.client_id && !body.business_profile_id) {
      return new Response(JSON.stringify({ error: "client_id or business_profile_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load client (if funding-machine)
    let client: any = null;
    if (body.client_id) {
      const { data } = await supabase
        .from("funding_clients")
        .select("*")
        .eq("id", body.client_id)
        .maybeSingle();
      client = data;
    }

    // Load business profile (if grant)
    let businessProfile: any = null;
    if (body.business_profile_id) {
      const { data } = await supabase
        .from("grant_business_profiles")
        .select("*")
        .eq("id", body.business_profile_id)
        .maybeSingle();
      businessProfile = data;
    }

    // Load or bootstrap application profile
    let profile: any = null;
    const profileClientId = body.client_id ?? businessProfile?.client_id ?? null;
    if (profileClientId) {
      const { data } = await supabase
        .from("funding_application_profile")
        .select("*")
        .eq("client_id", profileClientId)
        .maybeSingle();
      profile = data;

      // Auto-seed a profile from funding_clients if missing
      if (!profile && client) {
        const seed = {
          client_id: profileClientId,
          legal_business_name: client.business_name ?? null,
          entity_type: client.business_type ?? null,
          formation_state: client.business_state_of_formation ?? client.business_state ?? null,
          ein: client.ein ?? null,
          duns_number: client.duns_number ?? null,
          business_state: client.business_state ?? null,
          business_phone: client.phone ?? null,
          business_email: client.email ?? null,
          annual_revenue: client.monthly_revenue ? Number(client.monthly_revenue) * 12 : null,
          monthly_revenue: client.monthly_revenue ?? null,
          use_of_funds: client.funding_goal ?? null,
          requested_amount: client.target_funding_amount ?? null,
          owner_first_name: client.first_name ?? null,
          owner_last_name: client.last_name ?? null,
          owner_ssn_last4: client.ssn_last4 ?? null,
          owner_dob: client.date_of_birth ?? null,
          owner_home_address: client.address ?? null,
          owner_home_city: client.city ?? null,
          owner_home_state: client.state ?? null,
          owner_home_zip: client.zip_code ?? null,
          owner_phone: client.phone ?? null,
          owner_email: client.email ?? null,
          minority_owned: client.minority_owned ?? false,
          women_owned: client.women_owned ?? false,
          veteran_owned: client.veteran_owned ?? false,
        };
        const { data: created } = await supabase
          .from("funding_application_profile")
          .insert(seed)
          .select("*")
          .maybeSingle();
        profile = created ?? seed;
      }
    }

    if (!profile) profile = {};

    // Load funder
    let funder: any = null;
    let funderName = "Funder";
    if (body.funder_type === "lender") {
      const { data } = await supabase
        .from("funding_lender_database")
        .select("*")
        .eq("id", body.funder_id)
        .maybeSingle();
      funder = data;
      funderName = data?.lender_name ?? "Lender";
    } else {
      const { data } = await supabase
        .from("grant_funders")
        .select("*")
        .eq("id", body.funder_id)
        .maybeSingle();
      funder = data;
      funderName = data?.name ?? "Grant Funder";
    }

    // Generate narratives
    const narratives = await generateNarratives({
      funder_type: body.funder_type,
      funder_name: funderName,
      funder,
      profile,
      client,
      business_profile: businessProfile,
      extra_context: body.extra_context ?? null,
    });

    const missing_fields = computeMissing(profile);

    const filled_package = {
      funder: { id: body.funder_id, name: funderName, type: body.funder_type },
      business: {
        legal_name: profile.legal_business_name,
        dba: profile.dba,
        entity_type: profile.entity_type,
        formation_state: profile.formation_state,
        formation_date: profile.formation_date,
        ein: profile.ein,
        duns: profile.duns_number,
        naics: profile.naics_code,
        address: {
          line1: profile.business_address_line1,
          line2: profile.business_address_line2,
          city: profile.business_city,
          state: profile.business_state,
          zip: profile.business_zip,
        },
        phone: profile.business_phone,
        email: profile.business_email,
        website: profile.business_website,
        years_in_business: profile.years_in_business,
        annual_revenue: profile.annual_revenue,
        monthly_revenue: profile.monthly_revenue,
        employees: profile.number_of_employees,
        industry: profile.industry,
      },
      owner: {
        first_name: profile.owner_first_name,
        last_name: profile.owner_last_name,
        title: profile.owner_title,
        ssn_last4: profile.owner_ssn_last4,
        dob: profile.owner_dob,
        home_address: profile.owner_home_address,
        home_city: profile.owner_home_city,
        home_state: profile.owner_home_state,
        home_zip: profile.owner_home_zip,
        phone: profile.owner_phone,
        email: profile.owner_email,
        ownership_percent: profile.ownership_percent,
        demographics: {
          minority_owned: !!profile.minority_owned,
          women_owned: !!profile.women_owned,
          veteran_owned: !!profile.veteran_owned,
          lgbtq_owned: !!profile.lgbtq_owned,
          disabled_owned: !!profile.disabled_owned,
        },
      },
      banking: {
        bank_name: profile.bank_name,
        routing_last4: profile.bank_routing_last4,
        account_last4: profile.bank_account_last4,
      },
      request: {
        amount: profile.requested_amount,
        use_of_funds: profile.use_of_funds,
      },
      narratives,
      extra: profile.extra_fields ?? {},
    };

    // Log the run
    const { data: run } = await supabase
      .from("funding_autofill_runs")
      .insert({
        client_id: profileClientId,
        business_profile_id: body.business_profile_id ?? null,
        funder_type: body.funder_type,
        funder_id: body.funder_id,
        funder_name: funderName,
        status: body.submit ? "submitted" : "draft",
        submission_method: body.submit ? "api" : null,
        filled_package,
        narratives,
        missing_fields,
        submitted_at: body.submit ? new Date().toISOString() : null,
      })
      .select("*")
      .maybeSingle();

    // Update profile last_autofilled_at
    if (profile?.id) {
      await supabase
        .from("funding_application_profile")
        .update({ last_autofilled_at: new Date().toISOString() })
        .eq("id", profile.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: run?.id ?? null,
        filled_package,
        missing_fields,
        narratives,
        submitted: !!body.submit,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("auto-fill-application error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
