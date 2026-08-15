import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  delay,
  textSearch,
  placeDetails,
  parseCityState,
  DETAILS_MASK_FULL,
  SKU_TEXT_SEARCH,
  SKU_PLACE_DETAILS,
  createUsageTracker,
  fetchBudgetStatus,
  enforceBudgetGate,
  pausedResponse,
} from "../_shared/places-client.ts";
import { errText } from "../_shared/errText.ts";

// Google does not bill non-2xx responses. The tracker notes each call BEFORE
// the fetch, so a rejected request must be un-counted or it lands in the ledger.
function uncount(tracker: any, sku: string) {
  if (tracker?.counts?.[sku]) tracker.counts[sku]--;
}

async function searchOrFail(query: string, apiKey: string, pageToken: string | undefined, tracker: any) {
  try {
    return await textSearch(query, apiKey, pageToken, tracker);
  } catch (e) {
    uncount(tracker, SKU_TEXT_SEARCH);
    throw new Error(`Google Places search failed: ${errText(e)}`);
  }
}

async function detailsOrNull(placeId: string, apiKey: string, tracker: any) {
  const p = await placeDetails(placeId, apiKey, DETAILS_MASK_FULL, tracker);
  if (!p) uncount(tracker, SKU_PLACE_DETAILS);
  return p;
}

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

    // ── UT-006b budget gate: read ONCE, before any Google call ──
    const gate = await fetchBudgetStatus(sb);
    await enforceBudgetGate(sb, gate);
    if (gate.paused) {
      // Zero Google calls, zero ledger rows — nothing was spent.
      return new Response(JSON.stringify(pausedResponse(gate)), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const maxRequests = typeof body.max_requests === 'number' && body.max_requests > 0
      ? body.max_requests : 200;
    const maxSpend = typeof body.max_spend === 'number' && body.max_spend > 0
      ? body.max_spend : gate.month_remaining;
    tracker = createUsageTracker(maxRequests, maxSpend);

    // ── SEARCH: single page (returns nextPageToken if available) ──
    if (action === 'search') {
      const { query, page_token } = body;
      if (!query) throw new Error('query is required');
      ledgerCtx = { search_term: query };
      let places: any[] = [];
      let nextPageToken: string | null = null;
      if (tracker.canRequest()) {
        const result = await searchOrFail(query, apiKey, page_token || undefined, tracker);
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

        const result = await searchOrFail(query, apiKey, pageToken, tracker);
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
      const p = await detailsOrNull(place_id, apiKey, tracker);
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
          const p = await detailsOrNull(pid, apiKey, tracker);
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
    return new Response(JSON.stringify({ success: false, error: msg, ...meta() }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
