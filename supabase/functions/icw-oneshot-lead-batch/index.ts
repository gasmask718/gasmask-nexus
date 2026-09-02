// ONE-SHOT: Tier 1 completion batch (Residential Cleaning) into icw_sourced_leads.
// Ports the canonical dedupe + verified-write contract from src/lib/icw/leadIngestion.ts.
// Deleted immediately after a single run.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type Lead = Record<string, unknown>;

const COUNTRY_ALIASES: Record<string, string> = {
  us: 'US', usa: 'US', 'united states': 'US', ca: 'CA', canada: 'CA',
  gb: 'GB', uk: 'GB', 'united kingdom': 'GB', au: 'AU', australia: 'AU',
  ie: 'IE', ireland: 'IE',
};
const normalizeCountry = (raw: unknown): string => {
  const key = String(raw ?? '').toLowerCase().trim();
  return COUNTRY_ALIASES[key] ?? (key ? key.toUpperCase() : 'US');
};
const phoneDedupeKey = (raw: unknown, country: unknown): string | null => {
  if (!raw || typeof raw !== 'string') return null;
  const cc = normalizeCountry(country);
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (cc === 'US' || cc === 'CA') {
    if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
    if (d.length < 10) return null;
    return `${cc}:${d.slice(-10)}`;
  }
  d = d.replace(/^00/, '').replace(/^011/, '');
  const callingCode = cc === 'GB' ? '44' : cc === 'AU' ? '61' : cc === 'IE' ? '353' : '';
  if (callingCode && d.length > callingCode.length + 4 && d.startsWith(callingCode)) d = d.slice(callingCode.length);
  d = d.replace(/^0+/, '');
  return d.length >= (cc === 'GB' ? 9 : cc === 'AU' ? 8 : cc === 'IE' ? 7 : 6) ? `${cc}:${d}` : null;
};
const normText = (raw: unknown): string =>
  String(raw ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const BATCH: Lead[] = [
  {
    full_name: 'House Cleaning Service LLC',
    phone: '908-315-6174',
    city: 'Plainfield',
    state: 'NJ',
    address: 'Plainfield, NJ (serves Central/North/South NJ)',
    category_groups: ['Residential Cleaning'],
    source_platform: 'craigslist',
    source_url:
      'https://www.craigslist.org/view/d/plainfield-house-cleaning-service-llc/9KsKsxQiCXcVUeWH8VfWdY',
    notes: 'Apartments, offices, schools, churches, post-construction',
    status: 'prospect',
  },
  {
    full_name: 'L A House Cleaning Services',
    phone: '818-439-5517',
    address: '1007 W Angeleno Ave Ste E',
    city: 'Burbank',
    state: 'CA',
    postal_code: '91506',
    latitude: 34.171307,
    longitude: -118.317006,
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url: 'https://www.yelp.com/biz/l-a-house-cleaning-services-burbank',
    notes: 'Claimed Yelp business, 4.4 stars/125 reviews',
    status: 'prospect',
  },
  {
    full_name: 'PurEO Pro Clean',
    phone: '346-440-4777',
    city: 'Houston',
    state: 'TX',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url:
      'https://www.yelp.com/search?find_desc=House+Cleaning+Services&find_loc=Houston%2C+TX',
    notes: 'Family-owned, contact Kristin',
    status: 'prospect',
  },
  {
    full_name: 'Clean Casa Miami',
    phone: null,
    city: 'Miami',
    state: 'FL',
    postal_code: '33137',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url: 'https://www.yelp.com/biz/clean-casa-miami-miami',
    notes: 'Claimed, 5.0 stars/4 reviews, minority-owned',
    status: 'prospect',
  },
  {
    full_name: 'Cleanerville Cleaning Service',
    phone: null,
    city: 'Chicago',
    state: 'IL',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url:
      'https://www.yelp.com/search?find_desc=House+Cleaning+Services&find_loc=Chicago%2C+IL',
    notes: 'Women-owned, rates $120-$300',
    status: 'prospect',
  },
  {
    full_name: 'Zita Cleaning Service',
    phone: null,
    city: 'Philadelphia',
    state: 'PA',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url:
      'https://www.yelp.com/search?find_desc=House+Cleaning+Services&find_loc=Philadelphia%2C+PA',
    notes: '30 years in business, insured',
    status: 'prospect',
  },
  {
    full_name: 'Amazon Cleaning',
    phone: null,
    city: 'Atlanta',
    state: 'GA',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url:
      'https://www.yelp.com/search?find_desc=House+Cleaning+Services&find_loc=Atlanta%2C+GA',
    notes: 'Established 2007, eco-friendly',
    status: 'prospect',
  },
  {
    full_name: 'Karla Cleaning Service',
    phone: null,
    city: 'Washington',
    state: 'DC',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url:
      'https://www.yelp.com/search?find_desc=House+Cleaning+Services&find_loc=Washington%2C+DC',
    notes: 'Women-owned, budget-friendly',
    status: 'prospect',
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const results: unknown[] = [];
  try {
    const { data: existingAll, error: readErr } = await supabase
      .from('icw_sourced_leads')
      .select('*')
      .limit(5000);
    if (readErr) throw readErr;
    const pool = [...(existingAll ?? [])] as Record<string, unknown>[];

    for (const input of BATCH) {
      const inputCountry = normalizeCountry(input.country);
      const phoneKey = phoneDedupeKey(input.phone, inputCountry);
      const name = normText(input.full_name);
      const city = normText(input.city);
      const place = normText(input.region || input.state);

      let match: Record<string, unknown> | null = null;
      let reason = '';
      if (phoneKey) {
        const m = pool.find(
          (c) => normalizeCountry(c.country) === inputCountry && phoneDedupeKey(c.phone, c.country) === phoneKey,
        );
        if (m) { match = m; reason = 'phone'; }
      }
      if (!match && name) {
        const m = pool.find(
          (c) =>
            normalizeCountry(c.country) === inputCountry &&
            normText(c.full_name) === name &&
            normText(c.city) === city &&
            normText(c.region || c.state) === place,
        );
        if (m) { match = m; reason = 'name_city_state'; }
      }

      if (match) {
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(input)) {
          if (v === null || v === undefined) continue;
          if (Array.isArray(v) && v.length === 0) continue;
          if (typeof v === 'string' && v.trim() === '') continue;
          if (k === 'status' && match.status !== 'prospect') continue;
          patch[k] = v;
        }
        const { data, error } = await supabase
          .from('icw_sourced_leads')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', match.id as string)
          .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error(`zero rows updated for ${name}`);
        results.push({ name: input.full_name, action: 'updated', reason });
      } else {
        const { data, error } = await supabase
          .from('icw_sourced_leads')
          .insert(input)
          .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error(`zero rows inserted for ${name}`);
        pool.push(data[0]);
        results.push({ name: input.full_name, action: 'inserted', id: data[0].id });
      }
    }

    const { count } = await supabase
      .from('icw_sourced_leads')
      .select('id', { count: 'exact', head: true });

    return new Response(JSON.stringify({ ok: true, results, total: count }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e), results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
