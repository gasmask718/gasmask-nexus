import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Google Places Text Search
async function textSearch(query: string, apiKey: string, pageToken?: string) {
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 20, languageCode: 'en' };
  if (pageToken) body.pageToken = pageToken;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.googleMapsUri,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.addressComponents,nextPageToken',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Places search failed [${res.status}]: ${await res.text()}`);
  return res.json();
}

// Place Details for phone enrichment
async function placeDetails(placeId: string, apiKey: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,addressComponents',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

function parseCityState(addressComponents: any[]): { city: string; state: string } {
  let city = '', state = '';
  if (!addressComponents) return { city, state };
  for (const c of addressComponents) {
    if (c.types?.includes('locality')) city = c.longText || c.shortText || '';
    if (c.types?.includes('administrative_area_level_1')) state = c.longText || c.shortText || '';
  }
  return { city, state };
}

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

    // 4. Collect place_ids for dedup check
    const placeIds = allPlaces.map(p => p.id).filter(Boolean);
    const { data: existing } = await sb.from('ut_partner_leads').select('external_place_id').in('external_place_id', placeIds);
    const existingSet = new Set((existing || []).map((e: any) => e.external_place_id));

    let leadsFound = 0;
    let duplicatesSkipped = 0;
    let enrichedCount = 0;

    // 5. Process each place
    const leadsToInsert: any[] = [];
    for (const p of allPlaces) {
      if (existingSet.has(p.id)) { duplicatesSkipped++; continue; }

      const { city, state } = parseCityState(p.addressComponents);
      let phone = p.nationalPhoneNumber || null;
      let website = p.websiteUri || null;
      let rating = p.rating || null;

      // Enrich if no phone
      if (!phone && p.id) {
        try {
          const details = await placeDetails(p.id, apiKey);
          if (details) {
            phone = details.nationalPhoneNumber || details.internationalPhoneNumber || null;
            website = details.websiteUri || website;
            rating = details.rating || rating;
            enrichedCount++;
          }
          await delay(150);
        } catch { /* skip enrichment failure */ }
      }

      leadsToInsert.push({
        business_name: p.displayName?.text || 'Unknown',
        category: job.category,
        phone,
        city: city || job.city,
        state: state || job.state,
        source: 'google_places',
        status: 'new',
        external_place_id: p.id,
        website,
        ai_score: 0,
        ai_score_reasons: [],
        outreach_count: 0,
        sms_count: 0,
        owner_verified: false,
        ai_call_eligible: !!phone,
        notes: `Auto-imported from territory job. Rating: ${rating || 'N/A'}`,
      });
      leadsFound++;
    }

    // 6. Batch insert leads
    if (leadsToInsert.length > 0) {
      const BATCH = 50;
      for (let i = 0; i < leadsToInsert.length; i += BATCH) {
        const batch = leadsToInsert.slice(i, i + BATCH);
        const { error: insertErr } = await sb.from('ut_partner_leads').insert(batch);
        if (insertErr) console.error('Insert error:', insertErr.message);
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
