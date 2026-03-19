import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let jobId: string | undefined;

  try {
    const { job_id, city, state, industry, radius_meters = 40000 } = await req.json();
    jobId = job_id;

    const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY')!;
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!;

    // Update job status
    await supabase
      .from('brandaro_discovery_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job_id);

    // Step 1: Geocode city
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city + ', ' + state)}&key=${googleKey}`
    );
    const geoData = await geoRes.json();
    const location = geoData.results?.[0]?.geometry?.location;
    if (!location) throw new Error(`Could not geocode: ${city}, ${state}`);

    const { lat, lng } = location;

    // Step 2: Text Search for businesses
    const searchQueries = [
      `${industry} in ${city}`,
      `${industry} near ${city}`,
      `${industry} company ${city}`,
      `${industry} service ${city}`,
      `${industry} business ${city}`,
    ];

    let allPlaces: any[] = [];

    for (const query of searchQueries) {
      let nextPageToken: string | null = null;
      let pageCount = 0;

      do {
        const searchUrl = nextPageToken
          ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${nextPageToken}&key=${googleKey}`
          : `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius_meters}&key=${googleKey}`;

        const searchRes = await fetch(searchUrl);
        const searchData = await searchRes.json();
        if (searchData.results) allPlaces = [...allPlaces, ...searchData.results];

        nextPageToken = searchData.next_page_token || null;
        pageCount++;
        if (nextPageToken && pageCount < 3) await new Promise(r => setTimeout(r, 2000));
      } while (nextPageToken && pageCount < 3);

      await new Promise(r => setTimeout(r, 500));
    }

    // Deduplicate by place_id
    const seen = new Set<string>();
    allPlaces = allPlaces.filter(p => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });

    console.log(`Found ${allPlaces.length} total places for ${industry} in ${city}`);

    // Step 3: Get details, filter no-website, import
    let imported = 0;
    let skipped = 0;
    let noWebsiteCount = 0;

    for (const place of allPlaces) {
      try {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,formatted_address,website,rating,user_ratings_total,business_status,address_components,geometry,types&key=${googleKey}`
        );
        const detailData = await detailRes.json();
        const p = detailData.result;
        if (!p) continue;
        if (!p.formatted_phone_number) continue;
        if (p.business_status && p.business_status !== 'OPERATIONAL') continue;

        const hasWebsite = !!(p.website && p.website.trim() !== '' && !p.website.includes('facebook.com'));
        if (hasWebsite) continue;
        noWebsiteCount++;

        const phone = normalizePhone(p.formatted_phone_number);
        if (!phone) continue;

        // Dedup check
        const { data: existing } = await supabase
          .from('brandaro_qualified_leads')
          .select('id')
          .or(`phone_number.eq.${phone},google_place_id.eq.${place.place_id}`)
          .limit(1)
          .maybeSingle();

        if (existing) { skipped++; continue; }

        const addressComps = p.address_components || [];
        const getComp = (type: string) => addressComps.find((c: any) => c.types.includes(type))?.long_name || '';
        const cityName = getComp('locality') || getComp('sublocality') || city;
        const stateName = getComp('administrative_area_level_1');
        const postalCode = getComp('postal_code');
        const streetNum = getComp('street_number');
        const streetName = getComp('route');
        const address = [streetNum, streetName].filter(Boolean).join(' ');

        const score = await scoreLeadWithClaude(anthropicKey, p.name, industry, cityName, p.rating, p.user_ratings_total, p.types);

        await supabase.from('brandaro_qualified_leads').insert({
          business_name: p.name,
          phone_number: phone,
          address: p.formatted_address || address,
          city: cityName,
          state: stateName,
          postal_code: postalCode,
          industry,
          category: (p.types || []).join(', '),
          rating: p.rating ? Math.min(parseFloat(p.rating), 5.0) : null,
          review_count: p.user_ratings_total || 0,
          website: null,
          has_website: false,
          website_status: 'no_website',
          google_place_id: place.place_id,
          google_maps_url: `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          discovery_job_id: job_id,
          pipeline_stage: 'new',
          lead_status: 'new',
          priority_score: score.priority_score,
          engagement_score: 0,
          call_attempts: 0,
          ai_paused: false,
          converted: false,
        });

        imported++;
        await new Promise(r => setTimeout(r, 200));
      } catch (leadErr) {
        console.error('Error processing place:', leadErr);
        continue;
      }
    }

    // Update job completed
    await supabase.from('brandaro_discovery_jobs').update({
      status: 'completed',
      total_found: allPlaces.length,
      no_website_count: noWebsiteCount,
      imported_count: imported,
      skipped_duplicates: skipped,
      completed_at: new Date().toISOString(),
    }).eq('id', job_id);

    return new Response(JSON.stringify({
      success: true, total_found: allPlaces.length,
      no_website_count: noWebsiteCount, imported, skipped,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    console.error('Discovery error:', e);
    if (jobId) {
      await supabase.from('brandaro_discovery_jobs').update({
        status: 'failed', error_message: e.message,
      }).eq('id', jobId);
    }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits[0] === '1') return '+' + digits;
  if (digits.length > 6) return '+' + digits;
  return null;
}

async function scoreLeadWithClaude(
  apiKey: string, businessName: string, industry: string,
  city: string, rating: number, reviewCount: number, types: string[]
): Promise<{ priority_score: number }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 50,
        system: `Score this business lead 1-10 for likelihood to buy a website. Return ONLY a JSON object: {"priority_score": N}. Higher if: established, good reviews, local service. Lower if: chain/franchise, very new, no reviews.`,
        messages: [{ role: 'user', content: `Business: ${businessName}\nIndustry: ${industry}\nCity: ${city}\nRating: ${rating || 'none'}\nReviews: ${reviewCount || 0}\nTypes: ${(types || []).join(', ')}` }],
      }),
    });
    const data = await res.json();
    const result = JSON.parse(data.content[0].text.trim());
    return { priority_score: Math.min(10, Math.max(1, result.priority_score)) };
  } catch {
    return { priority_score: 5 };
  }
}
