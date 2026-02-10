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
    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: 'GOOGLE_MAPS_API_KEY not configured. Add it via Settings.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { city, state, country = 'US', business_types = [] } = await req.json();
    if (!city || !state) throw new Error('city and state are required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const searchQueries = business_types.length > 0
      ? business_types.map((t: string) => `${t.replace(/_/g, ' ')} in ${city}, ${state}`)
      : [`smoke shop in ${city}, ${state}`, `convenience store in ${city}, ${state}`];

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

    // Deduplicate by place_id
    const seen = new Set<string>();
    const unique = allPlaces.filter(p => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });

    let inserted = 0;
    let skipped = 0;

    for (const place of unique) {
      try {
        const addr = place.formatted_address || place.name;
        const { data: existing } = await supabase
          .from('territory_addresses')
          .select('id')
          .ilike('full_address', `%${addr.substring(0, 30)}%`)
          .limit(1);

        if (existing && existing.length > 0) { skipped++; continue; }

        const { error } = await supabase.from('territory_addresses').insert({
          full_address: addr,
          city: city,
          state: state,
          latitude: place.geometry?.location?.lat,
          longitude: place.geometry?.location?.lng,
          address_type: (place.types || []).join(', '),
          notes: `Google Places: ${place.name} | Rating: ${place.rating || 'N/A'}`,
          discovery_status: 'unknown',
          discovered_by: 'google_places',
        });

        if (error) skipped++; else inserted++;
      } catch { skipped++; }
    }

    const { error: logError } = await supabase.from('territory_activity_log').insert({
      activity_type: 'ingestion',
      description: `Google Places ingestion: ${inserted} new, ${skipped} skipped from ${city}, ${state}`,
      metadata: { source: 'google_places', city, state, total: unique.length, inserted, skipped },
    });
    if (logError) console.warn('Activity log write failed:', logError.message);

    return new Response(JSON.stringify({ total: unique.length, inserted, skipped, duplicates: skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
