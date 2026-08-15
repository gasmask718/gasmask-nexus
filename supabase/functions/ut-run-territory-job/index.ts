import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  delay,
  textSearch,
  placeDetails,
  parseCityState,
  normState,
  DETAILS_MASK_FULL,
  SKU_TEXT_SEARCH,
  SKU_PLACE_DETAILS,
  createUsageTracker,
  fetchBudgetStatus,
  enforceBudgetGate,
  pausedResponse,
} from "../_shared/places-client.ts";
import { errText } from "../_shared/errText.ts";



serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not set' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  let tracker = createUsageTracker(200);
  let ledgerCtx: Record<string, unknown> = {};
  let ledgerWritten = false;

  // Writes one ut_api_usage_log row per SKU used. Never throws.
  const writeLedger = async () => {
    if (ledgerWritten) return;
    ledgerWritten = true;
    const rows = tracker.rows();
    if (rows.length === 0) return;
    try {
      await sb.from('ut_api_usage_log').insert(rows.map((r) => ({
        run_id: tracker.runId,
        function_name: 'ut-run-territory-job',
        provider: 'google_places',
        sku: r.sku,
        request_count: r.request_count,
        estimated_cost: r.estimated_cost,
        capped: tracker.capped,
        ...ledgerCtx,
      })));
    } catch (e) {
      console.error('Ledger write failed:', e instanceof Error ? e.message : e);
    }
  };

  try {
    const reqBody = await req.json();
    const { job_id } = reqBody;
    const maxRequests = typeof reqBody.max_requests === 'number' && reqBody.max_requests > 0
      ? reqBody.max_requests : 200;
    if (!job_id) throw new Error('job_id required');

    // ── UT-006b budget gate: read ONCE, before any Google call ──
    const gate = await fetchBudgetStatus(sb);
    await enforceBudgetGate(sb, gate);
    if (gate.paused) {
      // Zero Google calls, zero ledger rows — nothing was spent.
      return new Response(JSON.stringify(pausedResponse(gate)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const maxSpend = typeof reqBody.max_spend === 'number' && reqBody.max_spend > 0
      ? reqBody.max_spend : gate.month_remaining;
    tracker = createUsageTracker(maxRequests, maxSpend);

    // 1. Fetch job
    const { data: job, error: jErr } = await sb.from('ut_territory_jobs').select('*').eq('id', job_id).single();
    if (jErr || !job) throw new Error('Job not found');
    if (job.status === 'running') throw new Error('Job already running');
    if (job.status === 'completed') throw new Error('Job already completed');

    // 2. Mark running
    await sb.from('ut_territory_jobs').update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job_id);

    // Query uses coalesce(search_term, category); leads always get canonical job.category.
    const term = (job.search_term || job.category || '').replace(/_/g, ' ');
    const query = `${term} in ${job.city}, ${job.state}`;

    ledgerCtx = {
      job_id,
      city: job.city,
      state: job.state,
      category: job.category,
      search_term: query,
    };

    // 3. Search Google Places (up to 3 pages)
    const allPlaces: any[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      if (page > 0 && !pageToken) break;
      if (!tracker.canRequest()) { tracker.capped = true; break; }
      if (page > 0) await delay(2500);
      try {
        const result = await textSearch(query, apiKey, pageToken, tracker);
        allPlaces.push(...(result.places || []));
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      } catch (e) {
        // A non-2xx from Google is NOT a zero-result search. The tracker already
        // noted the call before the fetch, so un-count it: Google does not bill
        // rejected requests and neither should our ledger. Then fail loudly.
        if (tracker.counts[SKU_TEXT_SEARCH]) tracker.counts[SKU_TEXT_SEARCH]--;
        const msg = errText(e);
        console.error(`Page ${page} search error:`, msg);
        throw new Error(`Google Places search failed: ${msg}`);
      }
    }

    if (allPlaces.length === 0) {
      await sb.from('ut_territory_jobs').update({
        status: 'completed', finished_at: new Date().toISOString(), leads_found: 0,
        duplicates_skipped: 0, enriched_count: 0, updated_at: new Date().toISOString(),
      }).eq('id', job_id);
      ledgerCtx = { ...ledgerCtx, results_returned: 0, leads_new: 0, leads_duplicate: 0 };
      await writeLedger();
      return new Response(JSON.stringify({
        success: true, leads_found: 0, duplicates_skipped: 0, enriched_count: 0,
        requests_made: tracker.total(), estimated_cost: Number(tracker.estimatedCost().toFixed(4)), capped: tracker.capped,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let leadsFound = 0;
    let duplicatesSkipped = 0;
    let enrichedCount = 0;
    let failedCount = 0;

    // 4. Process each place — the DB is the deduper (ut_upsert_partner_lead).
    //    Per-place try/catch: the RPC RAISES (P0001) on a missing external_place_id
    //    or an unresolvable state, and one bad place must never abort the run.
    const jobState = normState(job.state);

    for (const p of allPlaces) {
      if (!p.id) {
        duplicatesSkipped++;
        console.warn('Skipped place with no place_id:', p.displayName?.text || 'unknown');
        continue;
      }

      const { city, state } = parseCityState(p.addressComponents);
      const finalState = state || jobState;
      if (finalState.length !== 2) {
        duplicatesSkipped++;
        console.warn(`Skipped ${p.id} (${p.displayName?.text || 'unknown'}): unresolvable state`);
        continue;
      }

      let phone = p.nationalPhoneNumber || null;
      let website = p.websiteUri || null;
      let rating = p.rating || null;
      let reviewCount = p.userRatingCount ?? null;
      let types = p.types || [];
      let mapsUrl = p.googleMapsUri || null;
      let lat = typeof p.location?.latitude === 'number' ? p.location.latitude : null;
      let lng = typeof p.location?.longitude === 'number' ? p.location.longitude : null;

      // Enrich if no phone
      if (!phone && !tracker.canRequest()) tracker.capped = true;
      if (!phone && tracker.canRequest()) {
        try {
          const details = await placeDetails(p.id, apiKey, DETAILS_MASK_FULL, tracker);
          // placeDetails returns null on any non-2xx. Un-count it — Google does
          // not bill rejected Details requests either.
          if (!details && tracker.counts[SKU_PLACE_DETAILS]) tracker.counts[SKU_PLACE_DETAILS]--;
          if (details) {
            phone = details.nationalPhoneNumber || details.internationalPhoneNumber || null;
            website = details.websiteUri || website;
            rating = details.rating || rating;
            reviewCount = details.userRatingCount ?? reviewCount;
            if ((!types || types.length === 0) && details.types) types = details.types;
            mapsUrl = mapsUrl || details.googleMapsUri || null;
            // Persist Details coordinates only when Text Search did not supply them.
            if (lat === null && typeof details.location?.latitude === 'number') lat = details.location.latitude;
            if (lng === null && typeof details.location?.longitude === 'number') lng = details.location.longitude;
            enrichedCount++;
          }
          await delay(150);
        } catch { /* skip enrichment failure */ }
      }

      const placeRecord: Record<string, unknown> = {
        external_place_id: p.id,
        business_name: p.displayName?.text || 'Unknown',
        category: job.category,
        phone,
        website,
        full_address: p.formattedAddress || null,
        city: city || job.city,
        state: finalState,
        google_rating: rating,
        review_count: reviewCount,
        google_types: types,
        maps_url: mapsUrl,
        source: 'google_places',
        external_source: 'google_places',
        status: 'new',
      };
      if (lat !== null) placeRecord.latitude = lat;
      if (lng !== null) placeRecord.longitude = lng;


      try {
        const { data: up, error: upErr } = await sb.rpc('ut_upsert_partner_lead', { p: placeRecord });
        if (upErr) throw upErr;
        const row = Array.isArray(up) ? up[0] : up;
        if (row?.was_insert) leadsFound++; else duplicatesSkipped++;
      } catch (e) {
        failedCount++;
        console.error(`Upsert failed for ${p.id}:`, e instanceof Error ? e.message : e);
      }
    }


    // 7. Update job as completed
    await sb.from('ut_territory_jobs').update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      leads_found: leadsFound,
      duplicates_skipped: duplicatesSkipped,
      enriched_count: enrichedCount,
      updated_at: new Date().toISOString(),
    }).eq('id', job_id);
    if (failedCount > 0) console.warn(`Job ${job_id}: ${failedCount} places failed to upsert`);

    // 8. Update state coverage
    const { data: stateRow } = await sb.from('ut_state_coverage').select('*').eq('state', job.state).single();
    if (stateRow) {
      await sb.from('ut_state_coverage').update({
        total_leads: (stateRow.total_leads || 0) + leadsFound,
        duplicate_count: (stateRow.duplicate_count || 0) + duplicatesSkipped,
        status: 'in_progress',
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('state', job.state);
    }

    ledgerCtx = {
      ...ledgerCtx,
      results_returned: allPlaces.length,
      leads_new: leadsFound,
      leads_duplicate: duplicatesSkipped,
    };
    await writeLedger();

    return new Response(JSON.stringify({
      success: true, leads_found: leadsFound, duplicates_skipped: duplicatesSkipped, enriched_count: enrichedCount,
      requests_made: tracker.total(), estimated_cost: Number(tracker.estimatedCost().toFixed(4)), capped: tracker.capped,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    // Mark job as failed if we have job_id
    try {
      const { job_id } = await req.clone().json().catch(() => ({}));
      if (job_id) {
        await sb.from('ut_territory_jobs').update({
          status: 'failed', failed_reason: err instanceof Error ? err.message : 'Unknown error',
          finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq('id', job_id);
      }
    } catch { /* ignore */ }

    await writeLedger();

    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      requests_made: tracker.total(),
      estimated_cost: Number(tracker.estimatedCost().toFixed(4)),
      capped: tracker.capped,
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
