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
  radius: number; // meters
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
  // Approximate radius from bbox diagonal (haversine simplified)
  const dlat = (bbox.north - bbox.south) * 111320 / 2;
  const dlng = (bbox.east - bbox.west) * 111320 * Math.cos(lat * Math.PI / 180) / 2;
  const radius = Math.min(Math.round(Math.sqrt(dlat * dlat + dlng * dlng)), 50000); // Google max 50km
  return { lat, lng, radius: Math.max(radius, 500) };
}

// Resolve neighborhood bbox via Nominatim
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') || Deno.env.get('GOOGLE_MAPS_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'Google API key not configured. Expected GOOGLE_PLACES_API_KEY in environment.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('Google API key found, length:', GOOGLE_MAPS_API_KEY.length);

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
          if (center.radius <= 0 || center.radius > 50000) {
            targets.push({ id: hood.id, name: hood.name, lat: 0, lng: 0, radius: 0 });
          } else {
            targets.push({ id: hood.id, name: hood.name, ...center });
          }
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
          if (center.radius <= 0 || center.radius > 50000) {
            targets.push({ id: '', name: hood, lat: 0, lng: 0, radius: 0 });
          } else {
            targets.push({ id: '', name: hood, ...center });
          }
        } else {
          targets.push({ id: '', name: hood, lat: 0, lng: 0, radius: 0 });
        }
        if (neighborhoods.indexOf(hood) < neighborhoods.length - 1) {
          await new Promise(r => setTimeout(r, 1100));
        }
      }
    }

    // Build search queries
    const typeLabels = business_types.length > 0
      ? business_types.map((t: string) => t.replace(/_/g, ' '))
      : ['smoke shop', 'convenience store'];

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

        if (target.lat === 0 && target.lng === 0 || target.radius <= 0) {
          result.status = 'failed';
          result.error = target.radius <= 0 && target.lat !== 0
            ? 'Invalid radius computed from bounding box'
            : 'Could not resolve bounding box via Nominatim';
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

        let allPlaces: any[] = [];

        for (const typeLabel of typeLabels) {
          try {
            // Use Nearby Search with location bias
            const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${target.lat},${target.lng}&radius=${target.radius}&keyword=${encodeURIComponent(typeLabel)}&key=${GOOGLE_MAPS_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();

            // Normalize Google API-level failures (HTTP 200 but logically failed)
            const gStatus = data.status as string;
            if (gStatus === 'OVER_QUERY_LIMIT' || gStatus === 'REQUEST_DENIED' || gStatus === 'INVALID_REQUEST') {
              console.warn(`Google Places API status=${gStatus} for "${typeLabel}" in ${target.name}: ${data.error_message || ''}`);
              result.status = 'failed';
              result.error = `Google API: ${gStatus}${data.error_message ? ' — ' + data.error_message : ''}`;
              break; // stop querying more types for this neighborhood
            }

            if (gStatus === 'ZERO_RESULTS') {
              // Not a failure, but nothing found for this type — continue to next type
              continue;
            }

            if (data.results && data.results.length > 0) {
              allPlaces.push(...data.results);

              // Follow next_page_token (up to 2 pages)
              let nextToken = data.next_page_token;
              for (let page = 0; page < 2 && nextToken; page++) {
                await new Promise(r => setTimeout(r, 2000));
                const nextUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextToken}&key=${GOOGLE_MAPS_API_KEY}`;
                const nextRes = await fetch(nextUrl);
                const nextData = await nextRes.json();

                const nextStatus = nextData.status as string;
                if (nextStatus === 'OVER_QUERY_LIMIT' || nextStatus === 'REQUEST_DENIED') {
                  result.status = 'partial';
                  result.error = `Google API: ${nextStatus} during pagination`;
                  break;
                }

                if (nextData.results) allPlaces.push(...nextData.results);
                nextToken = nextData.next_page_token;
              }
            } else {
              // Fallback to text search if nearby returns nothing
              const textUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${typeLabel} in ${target.name}, ${city}, ${state}`)}&key=${GOOGLE_MAPS_API_KEY}`;
              const textRes = await fetch(textUrl);
              const textData = await textRes.json();

              const tStatus = textData.status as string;
              if (tStatus === 'OVER_QUERY_LIMIT' || tStatus === 'REQUEST_DENIED' || tStatus === 'INVALID_REQUEST') {
                result.status = 'partial';
                result.error = `Google API fallback: ${tStatus}`;
              } else if (textData.results) {
                allPlaces.push(...textData.results);
              }
            }
          } catch (err) {
            console.error(`Google Places search failed for "${typeLabel}" in ${target.name}:`, err);
            result.status = 'partial';
            result.error = `Fetch error for "${typeLabel}": ${err}`;
          }
        }

        // Deduplicate by place_id
        const seen = new Set<string>();
        const unique = allPlaces.filter(p => {
          if (seen.has(p.place_id)) return false;
          seen.add(p.place_id);
          return true;
        });

        result.total = unique.length;

        let enrichedCount = 0;
        for (const place of unique) {
          try {
            const addr = place.formatted_address || place.name;

            // Smart duplicate detection — check by place_id first, then address
            let existing: any = null;
            if (place.place_id) {
              const { data: byPlaceId } = await supabase
                .from('territory_addresses')
                .select('id, phone, store_name')
                .eq('place_id', place.place_id)
                .maybeSingle();
              existing = byPlaceId;
            }
            if (!existing) {
              const { data: byAddr } = await supabase
                .from('territory_addresses')
                .select('id, phone, store_name')
                .ilike('full_address', `%${addr.substring(0, 30)}%`)
                .limit(1);
              existing = byAddr?.[0] || null;
            }

            // Fetch phone number via Place Details
            let phone: string | null = null;
            let website: string | null = null;
            let detailAddress = addr;
            try {
              const detailRes = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,formatted_address,website&key=${GOOGLE_MAPS_API_KEY}`
              );
              const detailData = await detailRes.json();
              if (detailData.status === 'OK') {
                phone = detailData.result.formatted_phone_number || null;
                website = detailData.result.website || null;
                detailAddress = detailData.result.formatted_address || addr;
              }
              await new Promise(r => setTimeout(r, 100));
            } catch (e) {
              console.warn('Place Details fetch failed for', place.name, e);
            }

            if (existing) {
              // Record exists — enrich if missing phone
              if (!existing.phone && phone) {
                await supabase
                  .from('territory_addresses')
                  .update({
                    phone: phone,
                    website: website,
                    place_id: place.place_id,
                    full_address: detailAddress,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', existing.id);
                enrichedCount++;
                console.log(`Enriched ${existing.store_name} with phone: ${phone}`);
              } else {
                result.skipped++;
              }
              continue;
            }

            const insertData: Record<string, any> = {
              store_name: place.name || null,
              full_address: detailAddress,
              city: city,
              state: state,
              latitude: place.geometry?.location?.lat,
              longitude: place.geometry?.location?.lng,
              address_type: 'commercial',
              notes: `Google Places: ${place.name} | Rating: ${place.rating || 'N/A'} [${target.name}]`,
              neighborhood: target.name,
              discovery_status: 'unknown',
              discovered_by: 'google_places',
              place_id: place.place_id,
            };
            if (phone) insertData.phone = phone;
            if (website) insertData.website = website;
            if (target.id) insertData.neighborhood_id = target.id;

            const { error } = await supabase.from('territory_addresses').insert(insertData);
            if (error) {
              console.error('Insert error:', error.message);
              result.skipped++;
            } else {
              result.inserted++;
            }
          } catch { result.skipped++; }
        }

        // Update neighborhood status
        if (target.id) {
          const { error: upErr } = await supabase.from('neighborhoods').update({
            ingestion_status: result.status === 'success' ? 'complete' : result.status,
            last_ingested_at: new Date().toISOString(),
            ingestion_stats: {
              source: 'google_places',
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
      const searchQueries = typeLabels.map((t: string) => `${t} in ${city}, ${state}`);
      let allPlaces: any[] = [];

      for (const query of searchQueries) {
        try {
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.results) allPlaces.push(...data.results);
        } catch (err) {
          console.error(`Google Places search failed for "${query}":`, err);
        }
      }

      const seen = new Set<string>();
      const unique = allPlaces.filter(p => {
        if (seen.has(p.place_id)) return false;
        seen.add(p.place_id);
        return true;
      });

      totalFound = unique.length;

      for (const place of unique) {
        try {
          const addr = place.formatted_address || place.name;
          const { data: existing } = await supabase
            .from('territory_addresses')
            .select('id')
            .ilike('full_address', `%${addr.substring(0, 30)}%`)
            .limit(1);

          if (existing && existing.length > 0) { totalSkipped++; continue; }

          // Fetch phone number via Place Details
          let phone: string | null = null;
          let website: string | null = null;
          let detailAddress = addr;
          try {
            const detailRes = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=formatted_phone_number,formatted_address,website&key=${GOOGLE_MAPS_API_KEY}`
            );
            const detailData = await detailRes.json();
            if (detailData.status === 'OK') {
              phone = detailData.result.formatted_phone_number || null;
              website = detailData.result.website || null;
              detailAddress = detailData.result.formatted_address || addr;
            }
            await new Promise(r => setTimeout(r, 100));
          } catch (e) {
            console.warn('Place Details fetch failed for', place.name, e);
          }

          const { error } = await supabase.from('territory_addresses').insert({
            store_name: place.name || null,
            full_address: detailAddress,
            city: city,
            state: state,
            latitude: place.geometry?.location?.lat,
            longitude: place.geometry?.location?.lng,
            address_type: (place.types || []).join(', '),
            notes: `Google Places: ${place.name} | Rating: ${place.rating || 'N/A'} | Phone: ${phone || 'N/A'}`,
            discovery_status: 'unknown',
            discovered_by: 'google_places',
            ...(phone ? { phone } : {}),
            ...(website ? { website } : {}),
          });

          if (error) totalSkipped++; else totalInserted++;
        } catch { totalSkipped++; }
      }
    }

    // Determine warnings
    const failedHoods = neighborhoodResults.filter(r => r.status === 'failed');
    let warning: string | undefined;
    if (neighborhoodResults.length > 0 && failedHoods.length === neighborhoodResults.length) {
      warning = 'All neighborhoods failed — Google Places unavailable or rate-limited. Try again later.';
    } else if (failedHoods.length > 0) {
      warning = `${failedHoods.length} neighborhood(s) failed: ${failedHoods.map(h => h.neighborhood).join(', ')}. You can retry just those.`;
    }

    const { error: logError } = await supabase.from('territory_activity_log').insert({
      activity_type: 'ingestion',
      description: `Google Places ingestion: ${totalInserted} new, ${totalSkipped} skipped from ${city}, ${state}`,
      metadata: {
        source: 'google_places',
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
      source: 'google_places',
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
      source: 'google_places',
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
