// promote-leads — Supabase Edge Function
//
// Runs on a schedule (via a lightweight Railway cron service, same shared-
// secret auth pattern as scraper-ingest). For every unpromoted row in
// raw_scraper_leads:
//   - If it passes all validation rules, promote it into surplus_funds_leads
//     automatically — no human needed.
//   - If it fails any rule, insert it into raw_scraper_leads_flagged with
//     the specific reason(s), and leave it unpromoted for a human to check
//     later. Nothing is silently lost or silently promoted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DATE_LIKE_CASE_NUMBER = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const JUNK_NAME_PHRASES = ["LIST LAST UPDATED", "REPORT DATE", "GRAND TOTAL", "PAGE "];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed, use POST" }, 405);
  }

  const providedSecret = req.headers.get("x-scraper-secret");
  const expectedSecret = Deno.env.get("SCRAPER_INGEST_SECRET");
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: candidates, error: fetchError } = await supabase
    .from("raw_scraper_leads")
    .select("*")
    .is("promoted_at", null)
    .limit(1000);

  if (fetchError) {
    return json({ error: fetchError.message }, 500);
  }

  let promoted = 0;
  let flagged = 0;
  const errors: string[] = [];

  for (const row of candidates ?? []) {
    const reasons = validate(row);

    if (reasons.length === 0) {
      const lead = {
        county: row.county,
        state: row.state,
        court_case_number: row.case_number,
        surplus_amount: row.surplus_amount,
        last_name: row.claimant_name,
        lead_source: `scraper_${row.source_id}`,
        status: "skip_trace_pending",
        notes: buildNotes(row),
      };

      const { data: inserted, error: insertError } = await supabase
        .from("surplus_funds_leads")
        .insert(lead)
        .select("id")
        .single();

      if (insertError) {
        errors.push(`row ${row.id}: ${insertError.message}`);
        continue;
      }

      await supabase
        .from("raw_scraper_leads")
        .update({ promoted_at: new Date().toISOString(), promoted_to_lead_id: inserted.id })
        .eq("id", row.id);

      promoted++;
    } else {
      await supabase.from("raw_scraper_leads_flagged").insert({
        raw_scraper_lead_id: row.id,
        source_id: row.source_id,
        reasons: reasons.join("; "),
        snapshot: row,
      });
      flagged++;
    }
  }

  return json({ status: "success", promoted, flagged, errors, total_checked: (candidates ?? []).length }, 200);
});

function validate(row: Record<string, unknown>): string[] {
  const reasons: string[] = [];

  const amount = row.surplus_amount as number | null;
  if (amount === null || amount === undefined || amount <= 0) {
    reasons.push("missing or non-positive surplus_amount");
  }

  const caseNumber = (row.case_number as string | null)?.trim();
  if (!caseNumber) {
    reasons.push("missing case_number");
  } else if (DATE_LIKE_CASE_NUMBER.test(caseNumber)) {
    reasons.push("case_number looks like a bare date, likely a parsing artifact");
  }

  const name = (row.claimant_name as string | null)?.toUpperCase() ?? "";
  for (const phrase of JUNK_NAME_PHRASES) {
    if (name.includes(phrase)) {
      reasons.push(`claimant_name contains known junk phrase: "${phrase}"`);
      break;
    }
  }

  return reasons;
}

function buildNotes(row: Record<string, unknown>): string {
  const parts: string[] = [];
  if (row.parcel_id) parts.push(`Parcel/ref: ${row.parcel_id}`);
  if (row.sale_date) parts.push(`Sale/receipt date: ${row.sale_date}`);
  if (row.claim_deadline) parts.push(`Deadline: ${row.claim_deadline}`);
  parts.push(`Source: ${row.source_url}`);
  parts.push(`Scraped: ${row.scraped_at}`);
  parts.push(`Auto-promoted: ${new Date().toISOString()}`);
  return parts.join(" | ");
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
