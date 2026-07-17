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
//
// PERFORMANCE NOTE (fixed after a real timeout on a 224-row DeKalb batch):
// the original version processed rows ONE AT A TIME in a loop - 2 sequential
// DB calls per row (insert + update), meaning ~450 round-trips for 224 rows.
// That's slow enough to hit both our own client timeout and Supabase's own
// function execution limit, and the problem COMPOUNDS: a timed-out run
// leaves rows unpromoted, so the next run has an even bigger backlog,
// making the next timeout more likely. A smaller batch limit was tried as
// a band-aid but doesn't fix the underlying issue, just delays it.
//
// THE REAL FIX: batch everything into a small, fixed number of sequential
// DB round-trips regardless of row count - validate all rows in memory
// first (fast, no DB calls), then do ONE bulk insert for all valid leads,
// then N concurrent (not sequential) UPDATE calls for their
// promoted_at/promoted_to_lead_id values (concurrent rather than one bulk
// call because raw_scraper_leads.id is GENERATED ALWAYS AS IDENTITY,
// which rejects the upsert-based bulk approach - see note below), and
// ONE bulk insert for all flagged rows. Regardless of row count, this is
// 3 sequential waits (fetch, insert, flag-insert) plus one concurrent
// batch of updates that all fire in parallel rather than one-at-a-time.
//
// VALIDATION RULES — each one traces back to a real bad row we actually
// found and removed by hand earlier in this project. Not speculative:
//   1. surplus_amount must be present and > 0
//      (catches Collier's negative reversion/bookkeeping entries)
//   2. case_number must be present and non-empty
//      (a lead with no reference number can't be worked - skip traced or
//      filed - by anyone downstream)
//   3. case_number must not itself look like a bare date
//      (catches the Sumter '6/28/2019' column-misalignment artifact)
//   4. claimant_name must not contain known junk phrases
//      (catches Sumter's "LIST LAST UPDATED 6/5/2026" metadata line that
//      slipped through as if it were a real row)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DATE_LIKE_CASE_NUMBER = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const JUNK_NAME_PHRASES = ["LIST LAST UPDATED", "REPORT DATE", "GRAND TOTAL", "PAGE "];
const BATCH_LIMIT = 1000; // safety cap per run - bulk operations handle this size easily;
                          // a backlog beyond this just gets caught next run

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

  // 1 DB call: fetch every unpromoted row.
  const { data: candidates, error: fetchError } = await supabase
    .from("raw_scraper_leads")
    .select("*")
    .is("promoted_at", null)
    .limit(BATCH_LIMIT);

  if (fetchError) {
    return json({ error: fetchError.message }, 500);
  }

  const rows = candidates ?? [];
  if (rows.length === 0) {
    return json({ status: "success", promoted: 0, flagged: 0, errors: [], total_checked: 0 }, 200);
  }

  // Validate everything in memory first - no DB calls in this loop at all,
  // so this is fast regardless of row count.
  const toPromote: typeof rows = [];
  const toFlag: { row: (typeof rows)[number]; reasons: string[] }[] = [];

  for (const row of rows) {
    const reasons = validate(row);
    if (reasons.length === 0) {
      toPromote.push(row);
    } else {
      toFlag.push({ row, reasons });
    }
  }

  const errors: string[] = [];
  let promoted = 0;
  let flagged = 0;

  // 2 DB calls total (insert + update), regardless of how many rows.
  if (toPromote.length > 0) {
    const newLeads = toPromote.map((row) => ({
      county: row.county,
      state: row.state,
      court_case_number: row.case_number,
      surplus_amount: row.surplus_amount,
      last_name: row.claimant_name,
      lead_source: `scraper_${row.source_id}`,
      status: "skip_trace_pending",
      notes: buildNotes(row),
    }));

    const { data: insertedLeads, error: insertError } = await supabase
      .from("surplus_funds_leads")
      .insert(newLeads)
      .select("id");

    if (insertError) {
      errors.push(`bulk insert failed: ${insertError.message}`);
    } else if (insertedLeads) {
      // A single INSERT ... RETURNING preserves input order in Postgres,
      // so insertedLeads[i] corresponds to toPromote[i].
      const now = new Date().toISOString();

      // NOTE: upsert() was tried here first, but it internally issues an
      // INSERT ... ON CONFLICT statement, which fails with "cannot insert
      // a non-DEFAULT value into column 'id'" because raw_scraper_leads.id
      // is GENERATED ALWAYS AS IDENTITY (strict auto-increment - doesn't
      // allow explicit id values even on the insert-side of an upsert).
      // Fix: real per-row UPDATE calls (no id insertion at all), fired
      // CONCURRENTLY via Promise.all rather than sequentially - keeps the
      // "fast regardless of row count" property without hitting the
      // identity-column restriction.
      const updateResults = await Promise.all(
        toPromote.map((row, i) =>
          supabase
            .from("raw_scraper_leads")
            .update({
              promoted_at: now,
              promoted_to_lead_id: insertedLeads[i]?.id ?? null,
            })
            .eq("id", row.id)
        )
      );
      const updateErrors = updateResults.filter((r) => r.error);

      if (updateErrors.length > 0) {
        errors.push(`${updateErrors.length} status update(s) failed: ${updateErrors[0].error?.message}`);
        promoted = toPromote.length - updateErrors.length;
      } else {
        promoted = toPromote.length;
      }
    }
  }

  // 1 more DB call for everything that failed validation.
  if (toFlag.length > 0) {
    const flagRows = toFlag.map(({ row, reasons }) => ({
      raw_scraper_lead_id: row.id,
      source_id: row.source_id,
      reasons: reasons.join("; "),
      snapshot: row,
    }));

    const { error: flagError } = await supabase
      .from("raw_scraper_leads_flagged")
      .insert(flagRows);

    if (flagError) {
      errors.push(`bulk flag insert failed: ${flagError.message}`);
    } else {
      // CRITICAL: also mark these rows as processed (promoted_at set, but
      // promoted_to_lead_id left null since nothing was actually created
      // in surplus_funds_leads). Without this, a flagged row never gets
      // marked as "done" - the next run's `.is('promoted_at', null)`
      // fetch picks it right back up and flags it again, forever,
      // duplicating rows in raw_scraper_leads_flagged every single week.
      // Real bug found on Brevard's first Railway run: 75 rows were
      // re-flagged identically on a second run of unchanged data.
      const flagNow = new Date().toISOString();
      const flagUpdateResults = await Promise.all(
        toFlag.map(({ row }) =>
          supabase
            .from("raw_scraper_leads")
            .update({ promoted_at: flagNow, promoted_to_lead_id: null })
            .eq("id", row.id)
        )
      );
      const flagUpdateErrors = flagUpdateResults.filter((r) => r.error);
      if (flagUpdateErrors.length > 0) {
        errors.push(`${flagUpdateErrors.length} flagged-row status update(s) failed: ${flagUpdateErrors[0].error?.message}`);
      }
      flagged = toFlag.length;
    }
  }

  return json({ status: "success", promoted, flagged, errors, total_checked: rows.length }, 200);
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
