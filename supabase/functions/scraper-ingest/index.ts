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

  // --- 4. Insert leads, ignoring anything already seen (dedupe_key) ------
  const rows = leads.map((lead: Record<string, unknown>) => ({
    source_id, county, state, source_url,
    ...lead,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("raw_scraper_leads")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (insertError) {
    await supabase.from("scraper_runs").insert({
      source_id,
      status: "failure",
      error_message: insertError.message,
      finished_at: new Date().toISOString(),
    });
    await supabase.from("scraper_state").upsert({
      source_id, county, state, monitor_type: "hash",
      last_run_at: new Date().toISOString(),
      consecutive_failures: 1,
      last_error: insertError.message,
    });
    return json({ error: insertError.message }, 500);
  }

  const newCount = inserted?.length ?? 0;

  // --- 5. Record state + run log ------------------------------------------
  await supabase.from("scraper_state").upsert({
    source_id, county, state, monitor_type: "hash",
    last_value: pdf_hash ?? null,
    last_run_at: new Date().toISOString(),
    last_success_at: new Date().toISOString(),
    last_new_records: newCount,
    consecutive_failures: 0,
    last_error: null,
  });

  await supabase.from("scraper_runs").insert({
    source_id,
    status: "success",
    new_records: newCount,
    finished_at: new Date().toISOString(),
  });

  return json({ status: "success", new_records: newCount, total_sent: rows.length }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
