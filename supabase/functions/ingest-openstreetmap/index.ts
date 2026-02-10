import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];

const RETRY_DELAYS = [2000, 5000, 10000];

async function fetchWithRetry(query: string): Promise<any | null> {
  for (const mirror of OVERPASS_MIRRORS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(mirror, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          return await response.json();
        }

        console.warn(`Mirror ${mirror} returned ${response.status}, attempt ${attempt + 1}`);
      } catch (err) {
        console.warn(`Mirror ${mirror} attempt ${attempt + 1} failed: ${err}`);
      }

      if (attempt < 2) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
    // All retries exhausted for this mirror, try next
  }
  return null; // All mirrors failed
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { city, state, country = 'US', business_types = [] } = await req.json();
    if (!city || !state) throw new Error('city and state are required');

    const typeFilters = business_types.length > 0
      ? business_types.map((t: string) => mapBusinessTypeToOSM(t)).flat()
      : ['["shop"="tobacco"]', '["shop"="convenience"]', '["shop"="deli"]', '["amenity"="hookah_lounge"]'];

    const area = `${city}, ${state}, ${country}`;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query splitting: one query per business type filter
    const allElements: any[] = [];
    const seenOsmIds = new Set<string>();
    let queryFailures = 0;

    for (const filter of typeFilters) {
      const query = buildOverpassQuery(area, [filter]);
      const data = await fetchWithRetry(query);

      if (!data) {
        queryFailures++;
        console.warn(`Overpass query failed for filter: ${filter}`);
        continue;
      }

      for (const e of (data.elements || [])) {
        if (e.tags?.name && !seenOsmIds.has(String(e.id))) {
          seenOsmIds.add(String(e.id));
          allElements.push(e);
        }
      }
    }

    // If ALL queries failed, return graceful warning
    if (queryFailures === typeFilters.length) {
      await supabase.from('territory_activity_log').insert({
        activity_type: 'ingestion',
        description: `OpenStreetMap ingestion failed: Overpass unavailable for ${city}, ${state}`,
        metadata: { source: 'openstreetmap', city, state, error: 'all_mirrors_failed' },
      }).catch(() => {});

      return new Response(JSON.stringify({
        source: 'openstreetmap',
        total: 0,
        inserted: 0,
        skipped: 0,
        warning: 'OpenStreetMap is temporarily unavailable. All mirrors timed out — try again later.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform elements to addresses
    const addresses = allElements.map((e: any) => {
      const lat = e.lat || e.center?.lat;
      const lng = e.lon || e.center?.lon;
      const tags = e.tags || {};
      const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
      const fullAddress = [street, tags['addr:city'] || city, tags['addr:state'] || state].filter(Boolean).join(', ');

      return {
        full_address: fullAddress || tags.name,
        city: tags['addr:city'] || city,
        state: tags['addr:state'] || state,
        zip: tags['addr:postcode'] || null,
        latitude: lat,
        longitude: lng,
        address_type: tags.shop || tags.amenity || 'unknown',
        notes: `OSM: ${tags.name}${tags.phone ? ' | ' + tags.phone : ''}`,
        source: 'openstreetmap',
        osm_id: String(e.id),
      };
    });

    let inserted = 0;
    let skipped = 0;

    for (const addr of addresses) {
      try {
        const { data: existing } = await supabase
          .from('territory_addresses')
          .select('id')
          .ilike('full_address', `%${addr.full_address.substring(0, 30)}%`)
          .eq('city', addr.city)
          .limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        const { error } = await supabase.from('territory_addresses').insert({
          full_address: addr.full_address,
          city: addr.city,
          state: addr.state,
          zip: addr.zip,
          latitude: addr.latitude,
          longitude: addr.longitude,
          address_type: addr.address_type,
          notes: addr.notes,
          discovery_status: 'unknown',
          discovered_by: 'openstreetmap',
        });

        if (error) { skipped++; } else { inserted++; }
      } catch { skipped++; }
    }

    const partialWarning = queryFailures > 0
      ? `Partial results: ${queryFailures} of ${typeFilters.length} queries failed. Some business types may be missing.`
      : undefined;

    await supabase.from('territory_activity_log').insert({
      activity_type: 'ingestion',
      description: `OpenStreetMap ingestion: ${inserted} new, ${skipped} skipped from ${city}, ${state}`,
      metadata: { source: 'openstreetmap', city, state, total: addresses.length, inserted, skipped, queryFailures },
    }).catch(() => {});

    return new Response(JSON.stringify({
      source: 'openstreetmap',
      total: addresses.length,
      inserted,
      skipped,
      duplicates: skipped,
      ...(partialWarning ? { warning: partialWarning } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function mapBusinessTypeToOSM(type: string): string[] {
  const mapping: Record<string, string[]> = {
    smoke_shop: ['["shop"="tobacco"]'],
    tobacco_shop: ['["shop"="tobacco"]'],
    convenience_store: ['["shop"="convenience"]'],
    deli: ['["shop"="deli"]'],
    grocery: ['["shop"="supermarket"]', '["shop"="grocery"]'],
    hookah_lounge: ['["amenity"="hookah_lounge"]', '["cuisine"="hookah"]'],
    gas_station: ['["amenity"="fuel"]'],
    liquor_store: ['["shop"="alcohol"]'],
    vape_shop: ['["shop"="e-cigarette"]'],
  };
  return mapping[type] || [`["shop"="${type}"]`];
}

function buildOverpassQuery(area: string, typeFilters: string[]): string {
  const nodeQueries = typeFilters.map(f => `node${f}(area.searchArea);`).join('\n');
  const wayQueries = typeFilters.map(f => `way${f}(area.searchArea);`).join('\n');

  return `
[out:json][timeout:25];
area["name"="${area.split(',')[0].trim()}"]->.searchArea;
(
${nodeQueries}
${wayQueries}
);
out center 500;
`;
}
