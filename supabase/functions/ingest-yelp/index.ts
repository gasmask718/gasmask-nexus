import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface NeighborhoodTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number; // meters, capped at Yelp max (40000)
}

interface NeighborhoodResult {
  neighborhood_id: string;
  neighborhood: string;
  status: 'success' | 'partial' | 'failed';
  inserted: number;
  skipped: number;
  total: number;
  error?: string;
}

function bboxToCenter(bbox: BBox): { lat: number; lng: number; radius: number } {
  const lat = (bbox.south + bbox.north) / 2;
  const lng = (bbox.west + bbox.east) / 2;
  const dlat = (bbox.north - bbox.south) * 111320 / 2;
  const dlng = (bbox.east - bbox.west) * 111320 * Math.cos(lat * Math.PI / 180) / 2;
  const radius = Math.min(Math.round(Math.sqrt(dlat * dlat + dlng * dlng)), 40000); // Yelp max 40km
  return { lat, lng, radius: Math.max(radius, 500) };
}

async function resolveNeighborhoodBBox(name: string, city: string, state: string, country: string): Promise<BBox | null> {
  const query = `${name}, ${city}, ${state}, ${country}`;
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

function mapToYelpCategory(type: string): string {
  const mapping: Record<string, string> = {
    smoke_shop: 'tobaccoshops',
    tobacco_shop: 'tobaccoshops',
    convenience_store: 'convenience',
    deli: 'delis',
    grocery: 'grocery',
    hookah_lounge: 'hookahbars',
    gas_station: 'servicestations',
    liquor_store: 'beer_and_wine',
    vape_shop: 'vapeshops',
  };
  return mapping[type] || type;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const YELP_API_KEY = Deno.env.get('YELP_API_KEY');
    if (!YELP_API_KEY) {
      return new Response(JSON.stringify({ error: 'YELP_API_KEY not configured. Add it via Settings.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      city,
      state,
      country = 'US',
      business_types = [],
      neighborhood_ids = [],
      neighborhoods = [],
    } = await req.json();

    if (!city || !state) throw new Error('city and state are required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const yelpCategories = business_types.length > 0
      ? business_types.map((t: string) => mapToYelpCategory(t)).join(',')
      : 'tobaccoshops,convenience,delis';

    // --- Resolve neighborhood targets ---
    const targets: NeighborhoodTarget[] = [];

    if (neighborhood_ids.length > 0) {
      const { data: dbHoods } = await supabase
        .from('neighborhoods')
        .select('id, name, bbox, city, state')
        .in('id', neighborhood_ids);

      for (const hood of (dbHoods || [])) {
        let bbox: BBox | null = hood.bbox as BBox | null;

        if (!bbox) {
          const hoodCity = hood.city || city;
          const hoodState = hood.state || state;
          bbox = await resolveNeighborhoodBBox(hood.name, hoodCity, hoodState, country);
          if (bbox) {
            const { error: updateError } = await supabase.from('neighborhoods').update({
              bbox, city: hoodCity, state: hoodState,
            }).eq('id', hood.id);
            if (updateError) console.warn('Failed to cache bbox:', updateError.message);
          }
          await new Promise(r => setTimeout(r, 1100));
        }

        if (bbox) {
          const center = bboxToCenter(bbox);
          targets.push({ id: hood.id, name: hood.name, ...center });
        } else {
          targets.push({ id: hood.id, name: hood.name, lat: 0, lng: 0, radius: 0 });
        }
      }

      const { error: statusError } = await supabase.from('neighborhoods')
        .update({ ingestion_status: 'ingesting' })
        .in('id', neighborhood_ids);
      if (statusError) console.warn('Failed to set ingesting status:', statusError.message);

    } else if (neighborhoods.length > 0) {
      for (const hood of neighborhoods) {
        const bbox = await resolveNeighborhoodBBox(hood, city, state, country);
        if (bbox) {
          const center = bboxToCenter(bbox);
          targets.push({ id: '', name: hood, ...center });
        } else {
          targets.push({ id: '', name: hood, lat: 0, lng: 0, radius: 0 });
        }
        if (neighborhoods.indexOf(hood) < neighborhoods.length - 1) {
          await new Promise(r => setTimeout(r, 1100));
        }
      }
    }

    const neighborhoodResults: NeighborhoodResult[] = [];
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalFound = 0;

    // --- Neighborhood-scoped ingestion ---
    if (targets.length > 0) {
      for (const target of targets) {
        const result: NeighborhoodResult = {
          neighborhood_id: target.id,
          neighborhood: target.name,
          status: 'success',
          inserted: 0,
          skipped: 0,
          total: 0,
        };

        if (target.lat === 0 && target.lng === 0) {
          result.status = 'failed';
          result.error = 'Could not resolve bounding box via Nominatim';
          neighborhoodResults.push(result);
          if (target.id) {
            const { error: upErr } = await supabase.from('neighborhoods').update({
              ingestion_status: 'failed',
              ingestion_stats: { error: result.error },
            }).eq('id', target.id);
            if (upErr) console.warn('Failed to update neighborhood status:', upErr.message);
          }
          continue;
        }

        let allBusinesses: any[] = [];
        let offset = 0;
        const limit = 50;
        let apiFailed = false;

        // Paginate with lat/lng/radius (up to 200 results)
        for (let page = 0; page < 4; page++) {
          try {
            const url = `https://api.yelp.com/v3/businesses/search?latitude=${target.lat}&longitude=${target.lng}&radius=${target.radius}&categories=${yelpCategories}&limit=${limit}&offset=${offset}`;
            const res = await fetch(url, {
              headers: { 'Authorization': `Bearer ${YELP_API_KEY}` },
            });

            if (!res.ok) {
              console.warn(`Yelp API returned ${res.status} for ${target.name}`);
              apiFailed = true;
              break;
            }

            const data = await res.json();
            if (data.businesses && data.businesses.length > 0) {
              allBusinesses.push(...data.businesses);
              offset += limit;
              if (data.businesses.length < limit) break;
            } else break;
          } catch (err) {
            console.error(`Yelp search error for ${target.name}:`, err);
            apiFailed = true;
            break;
          }
        }

        if (apiFailed && allBusinesses.length === 0) {
          result.status = 'failed';
          result.error = 'Yelp API unavailable or rate-limited';
          neighborhoodResults.push(result);
          if (target.id) {
            const { error: upErr } = await supabase.from('neighborhoods').update({
              ingestion_status: 'failed',
              ingestion_stats: { error: result.error },
            }).eq('id', target.id);
            if (upErr) console.warn('Failed to update neighborhood status:', upErr.message);
          }
          continue;
        }

        if (apiFailed) result.status = 'partial';

        // Deduplicate
        const seen = new Set<string>();
        const unique = allBusinesses.filter(b => {
          if (seen.has(b.id)) return false;
          seen.add(b.id);
          return true;
        });

        result.total = unique.length;

        for (const biz of unique) {
          try {
            const addr = [
              biz.location?.address1,
              biz.location?.city || city,
              biz.location?.state || state,
              biz.location?.zip_code,
            ].filter(Boolean).join(', ');

            const { data: existing } = await supabase
              .from('territory_addresses')
              .select('id')
              .ilike('full_address', `%${(biz.location?.address1 || biz.name).substring(0, 30)}%`)
              .eq('city', biz.location?.city || city)
              .limit(1);

            if (existing && existing.length > 0) { result.skipped++; continue; }

            const insertData: Record<string, any> = {
              full_address: addr,
              city: biz.location?.city || city,
              state: biz.location?.state || state,
              zip: biz.location?.zip_code,
              latitude: biz.coordinates?.latitude,
              longitude: biz.coordinates?.longitude,
              address_type: (biz.categories || []).map((c: any) => c.alias).join(', '),
              notes: `Yelp: ${biz.name} | Rating: ${biz.rating} | Reviews: ${biz.review_count} [${target.name}]`,
              neighborhood: target.name,
              discovery_status: 'unknown',
              discovered_by: 'yelp',
            };
            if (target.id) insertData.neighborhood_id = target.id;

            const { error } = await supabase.from('territory_addresses').insert(insertData);
            if (error) result.skipped++; else result.inserted++;
          } catch { result.skipped++; }
        }

        // Update neighborhood status
        if (target.id) {
          const { error: upErr } = await supabase.from('neighborhoods').update({
            ingestion_status: result.status === 'success' ? 'complete' : result.status,
            last_ingested_at: new Date().toISOString(),
            ingestion_stats: {
              source: 'yelp',
              inserted: result.inserted,
              skipped: result.skipped,
              total: result.total,
            },
          }).eq('id', target.id);
          if (upErr) console.warn('Failed to update neighborhood:', upErr.message);
        }

        totalInserted += result.inserted;
        totalSkipped += result.skipped;
        totalFound += result.total;
        neighborhoodResults.push(result);
      }
    } else {
      // --- Legacy city-wide fallback ---
      const location = `${city}, ${state}`;
      let allBusinesses: any[] = [];
      let offset = 0;
      const limit = 50;

      for (let page = 0; page < 4; page++) {
        try {
          const url = `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(location)}&categories=${yelpCategories}&limit=${limit}&offset=${offset}`;
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${YELP_API_KEY}` },
          });
          const data = await res.json();
          if (data.businesses && data.businesses.length > 0) {
            allBusinesses.push(...data.businesses);
            offset += limit;
            if (data.businesses.length < limit) break;
          } else break;
        } catch (err) {
          console.error('Yelp search error:', err);
          break;
        }
      }

      const seen = new Set<string>();
      const unique = allBusinesses.filter(b => {
        if (seen.has(b.id)) return false;
        seen.add(b.id);
        return true;
      });

      totalFound = unique.length;

      for (const biz of unique) {
        try {
          const addr = [
            biz.location?.address1,
            biz.location?.city || city,
            biz.location?.state || state,
            biz.location?.zip_code,
          ].filter(Boolean).join(', ');

          const { data: existing } = await supabase
            .from('territory_addresses')
            .select('id')
            .ilike('full_address', `%${(biz.location?.address1 || biz.name).substring(0, 30)}%`)
            .eq('city', biz.location?.city || city)
            .limit(1);

          if (existing && existing.length > 0) { totalSkipped++; continue; }

          const { error } = await supabase.from('territory_addresses').insert({
            full_address: addr,
            city: biz.location?.city || city,
            state: biz.location?.state || state,
            zip: biz.location?.zip_code,
            latitude: biz.coordinates?.latitude,
            longitude: biz.coordinates?.longitude,
            address_type: (biz.categories || []).map((c: any) => c.alias).join(', '),
            notes: `Yelp: ${biz.name} | Rating: ${biz.rating} | Reviews: ${biz.review_count}`,
            discovery_status: 'unknown',
            discovered_by: 'yelp',
          });

          if (error) totalSkipped++; else totalInserted++;
        } catch { totalSkipped++; }
      }
    }

    // Determine warnings
    const failedHoods = neighborhoodResults.filter(r => r.status === 'failed');
    let warning: string | undefined;
    if (neighborhoodResults.length > 0 && failedHoods.length === neighborhoodResults.length) {
      warning = 'All neighborhoods failed — Yelp API unavailable or rate-limited. Try again later.';
    } else if (failedHoods.length > 0) {
      warning = `${failedHoods.length} neighborhood(s) failed: ${failedHoods.map(h => h.neighborhood).join(', ')}. You can retry just those.`;
    }

    const { error: logError } = await supabase.from('territory_activity_log').insert({
      activity_type: 'ingestion',
      description: `Yelp ingestion: ${totalInserted} new, ${totalSkipped} skipped from ${city}, ${state}`,
      metadata: {
        source: 'yelp',
        city,
        state,
        total: totalFound,
        inserted: totalInserted,
        skipped: totalSkipped,
        neighborhoods: neighborhoodResults.map(r => ({
          id: r.neighborhood_id, name: r.neighborhood, status: r.status,
          inserted: r.inserted, skipped: r.skipped,
        })),
      },
    });
    if (logError) console.warn('Activity log write failed:', logError.message);

    return new Response(JSON.stringify({
      source: 'yelp',
      total: totalFound,
      inserted: totalInserted,
      skipped: totalSkipped,
      duplicates: totalSkipped,
      ...(neighborhoodResults.length > 0 ? { neighborhoods: neighborhoodResults } : {}),
      ...(warning ? { warning } : {}),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      source: 'yelp',
      inserted: 0,
      skipped: 0,
      total: 0,
      error: msg,
      warning: `Ingestion failed: ${msg}`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
