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
    full_name: 'Chic Cleaning Services',
    phone: '740-953-3891',
    address: 'Serving Columbus and the Surrounding Area, OH',
    city: 'Columbus',
    state: 'OH',
    country: 'US',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url: 'https://www.yelp.com/biz/chic-cleaning-services-columbus-2',
    notes: 'Service-area business, no confirmed street address — mapping gap, do not fabricate coordinates',
    status: 'prospect',
  },
  {
    full_name: 'RHR Cleaning Services',
    phone: '614-383-7260',
    address: 'Serving Columbus and Central Ohio',
    city: 'Columbus',
    state: 'OH',
    country: 'US',
    category_groups: ['Residential Cleaning'],
    source_platform: 'business_website',
    source_url: 'https://rhrcleaningservices.com/',
    notes: 'Service-area business, no confirmed street address — mapping gap',
    status: 'prospect',
  },
  {
    full_name: 'Columbus Cleaning Service',
    phone: '614-412-2960',
    address: 'Serving Columbus, Bexley, Upper Arlington, Worthington, Dublin, Hilliard, Westerville',
    city: 'Columbus',
    state: 'OH',
    country: 'US',
    category_groups: ['Residential Cleaning'],
    source_platform: 'business_website',
    source_url: 'https://www.columbuscleaningservice.com/',
    notes: 'Service-area business, no confirmed street address — mapping gap',
    status: 'prospect',
  },
  {
    full_name: 'Mayra Cleaning Services',
    phone: '602-465-7479',
    address: 'Serving Phoenix and the Surrounding Area, AZ',
    city: 'Phoenix',
    state: 'AZ',
    country: 'US',
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url: 'https://www.yelp.com/biz/mayra-cleaning-services-phoenix',
    notes: 'Service-area business, no confirmed street address — mapping gap',
    status: 'prospect',
  },
  {
    full_name: 'Green Maids of Detroit',
    phone: '313-636-1233',
    address: '1420 Washington Blvd, Detroit, MI 48226',
    city: 'Detroit',
    state: 'MI',
    postal_code: '48226',
    country: 'US',
    latitude: 42.3340541,
    longitude: -83.0504472,
    category_groups: ['Residential Cleaning'],
    source_platform: 'business_website',
    source_url: 'https://www.greenmaidsofdetroit.com/contact',
    notes: 'Precise street address — geocoded via OpenStreetMap Nominatim 2026-09-03 (42.3340541, -83.0504472)',
    status: 'prospect',
  },
  {
    full_name: 'Janus Clean',
    phone: '267-609-5395',
    address: '21 S 11th St #530, Philadelphia, PA 19107',
    city: 'Philadelphia',
    state: 'PA',
    postal_code: '19107',
    country: 'US',
    latitude: 39.9508722,
    longitude: -75.1582693,
    category_groups: ['Residential Cleaning'],
    source_platform: 'business_website',
    source_url: 'https://janusclean.com/',
    notes: 'Precise street address — geocoded via OpenStreetMap Nominatim 2026-09-03 (39.9508722, -75.1582693)',
    status: 'prospect',
  },
  {
    full_name: 'Hello Housekeeping',
    phone: null,
    address: '1916 Dorchester Ave, Boston, MA 02124',
    city: 'Boston',
    state: 'MA',
    postal_code: '02124',
    country: 'US',
    latitude: 42.2839704,
    longitude: -71.0646496,
    category_groups: ['Residential Cleaning'],
    source_platform: 'yelp',
    source_url: 'https://www.yelp.com/biz/hello-housekeeping-boston-2',
    notes: 'Precise street address — geocoded via OpenStreetMap Nominatim 2026-09-03 (42.2839704, -71.0646496). No phone available from this source.',
    status: 'prospect',
  },
];

// ── Registered / legal address vs verified operating location ──────────────
// Mirrors src/lib/icw/leadIngestion.ts. A company-registry address is a LEGAL
// address: no map pin, mapping-gap treatment, note stamped, unless a SECOND
// reliable source confirms operations there (`operating_confirmed_by`).
const REGISTERED_ADDRESS_ONLY_MARKER = 'REGISTERED-ADDRESS-ONLY';
const REGISTRY_SOURCE_PLATFORMS = new Set([
  'companies_house', 'companies-house', 'uk_companies_house', 'cro', 'cro_ie', 'irish_cro',
  'asic', 'abr', 'corporations_canada', 'ontario_business_registry', 'opencorporates',
  'sos_business_registry', 'secretary_of_state', 'state_business_registry',
]);

const isRegisteredAddressOnly = (input: Lead): boolean => {
  if (input.operating_confirmed_by) return false;
  if (input.registry_registered_office === true) return true;
  const platform = String(input.source_platform ?? '').toLowerCase().trim().replace(/\s+/g, '_');
  if (platform && REGISTRY_SOURCE_PLATFORMS.has(platform)) return true;
  return /registered\s+(office|address)/i.test(String(input.notes ?? ''));
};

/** Strips ingest-only meta keys and forces mapping-gap treatment when required. */
const prepareLead = (input: Lead): { row: Lead; registeredAddressOnly: boolean } => {
  const { registry_registered_office: _r, operating_confirmed_by: _o, ...rest } = input;
  const row = { ...rest } as Lead;
  const registeredAddressOnly = isRegisteredAddressOnly(input);
  if (registeredAddressOnly) {
    row.latitude = null;
    row.longitude = null;
    const note = String(row.notes ?? '');
    row.notes = note.includes(REGISTERED_ADDRESS_ONLY_MARKER)
      ? note
      : [
          `${REGISTERED_ADDRESS_ONLY_MARKER}: address is a company-registry registered/legal office, not a confirmed operating location. No map pin until a second reliable source confirms operations at this address.`,
          note,
        ].filter(Boolean).join(' | ');
  }
  return { row, registeredAddressOnly };
};

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
    // Ids inserted by THIS run — a later match against one of these is a
    // same-run self-match (a fresh insert), never a pre-existing duplicate.
    const insertedThisRun = new Set<string>();

    let newLeadCount = 0;
    let sameRunSelfMatchCount = 0;
    let preExistingDuplicateCount = 0;
    let registeredAddressOnlyCount = 0;

    for (const rawInput of BATCH) {
      const { row: input, registeredAddressOnly } = prepareLead(rawInput);
      if (registeredAddressOnly) registeredAddressOnlyCount++;

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
        if (registeredAddressOnly) { patch.latitude = null; patch.longitude = null; }
        const { data, error } = await supabase
          .from('icw_sourced_leads')
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq('id', match.id as string)
          .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error(`zero rows updated for ${name}`);

        const selfMatch = insertedThisRun.has(String(match.id));
        if (selfMatch) sameRunSelfMatchCount++; else preExistingDuplicateCount++;
        results.push({
          name: input.full_name,
          outcome: selfMatch ? 'same_run_self_match' : 'duplicate_preexisting',
          counts_as: selfMatch ? 'fresh insert' : 'duplicate',
          reason,
          registered_address_only: registeredAddressOnly,
        });
      } else {
        const { data, error } = await supabase
          .from('icw_sourced_leads')
          .insert(input)
          .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error(`zero rows inserted for ${name}`);
        pool.push(data[0]);
        insertedThisRun.add(String(data[0].id));
        newLeadCount++;
        results.push({
          name: input.full_name,
          outcome: 'inserted',
          counts_as: 'fresh insert',
          id: data[0].id,
          registered_address_only: registeredAddressOnly,
        });
      }
    }

    const { count } = await supabase
      .from('icw_sourced_leads')
      .select('id', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({
        ok: true,
        summary: {
          new_inserts: newLeadCount,
          same_run_self_matches: sameRunSelfMatchCount,
          pre_existing_duplicates: preExistingDuplicateCount,
          net_new_rows: newLeadCount + sameRunSelfMatchCount,
          registered_address_only: registeredAddressOnlyCount,
          leads_submitted: BATCH.length,
        },
        results,
        total: count,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e), results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

