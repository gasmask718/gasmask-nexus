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

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface NeighborhoodTarget {
  id: string;
  name: string;
  bbox: BBox | null;
}

interface NeighborhoodResult {
  neighborhood_id: string;
  neighborhood: string;
  status: 'success' | 'partial' | 'failed';
  inserted: number;
  skipped: number;
  total: number;
  bbox: BBox | null;
  error?: string;
}

// Resolve a neighborhood name to a bounding box via Nominatim
async function resolveNeighborhoodBBox(neighborhood: string, city: string, state: string, country: string): Promise<BBox | null> {
  const query = `${neighborhood}, ${city}, ${state}, ${country}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&bounded=0`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DynastyOS-TerritoryIngestion/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length || !data[0].boundingbox) return null;
    const [south, north, west, east] = data[0].boundingbox.map(Number);
    return { south, west, north, east };
  } catch (err) {
    console.warn(`Nominatim lookup failed for "${query}": ${err}`);
    return null;
  }
}

// Fetch from Overpass with retry + mirror fallback
async function fetchOverpassWithRetry(query: string): Promise<any | null> {
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
        if (response.ok) return await response.json();
        console.warn(`Mirror ${mirror} returned ${response.status}, attempt ${attempt + 1}`);
      } catch (err) {
        console.warn(`Mirror ${mirror} attempt ${attempt + 1} failed: ${err}`);
      }
      if (attempt < 2) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  return null;
}

function buildBBoxQuery(bbox: BBox, typeFilter: string): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:25];(node${typeFilter}(${bboxStr});way${typeFilter}(${bboxStr}););out center 500;`;
}

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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const {
      city,
      state,
      country = 'US',
      business_types = [],
      neighborhood_ids = [],    // preferred: UUIDs from neighborhoods table
      neighborhoods = [],       // legacy: free-text neighborhood names
    } = await req.json();

    if (!city || !state) throw new Error('city and state are required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const typeFilters = business_types.length > 0
      ? business_types.map((t: string) => mapBusinessTypeToOSM(t)).flat()
      : ['["shop"="tobacco"]', '["shop"="convenience"]', '["shop"="deli"]', '["amenity"="hookah_lounge"]'];

    // --- Resolve targets ---
    const targets: NeighborhoodTarget[] = [];

    if (neighborhood_ids.length > 0) {
      // PREFERRED: Load neighborhoods from DB with pre-stored bbox
      const { data: dbHoods } = await supabase
        .from('neighborhoods')
        .select('id, name, bbox, city, state')
        .in('id', neighborhood_ids);

      for (const hood of (dbHoods || [])) {
        let bbox: BBox | null = hood.bbox as BBox | null;

        // If no bbox stored yet, resolve via Nominatim and persist
        if (!bbox) {
          const hoodCity = hood.city || city;
          const hoodState = hood.state || state;
          bbox = await resolveNeighborhoodBBox(hood.name, hoodCity, hoodState, country);
          if (bbox) {
            await supabase.from('neighborhoods').update({
              bbox,
              city: hoodCity,
              state: hoodState,
              country,
            }).eq('id', hood.id);
          }
          // Rate-limit Nominatim
          await new Promise(r => setTimeout(r, 1100));
        }

        targets.push({ id: hood.id, name: hood.name, bbox });
      }

      // Mark ingesting
      await supabase.from('neighborhoods')
        .update({ ingestion_status: 'ingesting' })
        .in('id', neighborhood_ids);

    } else if (neighborhoods.length > 0) {
      // LEGACY: free-text neighborhoods
      for (const hood of neighborhoods) {
        const bbox = await resolveNeighborhoodBBox(hood, city, state, country);
        targets.push({ id: '', name: hood, bbox });
        if (neighborhoods.indexOf(hood) < neighborhoods.length - 1) {
          await new Promise(r => setTimeout(r, 1100));
        }
      }
    } else {
      // City-level fallback
      const cityBBox = await resolveNeighborhoodBBox(city, '', state, country);
      targets.push({ id: '', name: city, bbox: cityBBox });
    }

    const neighborhoodResults: NeighborhoodResult[] = [];
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalFound = 0;

    for (const target of targets) {
      const result: NeighborhoodResult = {
        neighborhood_id: target.id,
        neighborhood: target.name,
        status: 'success',
        inserted: 0,
        skipped: 0,
        total: 0,
        bbox: target.bbox,
      };

      if (!target.bbox) {
        result.status = 'failed';
        result.error = 'Could not resolve bounding box via Nominatim';
        neighborhoodResults.push(result);
        // Update DB status if we have an id
        if (target.id) {
          await supabase.from('neighborhoods').update({
            ingestion_status: 'failed',
            ingestion_stats: { error: result.error },
          }).eq('id', target.id);
        }
        continue;
      }

      const allElements: any[] = [];
      const seenOsmIds = new Set<string>();
      let queryFailures = 0;

      // Query per business type within this neighborhood's bbox
      for (const filter of typeFilters) {
        const query = buildBBoxQuery(target.bbox, filter);
        const data = await fetchOverpassWithRetry(query);

        if (!data) {
          queryFailures++;
          continue;
        }

        for (const e of (data.elements || [])) {
          if (e.tags?.name && !seenOsmIds.has(String(e.id))) {
            seenOsmIds.add(String(e.id));
            allElements.push(e);
          }
        }
      }

      if (queryFailures === typeFilters.length) {
        result.status = 'failed';
        result.error = 'All Overpass queries timed out';
        neighborhoodResults.push(result);
        if (target.id) {
          await supabase.from('neighborhoods').update({
            ingestion_status: 'failed',
            ingestion_stats: { error: result.error },
          }).eq('id', target.id);
        }
        continue;
      }

      if (queryFailures > 0) result.status = 'partial';

      result.total = allElements.length;

      // Insert addresses tagged with neighborhood_id
      for (const e of allElements) {
        const lat = e.lat || e.center?.lat;
        const lng = e.lon || e.center?.lon;
        const tags = e.tags || {};
        const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
        const fullAddress = [street, tags['addr:city'] || city, tags['addr:state'] || state].filter(Boolean).join(', ');
        const addrStr = fullAddress || tags.name;

        try {
          const { data: existing } = await supabase
            .from('territory_addresses')
            .select('id')
            .ilike('full_address', `%${addrStr.substring(0, 30)}%`)
            .eq('city', tags['addr:city'] || city)
            .limit(1);

          if (existing && existing.length > 0) { result.skipped++; continue; }

          const insertData: Record<string, any> = {
            store_name: tags.name || null,
            full_address: addrStr,
            city: tags['addr:city'] || city,
            state: tags['addr:state'] || state,
            zip: tags['addr:postcode'] || null,
            latitude: lat,
            longitude: lng,
            address_type: tags.shop || tags.amenity || 'unknown',
            notes: `OSM: ${tags.name}${tags.phone ? ' | ' + tags.phone : ''} [${target.name}]`,
            neighborhood: target.name,
            discovery_status: 'unknown',
            discovered_by: 'openstreetmap',
          };

          // Link to neighborhood record if available
          if (target.id) insertData.neighborhood_id = target.id;

          const { error } = await supabase.from('territory_addresses').insert(insertData);
          if (error) { result.skipped++; } else { result.inserted++; }
        } catch { result.skipped++; }
      }

      // Update neighborhood ingestion status in DB
      if (target.id) {
        await supabase.from('neighborhoods').update({
          ingestion_status: result.status === 'success' ? 'complete' : result.status,
          last_ingested_at: new Date().toISOString(),
          ingestion_stats: {
            inserted: result.inserted,
            skipped: result.skipped,
            total: result.total,
            types_queried: typeFilters.length,
          },
        }).eq('id', target.id);
      }

      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      totalFound += result.total;
      neighborhoodResults.push(result);
    }

    const failedHoods = neighborhoodResults.filter(r => r.status === 'failed');
    const partialHoods = neighborhoodResults.filter(r => r.status === 'partial');
    const overallStatus = failedHoods.length === neighborhoodResults.length ? 'failed'
      : (failedHoods.length > 0 || partialHoods.length > 0) ? 'partial_success'
      : 'success';

    let warning: string | undefined;
    if (overallStatus === 'failed') {
      warning = 'All neighborhoods failed — Overpass unavailable. Try again later.';
    } else if (failedHoods.length > 0) {
      warning = `${failedHoods.length} neighborhood(s) failed: ${failedHoods.map(h => h.neighborhood).join(', ')}. You can retry just those.`;
    }

    // Log activity
    const { error: logError } = await supabase.from('territory_activity_log').insert({
      activity_type: 'ingestion',
      description: `OSM ingestion: ${totalInserted} new, ${totalSkipped} skipped across ${neighborhoodResults.length} neighborhood(s) in ${city}, ${state}`,
      metadata: {
        source: 'openstreetmap',
        city,
        state,
        neighborhoods: neighborhoodResults.map(r => ({
          id: r.neighborhood_id,
          name: r.neighborhood,
          status: r.status,
          inserted: r.inserted,
          skipped: r.skipped,
        })),
        total: totalFound,
        inserted: totalInserted,
        skipped: totalSkipped,
      },
    });
    if (logError) console.warn('Activity log write failed:', logError.message);

    return new Response(JSON.stringify({
      source: 'openstreetmap',
      total: totalFound,
      inserted: totalInserted,
      skipped: totalSkipped,
      duplicates: totalSkipped,
      status: overallStatus,
      neighborhoods: neighborhoodResults,
      ...(warning ? { warning } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      source: 'openstreetmap',
      inserted: 0,
      skipped: 0,
      total: 0,
      error: msg,
      warning: `Ingestion failed: ${msg}`,
    }), {
      status: 200, // Never 500 — graceful failure
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
