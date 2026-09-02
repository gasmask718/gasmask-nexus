// TEMPORARY one-shot: ICW Tier 2 Residential Cleaning batch.
// Mirrors src/lib/icw/leadIngestion.ts dedupe + upsert contract exactly.
// Deleted immediately after a single successful run.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizePhoneKey = (raw: string | null | undefined) => {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length < 10) return null;
  return d.slice(-10);
};
const normText = (raw: string | null | undefined) =>
  (raw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normLicense = (raw: string | null | undefined) => {
  if (!raw) return null;
  const v = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return v.length ? v : null;
};

const BATCH = [
  { full_name: 'Housekeeping of Charlotte', phone: '908-320-7998', city: 'Charlotte', state: 'NC', source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/housekeeping-of-charlotte-charlotte-2', notes: 'Claimed, offers deep/maid/move-in-out/regular home cleaning. Service area, no fixed address.' },
  { full_name: 'Chic Cleaning Services', phone: '740-953-3891', city: 'Columbus', state: 'OH', source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/chic-cleaning-services-columbus-2', notes: '5.0 stars/19 reviews, residential and commercial. Serving Columbus, OH and surrounding area.' },
  { full_name: 'Maid Easy', phone: '480-719-6991', address: '4742 N 24th St Ste 300-45', city: 'Phoenix', state: 'AZ', postal_code: '85016', latitude: 33.507079, longitude: -112.030701, source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/maid-easy-phoenix-house-cleaning-service-phoenix', notes: '215 reviews. Precise street address, geocoded (Mapbox, rooftop-level address match).' },
  { full_name: "Silvana's House Cleaning", phone: '617-970-9317', city: 'Boston', state: 'MA', source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/silvanas-house-cleaning-boston-2', notes: '269 reviews, Yelp Guaranteed. Service area, no fixed address.' },
  { full_name: 'AM Cleaning Services', phone: '804-687-2767', address: '7633 Hull Street Rd Ste 200', city: 'Richmond', state: 'VA', postal_code: '23235', latitude: 37.467041, longitude: -77.534113, source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/am-cleaning-services-richmond-8', notes: 'Primarily commercial but lists Home Cleaning as an offered service. Precise street address, geocoded (Mapbox).' },
  { full_name: 'Spotless House Cleaning Services', phone: '206-909-6870', address: '1619 E John St', city: 'Seattle', state: 'WA', postal_code: '98112', latitude: 47.619538, longitude: -122.31059, source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/spotless-house-cleaning-services-seattle-2', notes: 'Claimed, 4.7 stars/13 reviews. Precise street address, geocoded (Mapbox).' },
  { full_name: 'FreshSpace Cleaning Detroit', phone: '313-351-8501', city: 'Detroit', state: 'MI', source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/freshspace-cleaning-detroit-detroit', notes: 'Claimed, 2.3 stars/6 reviews. Service area, no fixed address.' },
  { full_name: 'Home Cleaners of Baltimore', phone: '410-803-6204', city: 'Baltimore', state: 'MD', source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/home-cleaners-of-baltimore-baltimore', notes: 'Claimed, 3.3 stars/3 reviews. Service area, no fixed address.' },
  { full_name: '5280 House Cleaning', phone: '303-615-5280', address: '1417 Gaylord St', city: 'Denver', state: 'CO', postal_code: '80206', latitude: 39.738787, longitude: -104.961339, source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/5280-house-cleaning-denver', notes: '235 reviews. Precise street address, geocoded (Mapbox).' },
  { full_name: 'Sparkly House Cleaning', phone: '615-208-4271', address: '320 11th Ave', city: 'Nashville', state: 'TN', postal_code: '37203', latitude: 36.15345, longitude: -86.783267, source_platform: 'yelp', source_url: 'https://www.yelp.com/biz/sparkly-house-cleaning-nashville', notes: '54 reviews, offers home cleaning. Precise street address, geocoded (Mapbox).' },
].map((l) => ({ ...l, category_groups: ['Residential Cleaning'], status: 'prospect' }));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: unknown[] = [];
  let inserted = 0;
  let updated = 0;

  for (const input of BATCH) {
    const { data: candidates, error: cErr } = await supabase
      .from('icw_sourced_leads')
      .select('*')
      .limit(5000);
    if (cErr) return new Response(JSON.stringify({ error: cErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const license = normLicense((input as Record<string, string>).license_number);
    const phoneKey = normalizePhoneKey(input.phone);
    const name = normText(input.full_name);
    const city = normText(input.city);
    const state = normText(input.state);

    let match: { id: string; status: string } | null = null;
    let reason = '';
    const rows = (candidates ?? []) as Record<string, string>[];

    if (!license) {
      const bySource = rows.find((c) => c.source_url && c.source_url === input.source_url);
      if (bySource) { match = bySource as never; reason = 'source_url'; }
    }
    if (!match && phoneKey) {
      const byPhone = rows.find((c) => normalizePhoneKey(c.phone) === phoneKey);
      if (byPhone) { match = byPhone as never; reason = 'phone'; }
    }
    if (!match && name && (city || state)) {
      const byName = rows.find(
        (c) => normText(c.full_name) === name && normText(c.city) === city && normText(c.state) === state,
      );
      if (byName) { match = byName as never; reason = 'name_city_state'; }
    }

    if (match) {
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        if (v === null || v === undefined) continue;
        if (Array.isArray(v) && v.length === 0) continue;
        if (typeof v === 'string' && v.trim() === '') continue;
        if (k === 'status' && match!.status !== 'prospect') continue;
        patch[k] = v;
      }
      const { data, error } = await supabase
        .from('icw_sourced_leads')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', match.id)
        .select();
      if (error || !data?.length) return new Response(JSON.stringify({ error: error?.message ?? 'update verified 0 rows', at: input.full_name }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      updated++;
      results.push({ name: input.full_name, action: 'duplicate_updated', reason, id: data[0].id });
    } else {
      const { data, error } = await supabase.from('icw_sourced_leads').insert(input).select();
      if (error || !data?.length) return new Response(JSON.stringify({ error: error?.message ?? 'insert verified 0 rows', at: input.full_name }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      inserted++;
      results.push({ name: input.full_name, action: 'inserted', id: data[0].id });
    }
  }

  const { count } = await supabase.from('icw_sourced_leads').select('*', { count: 'exact', head: true });

  return new Response(JSON.stringify({ inserted, updated, total: count, results }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
