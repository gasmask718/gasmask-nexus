import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  delay,
  textSearch,
  placeDetails,
  parseCityState,
  DETAILS_MASK_FULL,
  createUsageTracker,
} from "../_shared/places-client.ts";

function mapPlace(p: any) {
  const { city, state } = parseCityState(p.addressComponents);
  return {
    place_id: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    city,
    state,
    types: p.types || [],
    rating: p.rating || null,
    rating_count: p.userRatingCount ?? null,
    business_status: p.businessStatus || null,
    maps_url: p.googleMapsUri || null,
    phone: p.nationalPhoneNumber || null,
    website: p.websiteUri || null,
    latitude: typeof p.location?.latitude === 'number' ? p.location.latitude : null,
    longitude: typeof p.location?.longitude === 'number' ? p.location.longitude : null,
  };
}


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'GOOGLE_PLACES_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Ledger-only client (service role). Not used for any search behaviour.
  const sbUrl = Deno.env.get('SUPABASE_URL');
  const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const sb = sbUrl && sbKey ? createClient(sbUrl, sbKey) : null;

  let tracker = createUsageTracker(200);
  let ledgerCtx: Record<string, unknown> = {};
  let ledgerWritten = false;

  // Writes one ut_api_usage_log row per SKU used. Never throws.
  const writeLedger = async () => {
    if (ledgerWritten || !sb) return;
    ledgerWritten = true;
    const rows = tracker.rows();
    if (rows.length === 0) return;
    try {
      await sb.from('ut_api_usage_log').insert(rows.map((r) => ({
        run_id: tracker.runId,
        function_name: 'ut-places-search',
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

  const meta = () => ({
    requests_made: tracker.total(),
    estimated_cost: Number(tracker.estimatedCost().toFixed(4)),
    capped: tracker.capped,
  });

  try {
    const body = await req.json();
    const { action } = body;
    if (typeof body.max_requests === 'number' && body.max_requests > 0) {
      tracker = createUsageTracker(body.max_requests);
    }

    // ── SEARCH: single page (returns nextPageToken if available) ──
    if (action === 'search') {
      const { query, page_token } = body;
      if (!query) throw new Error('query is required');
      ledgerCtx = { search_term: query };
      let places: any[] = [];
      let nextPageToken: string | null = null;
      if (tracker.canRequest()) {
        const result = await textSearch(query, apiKey, page_token || undefined, tracker);
        places = (result.places || []).map(mapPlace);
        nextPageToken = result.nextPageToken || null;
      } else {
        tracker.capped = true;
      }
      ledgerCtx = { ...ledgerCtx, results_returned: places.length };
      await writeLedger();
      return new Response(JSON.stringify({
        places,
        count: places.length,
        next_page_token: nextPageToken,
        ...meta(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── SEARCH_ALL: auto-paginate up to 3 pages (~60 results) ────
    if (action === 'search_all') {
      const { query, max_pages = 3 } = body;
      if (!query) throw new Error('query is required');

      const allPlaces: any[] = [];
      let pageToken: string | undefined;
      const pages = Math.min(max_pages, 3);

      ledgerCtx = { search_term: query };

      for (let page = 0; page < pages; page++) {
        if (page > 0 && !pageToken) break;
        if (!tracker.canRequest()) { tracker.capped = true; break; }
        if (page > 0) await delay(2000); // Google requires delay before using pageToken

        const result = await textSearch(query, apiKey, pageToken, tracker);
        const mapped = (result.places || []).map(mapPlace);
        allPlaces.push(...mapped);
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }

      ledgerCtx = { ...ledgerCtx, results_returned: allPlaces.length };
      await writeLedger();

      return new Response(JSON.stringify({
        places: allPlaces,
        count: allPlaces.length,
        pages_fetched: Math.min(allPlaces.length > 0 ? Math.ceil(allPlaces.length / 20) : 0, pages),
        ...meta(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── DETAILS: single place enrichment ─────────────────────────
    if (action === 'details') {
      const { place_id } = body;
      if (!place_id) throw new Error('place_id is required');
      if (!tracker.canRequest()) {
        tracker.capped = true;
        await writeLedger();
        throw new Error('Request cap reached before Place Details call');
      }
      const p = await placeDetails(place_id, apiKey, DETAILS_MASK_FULL, tracker);
      if (!p) throw new Error(`Place Details failed for ${place_id}`);
      ledgerCtx = { results_returned: 1 };
      await writeLedger();
      const { city, state } = parseCityState(p.addressComponents);
      return new Response(JSON.stringify({
        place_id: p.id,
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        city,
        state,
        phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
        website: p.websiteUri || null,
        rating: p.rating || null,
        rating_count: p.userRatingCount || null,
        types: p.types || [],
        business_status: p.businessStatus || null,
        maps_url: p.googleMapsUri || null,
        latitude: typeof p.location?.latitude === 'number' ? p.location.latitude : null,
        longitude: typeof p.location?.longitude === 'number' ? p.location.longitude : null,
        ...meta(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── ENRICH_BATCH: fetch details for multiple places missing phone ──
    if (action === 'enrich_batch') {
      const { place_ids } = body;
      if (!Array.isArray(place_ids) || place_ids.length === 0) throw new Error('place_ids array required');

      const MAX_BATCH = 20; // cap to control costs
      const ids = place_ids.slice(0, MAX_BATCH);
      const enriched: any[] = [];
      let failed = 0;

      for (const pid of ids) {
        if (!tracker.canRequest()) { tracker.capped = true; break; }
        try {
          const p = await placeDetails(pid, apiKey, DETAILS_MASK_FULL, tracker);
          if (!p) throw new Error(`Place Details failed for ${pid}`);
          enriched.push({
            place_id: p.id,
            phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
            website: p.websiteUri || null,
            rating: p.rating || null,
            rating_count: p.userRatingCount || null,
            latitude: typeof p.location?.latitude === 'number' ? p.location.latitude : null,
            longitude: typeof p.location?.longitude === 'number' ? p.location.longitude : null,
          });
        } catch {
          failed++;
        }
        // Small delay to avoid rate-limits
        if (ids.length > 5) await delay(200);
      }

      ledgerCtx = { results_returned: enriched.length };
      await writeLedger();

      return new Response(JSON.stringify({
        enriched,
        enriched_count: enriched.length,
        failed,
        capped_at: MAX_BATCH,
        ...meta(),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    await writeLedger();
    return new Response(JSON.stringify({ error: msg, ...meta() }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
