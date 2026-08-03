// scraper-ingest — Supabase Edge Function (runs inside Lovable Cloud)
//
// Receives scraped county data from the Railway Python scraper via HTTPS POST,
// checks a shared secret, then writes with service_role (auto-injected here).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed, use POST" }, 405);
  }

  // --- 1. Authenticate the caller -----------------------------------------
  const providedSecret = req.headers.get("x-scraper-secret");
  const expectedSecret = Deno.env.get("SCRAPER_INGEST_SECRET");
  console.log("[scraper-ingest] auth debug", {
    expectedSecretPresent: !!expectedSecret,
    expectedSecretLength: expectedSecret?.length ?? 0,
    providedSecretPresent: !!providedSecret,
    providedSecretLength: providedSecret?.length ?? 0,
    match: !!expectedSecret && providedSecret === expectedSecret,
  });
  if (!expectedSecret || providedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // --- 2. Parse and validate the payload ----------------------------------
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }

  const { source_id, county, state, source_url, pdf_hash, leads } = payload;
  if (!source_id || !county || !state || !Array.isArray(leads)) {
    return json(
      { error: "Required fields: source_id, county, state, leads (array). pdf_hash is optional but recommended." },
      400
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- 3. Hash check: skip the write entirely if nothing changed ---------
  if (pdf_hash) {
    const { data: stateRow } = await supabase
      .from("scraper_state")
      .select("last_value")
      .eq("source_id", source_id)
      .maybeSingle();

    if (stateRow && stateRow.last_value === pdf_hash) {
      await supabase.from("scraper_state").update({
        last_run_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        last_new_records: 0,
      }).eq("source_id", source_id);

      return json({ status: "unchanged", new_records: 0 }, 200);
    }
  }

  // --- 4. Insert leads in chunks; on batch failure, retry per-row and
  //         route individual failures to raw_scraper_leads_rejects so one
  //         bad row can't kill the whole batch.
  const rows = leads.map((lead: Record<string, unknown>) => ({
    source_id, county, state, source_url,
    ...lead,
  }));

  const CHUNK_SIZE = 50;
  let newCount = 0;
  let rejectedCount = 0;
  const rejectSamples: Array<{ index: number; error: string }> = [];

  async function insertOne(row: Record<string, unknown>, index: number) {
    const { data, error } = await supabase
      .from("raw_scraper_leads")
      .upsert([row], { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");
    if (error) {
      rejectedCount++;
      if (rejectSamples.length < 5) {
        rejectSamples.push({ index, error: error.message });
      }
      await supabase.from("raw_scraper_leads_rejects").insert({
        source_id,
        county,
        state,
        source_url,
        pdf_hash: pdf_hash ?? null,
        row_index: index,
        row_payload: row,
        error_message: error.message,
        error_code: (error as { code?: string }).code ?? null,
      });
      return 0;
    }
    return data?.length ?? 0;
  }

  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const { data, error } = await supabase
      .from("raw_scraper_leads")
      .upsert(chunk, { onConflict: "dedupe_key", ignoreDuplicates: true })
      .select("id");

    if (error) {
      // Batch failed — retry each row individually so good rows still land.
      console.warn(`[scraper-ingest] chunk ${offset}-${offset + chunk.length} failed, retrying per-row:`, error.message);
      for (let i = 0; i < chunk.length; i++) {
        newCount += await insertOne(chunk[i], offset + i);
      }
    } else {
      newCount += data?.length ?? 0;
    }
  }

  // --- 5. Record state + run log ------------------------------------------
  const runStatus = rejectedCount === 0 ? "success" : "partial";
  const runError = rejectedCount === 0
    ? null
    : `${rejectedCount} row(s) rejected; samples: ${JSON.stringify(rejectSamples)}`;

  await supabase.from("scraper_state").upsert({
    source_id, county, state, monitor_type: "hash",
    last_value: pdf_hash ?? null,
    last_run_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_new_records: newCount,
    consecutive_failures: 0,
    last_error: runError,
  });

  await supabase.from("scraper_runs").insert({
    source_id,
    status: runStatus,
    new_records: newCount,
    error_message: runError,
    finished_at: new Date().toISOString(),
  });

  return json({
    status: runStatus,
    new_records: newCount,
    total_sent: rows.length,
    rejected: rejectedCount,
    reject_samples: rejectSamples,
  }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
