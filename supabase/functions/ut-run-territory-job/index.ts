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
} from "../_shared/places-client.ts";



serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not set' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  try {
    const { job_id } = await req.json();
    if (!job_id) throw new Error('job_id required');

    // 1. Fetch job
    const { data: job, error: jErr } = await sb.from('ut_territory_jobs').select('*').eq('id', job_id).single();
    if (jErr || !job) throw new Error('Job not found');
    if (job.status === 'running') throw new Error('Job already running');
    if (job.status === 'completed') throw new Error('Job already completed');

    // 2. Mark running
    await sb.from('ut_territory_jobs').update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job_id);

    const category = (job.category || '').replace(/_/g, ' ');
    const query = `${category} in ${job.city}, ${job.state}`;

    // 3. Search Google Places (up to 3 pages)
    const allPlaces: any[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3; page++) {
      if (page > 0 && !pageToken) break;
      if (page > 0) await delay(2500);
      try {
        const result = await textSearch(query, apiKey, pageToken);
        allPlaces.push(...(result.places || []));
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      } catch (e) {
        console.error(`Page ${page} search error:`, e);
        break;
      }
    }

    if (allPlaces.length === 0) {
      await sb.from('ut_territory_jobs').update({
        status: 'completed', finished_at: new Date().toISOString(), leads_found: 0,
        duplicates_skipped: 0, enriched_count: 0, updated_at: new Date().toISOString(),
      }).eq('id', job_id);
      return new Response(JSON.stringify({ success: true, leads_found: 0, duplicates_skipped: 0, enriched_count: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

      // Enrich if no phone
      if (!phone) {
        try {
          const details = await placeDetails(p.id, apiKey);
          if (details) {
            phone = details.nationalPhoneNumber || details.internationalPhoneNumber || null;
            website = details.websiteUri || website;
            rating = details.rating || rating;
            reviewCount = details.userRatingCount ?? reviewCount;
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
        google_types: p.types || [],
        maps_url: p.googleMapsUri || null,
        source: 'google_places',
        external_source: 'google_places',
        status: 'new',
      };
      if (typeof p.location?.latitude === 'number') placeRecord.latitude = p.location.latitude;
      if (typeof p.location?.longitude === 'number') placeRecord.longitude = p.location.longitude;

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

    return new Response(JSON.stringify({
      success: true, leads_found: leadsFound, duplicates_skipped: duplicatesSkipped, enriched_count: enrichedCount,
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

    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
