import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { city, state, country = 'US', business_types = [] } = await req.json();
    if (!city || !state) throw new Error('city and state are required');

    // Build Overpass query for shops/amenities in the area
    const typeFilters = business_types.length > 0
      ? business_types.map((t: string) => {
          const osmTag = mapBusinessTypeToOSM(t);
          return osmTag;
        }).flat()
      : ['["shop"="tobacco"]', '["shop"="convenience"]', '["shop"="deli"]', '["amenity"="hookah_lounge"]'];

    const area = `${city}, ${state}, ${country}`;
    const overpassQuery = buildOverpassQuery(area, typeFilters);

    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(overpassQuery)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) throw new Error(`Overpass API error: ${response.status}`);
    const data = await response.json();

    const elements = (data.elements || []).filter((e: any) => e.tags?.name);

    // Transform to territory address format
    const addresses = elements.map((e: any) => {
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

    // Insert into territory_addresses via Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

        if (existing && existing.length > 0) {
          skipped++;
          continue;
        }

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

    // Log activity
    await supabase.from('territory_activity_log').insert({
      activity_type: 'ingestion',
      description: `OpenStreetMap ingestion: ${inserted} new, ${skipped} skipped from ${city}, ${state}`,
      metadata: { source: 'openstreetmap', city, state, total: addresses.length, inserted, skipped },
    }).catch(() => {});

    return new Response(JSON.stringify({ total: addresses.length, inserted, skipped, duplicates: skipped }), {
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
[out:json][timeout:30];
area["name"="${area.split(',')[0].trim()}"]->.searchArea;
(
${nodeQueries}
${wayQueries}
);
out center 500;
`;
}
