// GEE-9 — grant-auto-apply
// Generates a full grant application package (cover letter, business narrative,
// fund usage plan, Q&A answers, document checklist) via Lovable AI Gateway and
// persists it to grant_application_packages.
//
// POST { eligibility_result_id: string }
// -> { package_id, cover_letter_preview, documents_ready, documents_missing }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_MODEL = "google/gemini-3-flash-preview";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const DOC_FIELDS: Record<string, string> = {
  doc_articles_of_incorporation: "Articles of Incorporation",
  doc_bank_statements: "Recent Bank Statements",
  doc_business_license: "Business License",
  doc_business_plan: "Business Plan",
  doc_certifications: "Certifications (MBE / WBE / Veteran / etc.)",
  doc_ein_letter: "EIN Letter (IRS SS-4)",
  doc_financial_statements: "Financial Statements",
  doc_insurance: "Certificate of Insurance",
  doc_lease_or_deed: "Lease Agreement or Property Deed",
  doc_operating_agreement: "Operating Agreement",
  doc_profit_loss: "Profit & Loss Statement",
  doc_resumes: "Owner / Key Staff Resumes",
  doc_tax_returns_current: "Most Recent Business Tax Return",
  doc_tax_returns_prior: "Prior Year Business Tax Return",
};

async function aiCall(system: string, user: string, maxTokens: number): Promise<string> {
  if (!LOVABLE_API_KEY) throw new Error("AI Gateway unavailable");
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

function stripJsonFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  }
  return t;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const eligibility_result_id: string | undefined = body?.eligibility_result_id;
    if (!eligibility_result_id) {
      return new Response(JSON.stringify({ error: "eligibility_result_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // STEP 1 — load eligibility + business + grant
    const { data: elig, error: eligErr } = await supabase
      .from("grant_eligibility_results")
      .select("*")
      .eq("id", eligibility_result_id)
      .maybeSingle();
    if (eligErr || !elig) {
      return new Response(JSON.stringify({ error: eligErr?.message ?? "eligibility not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: biz }, { data: grant }] = await Promise.all([
      supabase.from("grant_business_profiles").select("*").eq("id", elig.business_profile_id).maybeSingle(),
      supabase.from("grant_opportunities").select("*").eq("id", elig.grant_opportunity_id).maybeSingle(),
    ]);

    if (!biz || !grant) {
      return new Response(JSON.stringify({ error: "business or grant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 2a — reuse existing package if present (prevent duplicates)
    const { data: existing } = await supabase
      .from("grant_application_packages")
      .select("id, documents_ready, documents_missing, cover_letter")
      .eq("eligibility_result_id", eligibility_result_id)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from("grant_eligibility_results")
        .update({ application_status: "package_ready" })
        .eq("id", eligibility_result_id);
      return new Response(
        JSON.stringify({
          package_id: existing.id,
          reused: true,
          cover_letter_preview: String(existing.cover_letter ?? "").slice(0, 200),
          documents_ready: existing.documents_ready ?? [],
          documents_missing: existing.documents_missing ?? [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // STEP 2 — document checklist
    const documents_required = Object.values(DOC_FIELDS);
    const documents_ready: string[] = [];
    const documents_missing: string[] = [];
    for (const [field, label] of Object.entries(DOC_FIELDS)) {
      if (biz[field] === true) documents_ready.push(label);
      else documents_missing.push(label);
    }

    const grantTitle = grant.title || grant.grant_name;
    const grantAmount = grant.amount ?? grant.amount_typical ?? grant.amount_max ?? grant.amount_min;
    const funderName = grant.funder_name || grant.funder;
    const funderContact = grant.contact_email ? "Grant Review Committee" : "Grant Review Committee";

    const profileFacts = `
Business: ${biz.business_name ?? "N/A"}
Owner: ${biz.owner_name ?? "N/A"} (${biz.owner_race ?? "not disclosed"})
Certifications: MBE=${!!biz.cert_mbe}, Veteran=${!!biz.cert_veteran}
Incorporated: ${biz.date_incorporated ?? "N/A"} (${biz.years_in_business ?? "?"} yrs in business)
Annual Revenue: $${biz.annual_revenue_current ?? "N/A"}
Full-Time Employees: ${biz.employee_count_ft ?? "N/A"}
Location: ${biz.address_city ?? ""}, ${biz.address_state ?? ""}
NAICS: ${biz.naics_primary ?? "N/A"}
Grant: ${grantTitle} from ${funderName}
Grant Amount: $${grantAmount ?? "N/A"}
Grant Description: ${grant.description ?? ""}
`.trim();

    let cover_letter = "";
    let business_narrative = "";
    let fund_usage_plan = "";
    let qa_answers: Array<{ question: string; answer: string }> = [];
    let aiError: string | null = null;

    try {
      // STEP 3 — cover letter
      cover_letter = await aiCall(
        "You write professional, warm, and specific grant cover letters. Never invent facts not provided.",
        `Write a professional 3-paragraph cover letter addressed to "${funderContact}" for the grant application described below.
Paragraph 1: who we are and why we are applying.
Paragraph 2: how we will use the funds specifically.
Paragraph 3: community impact and why we are a strong candidate.

${profileFacts}`,
        1000,
      );

      // STEP 4 — business narrative
      business_narrative = await aiCall(
        "You are an expert grant writer producing compelling, factual business narratives.",
        `Write a 4-6 paragraph business narrative covering: founding story, mission, growth trajectory, community impact, and future plans. Use only the facts below.

${profileFacts}`,
        1200,
      );

      // STEP 5 — fund usage plan
      fund_usage_plan = await aiCall(
        "You produce concrete, itemized fund usage plans with percentages and categories.",
        `Produce an itemized fund usage plan for $${grantAmount ?? "the grant"} showing exactly how funds will be allocated by category and percentage (must total 100%). Categories should be realistic for this business.

${profileFacts}`,
        600,
      );

      // STEP 6 — Q&A
      const qaRaw = await aiCall(
        "You return ONLY valid JSON, no prose. Answer each question thoroughly using provided facts.",
        `Answer the following 7 standard grant questions for this business. Return ONLY a JSON array of objects: [{"question":"...","answer":"..."}].

Questions:
1. Describe your business and its mission.
2. How will you use these grant funds?
3. How many jobs will this grant help create?
4. How does your business serve the community?
5. What makes your business unique?
6. Describe the challenges this grant will help overcome.
7. What are your 3-year growth goals?

${profileFacts}`,
        1500,
      );
      try {
        const parsed = JSON.parse(stripJsonFence(qaRaw));
        if (Array.isArray(parsed)) qa_answers = parsed.filter((x) => x?.question && x?.answer);
      } catch {
        qa_answers = [];
      }
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }

    if (aiError && !cover_letter) {
      return new Response(
        JSON.stringify({ error: "AI Gateway unavailable", detail: aiError, package_id: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 7 — insert package
    const { data: pkg, error: insErr } = await supabase
      .from("grant_application_packages")
      .insert({
        eligibility_result_id,
        business_profile_id: elig.business_profile_id,
        grant_opportunity_id: elig.grant_opportunity_id,
        cover_letter,
        business_narrative,
        fund_usage_plan,
        qa_answers,
        documents_required,
        documents_ready,
        documents_missing,
        generation_status: "ready",
        generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr || !pkg) {
      return new Response(JSON.stringify({ error: insErr?.message ?? "insert failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STEP 8 — flip eligibility application_status
    await supabase
      .from("grant_eligibility_results")
      .update({ application_status: "package_ready" })
      .eq("id", eligibility_result_id);

    // STEP 9 — response
    return new Response(
      JSON.stringify({
        package_id: pkg.id,
        cover_letter_preview: cover_letter.slice(0, 200),
        documents_ready,
        documents_missing,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg, package_id: null }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
