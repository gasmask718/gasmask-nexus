import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Places Text Search (New) - cost-efficient with field masks
async function textSearch(query: string, apiKey: string) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.rating,places.googleMapsUri,places.businessStatus,places.nationalPhoneNumber,places.websiteUri,places.addressComponents',
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 20,
      languageCode: 'en',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Places Text Search failed [${res.status}]: ${err}`);
  }
  return res.json();
}

// Google Places Details (New) - selective enrichment
async function placeDetails(placeId: string, apiKey: string) {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,rating,userRatingCount,types,businessStatus,googleMapsUri,addressComponents',
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Place Details failed [${res.status}]: ${err}`);
  }
  return res.json();
}

function parseCityState(addressComponents: any[]): { city: string; state: string } {
  let city = '', state = '';
  if (!addressComponents) return { city, state };
  for (const c of addressComponents) {
    if (c.types?.includes('locality')) city = c.longText || c.shortText || '';
    if (c.types?.includes('administrative_area_level_1')) state = c.shortText || '';
  }
  return { city, state };
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
    const { action, query, place_id } = body;

    if (action === 'search') {
      if (!query) throw new Error('query is required');
      const result = await textSearch(query, apiKey);
      const places = (result.places || []).map((p: any) => {
        const { city, state } = parseCityState(p.addressComponents);
        return {
          place_id: p.id,
          name: p.displayName?.text || '',
          address: p.formattedAddress || '',
          city,
          state,
          types: p.types || [],
          rating: p.rating || null,
          business_status: p.businessStatus || null,
          maps_url: p.googleMapsUri || null,
          phone: p.nationalPhoneNumber || null,
          website: p.websiteUri || null,
        };
      });
      return new Response(JSON.stringify({ places, count: places.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'details') {
      if (!place_id) throw new Error('place_id is required');
      const p = await placeDetails(place_id, apiKey);
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
