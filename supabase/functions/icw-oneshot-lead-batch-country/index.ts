// TEMPORARY one-shot: ICW country-layer batch (Canada/UK/Australia/Ireland).
// Mirrors src/lib/icw/leadIngestion.ts upsertSourcedLead dedupe semantics.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhoneKey(raw: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length < 10) return null;
  return d.slice(-10);
}
const normText = (r: string | null) => (r ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

type Lead = Record<string, unknown>;

const LEADS: Array<Lead & { _geocode?: string }> = [
  {
    full_name: "Toronto's Best Cleaning Services",
    category_groups: ['Residential Cleaning'],
    country: 'Canada',
    region: 'Ontario',
    city: 'Toronto',
    address: null,
    postal_code: null,
    phone: '877-780-1420',
    source_platform: 'yelp',
    source_url: 'https://www.yelp.ca/biz/torontos-best-cleaning-services-toronto-3',
    notes: 'Toronto, ON (unclaimed Yelp listing, no fixed street address). 4.5 stars/8 reviews, unclaimed listing.',
  },
  {
    full_name: 'Cleaning Express',
    category_groups: ['Residential Cleaning'],
    country: 'United Kingdom',
    region: 'England',
    city: 'London',
    address: '44 Beaufort Court, Admirals Way',
    postal_code: 'E14 9XL',
    phone: '0203 633 0390',
    source_platform: 'business_website',
    source_url: 'https://cleaning-express.com/',
    notes: 'Company site cites 4.9-star Google rating. Precise street address.',
    _geocode: '44 Beaufort Court, Admirals Way, London E14 9XL, United Kingdom',
  },
  {
    full_name: 'Evolutionary Cleaning Services Pty Limited',
    category_groups: ['Residential Cleaning'],
    country: 'Australia',
    region: 'New South Wales',
    city: 'Sydney',
    address: '17 Castlereagh Street',
    postal_code: '2000',
    phone: '0487 766 139',
    source_platform: 'yellow_pages_au',
    source_url: 'https://www.yellowpages.com.au/sydney-nsw-2000/home-cleaning',
    notes: 'Precise street address.',
    _geocode: '17 Castlereagh Street, Sydney NSW 2000, Australia',
  },
  {
    full_name: 'Cleaning Team',
    category_groups: ['Residential Cleaning'],
    country: 'Ireland',
    region: 'Leinster',
    city: 'Dublin',
    address: "77 Sir John Rogerson's Quay, Grand Canal Dock",
    postal_code: 'D02 VK60',
    phone: '01 504 9407',
    source_platform: 'business_website',
    source_url: 'https://cleaningteam.ie/',
    notes: 'Precise street address.',
    _geocode: "77 Sir John Rogerson's Quay, Grand Canal Dock, Dublin 2, D02 VK60, Ireland",
  },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const token = Deno.env.get('MAPBOX_PUBLIC_TOKEN');

    const { data: existing, error: exErr } = await supabase
      .from('icw_sourced_leads')
      .select('*')
      .limit(5000);
    if (exErr) throw exErr;
    const rows = existing ?? [];

    const report: unknown[] = [];
    let inserted = 0, duplicates = 0, mapped = 0, gaps = 0;

    for (const raw of LEADS) {
      const { _geocode, ...lead } = raw;
      const phoneKey = normalizePhoneKey(lead.phone as string);
      const name = normText(lead.full_name as string);

      let match: Record<string, unknown> | undefined;
      let reason = '';
      if (lead.source_url) {
        match = rows.find((r) => r.source_url === lead.source_url && r.source_platform === lead.source_platform);
        if (match) reason = 'source_url';
      }
      if (!match && phoneKey) {
        match = rows.find((r) => normalizePhoneKey(r.phone) === phoneKey);
        if (match) reason = 'phone';
      }
      if (!match && name) {
        match = rows.find((r) => normText(r.full_name) === name && normText(r.city) === normText(lead.city as string));
        if (match) reason = 'name_city';
      }

      if (match) {
        duplicates++;
        report.push({ name: lead.full_name, action: 'skipped_duplicate', reason });
        continue;
      }

      if (_geocode && token) {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(_geocode)}.json?limit=1&access_token=${token}`;
        const res = await fetch(url);
        if (res.ok) {
          const j = await res.json();
          const c = j?.features?.[0]?.center;
          const type = j?.features?.[0]?.place_type?.[0];
          if (Array.isArray(c) && (type === 'address' || type === 'poi')) {
            lead.longitude = c[0];
            lead.latitude = c[1];
          }
        }
      }
      if (lead.latitude) mapped++; else gaps++;

      const { data: ins, error } = await supabase
        .from('icw_sourced_leads')
        .insert(lead)
        .select('id, full_name, latitude, longitude, country, region');
      if (error) throw error;
      inserted++;
      report.push({ action: 'inserted', row: ins?.[0] });
    }

    const { count } = await supabase
      .from('icw_sourced_leads')
      .select('*', { count: 'exact', head: true });

    return new Response(
      JSON.stringify({ inserted, duplicates, mapped, mapping_gaps: gaps, total_rows: count, report }, null, 2),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
