import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  delay,
  textSearch,
  placeDetails,
  parseCityState,
  DETAILS_MASK_FULL,
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

  try {
    const body = await req.json();
    const { action } = body;

    // ── SEARCH: single page (returns nextPageToken if available) ──
    if (action === 'search') {
      const { query, page_token } = body;
      if (!query) throw new Error('query is required');
      const result = await textSearch(query, apiKey, page_token || undefined);
      const places = (result.places || []).map(mapPlace);
      return new Response(JSON.stringify({
        places,
        count: places.length,
        next_page_token: result.nextPageToken || null,
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

      for (let page = 0; page < pages; page++) {
        if (page > 0 && !pageToken) break;
        if (page > 0) await delay(2000); // Google requires delay before using pageToken

        const result = await textSearch(query, apiKey, pageToken);
        const mapped = (result.places || []).map(mapPlace);
        allPlaces.push(...mapped);
        pageToken = result.nextPageToken;
        if (!pageToken) break;
      }

      return new Response(JSON.stringify({
        places: allPlaces,
        count: allPlaces.length,
        pages_fetched: Math.min(allPlaces.length > 0 ? Math.ceil(allPlaces.length / 20) : 0, pages),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── DETAILS: single place enrichment ─────────────────────────
    if (action === 'details') {
      const { place_id } = body;
      if (!place_id) throw new Error('place_id is required');
      const p = await placeDetails(place_id, apiKey, DETAILS_MASK_FULL);
      if (!p) throw new Error(`Place Details failed for ${place_id}`);
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
        try {
          const p = await placeDetails(pid, apiKey);
          enriched.push({
            place_id: p.id,
            phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
            website: p.websiteUri || null,
            rating: p.rating || null,
            rating_count: p.userRatingCount || null,
          });
        } catch {
          failed++;
        }
        // Small delay to avoid rate-limits
        if (ids.length > 5) await delay(200);
      }

      return new Response(JSON.stringify({
        enriched,
        enriched_count: enriched.length,
        failed,
        capped_at: MAX_BATCH,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
