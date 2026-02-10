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
    const YELP_API_KEY = Deno.env.get('YELP_API_KEY');
    if (!YELP_API_KEY) {
      return new Response(JSON.stringify({ error: 'YELP_API_KEY not configured. Add it via Settings.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { city, state, country = 'US', business_types = [] } = await req.json();
    if (!city || !state) throw new Error('city and state are required');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const yelpCategories = business_types.length > 0
      ? business_types.map((t: string) => mapToYelpCategory(t)).join(',')
      : 'tobaccoshops,convenience,delis';

    const location = `${city}, ${state}`;
    let allBusinesses: any[] = [];
    let offset = 0;
    const limit = 50;

    // Fetch up to 200 results (4 pages)
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

    // Deduplicate
    const seen = new Set<string>();
    const unique = allBusinesses.filter(b => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    });

    let inserted = 0;
    let skipped = 0;

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

        if (existing && existing.length > 0) { skipped++; continue; }

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

        if (error) skipped++; else inserted++;
      } catch { skipped++; }
    }

    const { error: logError } = await supabase.from('territory_activity_log').insert({
      activity_type: 'ingestion',
      description: `Yelp ingestion: ${inserted} new, ${skipped} skipped from ${city}, ${state}`,
      metadata: { source: 'yelp', city, state, total: unique.length, inserted, skipped },
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
