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

    const googleKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    console.log('JOB STARTED:', job_id, city, state, industry, radius_meters);
    console.log('GOOGLE KEY EXISTS:', !!googleKey);
    console.log('ANTHROPIC KEY EXISTS:', !!anthropicKey);

    if (!googleKey) throw new Error('GOOGLE_PLACES_API_KEY secret is not configured');

    // Test the API key works at all
    const testUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=restaurant+Miami&key=${googleKey}`;
    const testRes = await fetch(testUrl);
    const testData = await testRes.json();
    console.log('API KEY TEST:', testData.status, 'results:', testData.results?.length || 0);

    if (testData.status === 'REQUEST_DENIED') {
      const errMsg = 'Google Places API is not enabled for your API key. Go to Google Cloud Console → APIs & Services → Library → search "Places API" (NOT "Places API New") → click Enable. Then wait 2-3 minutes and try again.';
      console.error('PLACES API DENIED:', testData.error_message);
      if (jobId) {
        await supabase.from('brandaro_discovery_jobs').update({ status: 'failed', error_message: errMsg }).eq('id', jobId);
      }
      return new Response(JSON.stringify({ error: errMsg, fix: 'Enable "Places API" in Google Cloud Console' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
    console.log('GEOCODE STATUS:', geoData.status);

    if (geoData.status === 'REQUEST_DENIED' || geoData.status === 'INVALID_REQUEST') {
      throw new Error(`Google API error: ${geoData.status} — ${geoData.error_message || 'check API key'}`);
    }

    const location = geoData.results?.[0]?.geometry?.location;
    if (!location) throw new Error(`Could not geocode: ${city}, ${state}`);

    const { lat, lng } = location;
    console.log('GEOCODED:', lat, lng);

    // Step 2: Text Search — plain text query (no location/radius for primary)
    const searchQueries = [
      `${industry} in ${city} ${state}`,
      `${industry} near ${city} ${state}`,
    ];

    let allPlaces: any[] = [];

    for (const query of searchQueries) {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleKey}`;
      const searchRes = await fetch(searchUrl);
      const rawText = await searchRes.text();
      console.log(`RAW SEARCH "${query}":`, rawText.substring(0, 1000));
      const searchData = JSON.parse(rawText);

      console.log(`SEARCH "${query}": status=${searchData.status}, results=${searchData.results?.length || 0}`);

      if (searchData.status === 'REQUEST_DENIED') {
        console.log('PLACES API DENIED — error:', searchData.error_message || 'Places API not enabled for this key');
      }

      if (searchData.results) allPlaces = [...allPlaces, ...searchData.results];
      await new Promise(r => setTimeout(r, 300));
    }

    // Fallback queries with location/radius if primary returned nothing
    if (allPlaces.length === 0) {
      console.log('PRIMARY QUERIES RETURNED 0 — trying fallback with location/radius');
      const fallbackQueries = [
        `${industry} ${city}`,
        `${industry}`,
      ];
      for (const query of fallbackQueries) {
        const backupUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=50000&key=${googleKey}`;
        const searchRes = await fetch(backupUrl);
        const rawText = await searchRes.text();
        console.log(`RAW FALLBACK "${query}":`, rawText.substring(0, 1000));
        const searchData = JSON.parse(rawText);
        console.log(`FALLBACK SEARCH "${query}": status=${searchData.status}, results=${searchData.results?.length || 0}`);
        if (searchData.results) allPlaces = [...allPlaces, ...searchData.results];
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // Deduplicate by place_id
    const seen = new Set<string>();
    allPlaces = allPlaces.filter(p => {
      if (seen.has(p.place_id)) return false;
      seen.add(p.place_id);
      return true;
    });

    // Hard limit
    allPlaces = allPlaces.slice(0, 40);

    console.log(`AFTER DEDUP+LIMIT: ${allPlaces.length} places to process`);

    // Log sample places
    for (const place of allPlaces.slice(0, 5)) {
      console.log('SAMPLE PLACE:', JSON.stringify({
        name: place.name,
        place_id: place.place_id,
        types: place.types,
      }));
    }

    // Step 3: Get details for each place, filter no-website, import
    let imported = 0;
    let skipped = 0;
    let noWebsiteCount = 0;

    for (const place of allPlaces) {
      try {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_phone_number,formatted_address,website,rating,user_ratings_total,business_status,address_components,types&key=${googleKey}`
        );
        const detailData = await detailRes.json();
        const p = detailData.result;
        if (!p) continue;
        if (p.business_status && p.business_status !== 'OPERATIONAL') continue;

        // Relaxed website filter — social media pages don't count as real websites
        const websiteUrl = (p.website || '').trim().toLowerCase();
        const hasRealWebsite = websiteUrl !== ''
          && !websiteUrl.includes('facebook.com')
          && !websiteUrl.includes('fb.com')
          && !websiteUrl.includes('instagram.com')
          && !websiteUrl.includes('yelp.com')
          && !websiteUrl.includes('yellowpages.com')
          && !websiteUrl.includes('google.com')
          && !websiteUrl.includes('maps.google')
          && !websiteUrl.includes('goo.gl');

        console.log(`DETAIL: ${p.name} | website: "${p.website || 'none'}" | phone: "${p.formatted_phone_number || 'none'}" | status: ${p.business_status}`);

        if (hasRealWebsite) {
          console.log(`SKIP (has real website): ${p.name} → ${websiteUrl}`);
          continue;
        }
        noWebsiteCount++;

        // Phone is optional — still import without it
        const rawPhone = p.formatted_phone_number || '';
        const phone = rawPhone ? normalizePhone(rawPhone) : null;
        // Don't skip if no phone — still import the lead

        // Dedup check
        if (phone) {
          const { data: existing } = await supabase
            .from('brandaro_qualified_leads')
            .select('id')
            .or(`phone_number.eq.${phone},google_place_id.eq.${place.place_id}`)
            .limit(1)
            .maybeSingle();
          if (existing) { skipped++; continue; }
        } else {
          const { data: existing } = await supabase
            .from('brandaro_qualified_leads')
            .select('id')
            .eq('google_place_id', place.place_id)
            .limit(1)
            .maybeSingle();
          if (existing) { skipped++; continue; }
        }

        const addressComps = p.address_components || [];
        const getComp = (type: string) => addressComps.find((c: any) => c.types.includes(type))?.long_name || '';
        const cityName = getComp('locality') || getComp('sublocality') || city;
        const stateName = getComp('administrative_area_level_1') || state;
        const postalCode = getComp('postal_code');
        const streetNum = getComp('street_number');
        const streetName = getComp('route');
        const address = [streetNum, streetName].filter(Boolean).join(' ');

        // Score with Claude (or fallback)
        const score = anthropicKey
          ? await scoreLeadWithClaude(anthropicKey, p.name, industry, cityName, p.rating, p.user_ratings_total, p.types)
          : { priority_score: 5 };

        console.log('[DISCOVERY] Attempting insert:', {
          business_name: p.name,
          phone: phone,
          city: cityName,
          industry: industry,
          job_id: job_id,
        });

        const { data: insertedLead, error: insertErr } = await supabase.from('brandaro_qualified_leads').insert({
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
        }).select('id, business_name').single();

        if (insertErr) {
          console.error('[DISCOVERY] INSERT FAILED:', {
            error: insertErr.message,
            code: insertErr.code,
            details: insertErr.details,
            hint: insertErr.hint,
            business: p.name,
          });
          continue;
        }

        console.log('[DISCOVERY] INSERT SUCCESS:', insertedLead?.business_name, insertedLead?.id);

        // Wire into pipeline automator
        if (insertedLead?.id) {
          try {
            await supabase.functions.invoke("brandaro-pipeline-automator", {
              body: { action: "record_event", lead_id: insertedLead.id, event_type: "lead_imported" },
            });
          } catch {
            // Non-blocking — lead is already saved
          }
        }

        imported++;
        console.log(`IMPORTED: ${p.name} (score: ${score.priority_score})`);
        await new Promise(r => setTimeout(r, 150));
      } catch (leadErr) {
        console.error('Error processing place:', (leadErr as Error).message);
        continue;
      }
    }

    console.log(`JOB COMPLETE: found=${allPlaces.length}, noWebsite=${noWebsiteCount}, imported=${imported}, skipped=${skipped}`);

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
    console.error('Discovery error:', e.message);
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