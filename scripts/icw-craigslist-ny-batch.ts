// One-shot controlled sourcing batch: NY Residential Cleaning, craigslist.
// Uses the REAL dedupe helpers exported by src/lib/icw/leadIngestion.ts
// (same match order: license -> source_id -> phone -> name+city/state).
// No geocoding: leads without a precise street address get null lat/long.
import { execFileSync } from 'node:child_process';
import { normalizePhoneKey, normText, normLicense } from '@/lib/icw/leadIngestion';

const q = (sql: string) => execFileSync('psql', ['-At', '-F', '\u0001', '-c', sql], { encoding: 'utf8' });

type Row = { id: string; full_name: string; phone: string; license_number: string; address: string; city: string; state: string; source_platform: string; source_id: string };
const load = (): Row[] =>
  q(`select id,coalesce(full_name,''),coalesce(phone,''),coalesce(license_number,''),coalesce(address,''),coalesce(city,''),coalesce(state,''),coalesce(source_platform,''),coalesce(source_id,'') from icw_sourced_leads`)
    .trim().split('\n').filter(Boolean)
    .map((l) => { const [id, full_name, phone, license_number, address, city, state, source_platform, source_id] = l.split('\u0001'); return { id, full_name, phone, license_number, address, city, state, source_platform, source_id }; });

function findExisting(rows: Row[], input: any) {
  const license = normLicense(input.license_number);
  const phoneKey = normalizePhoneKey(input.phone);
  const name = normText(input.full_name);
  const addr = normText(input.address);
  const city = normText(input.city);
  const state = normText(input.state);
  const isRegulated = Boolean(license);
  if (isRegulated) { const m = rows.find((c) => normLicense(c.license_number) === license); if (m) return { m, reason: 'license_number' }; }
  else if (input.source_id && input.source_platform) { const m = rows.find((c) => c.source_id === input.source_id && c.source_platform === input.source_platform); if (m) return { m, reason: 'source_id' }; }
  if (phoneKey) { const m = rows.find((c) => normalizePhoneKey(c.phone) === phoneKey); if (m) return { m, reason: 'phone' }; }
  if (name) {
    if (isRegulated && addr) { const m = rows.find((c) => normText(c.full_name) === name && normText(c.address) === addr); if (m) return { m, reason: 'name_address' }; }
    if (!isRegulated && (city || state)) { const m = rows.find((c) => normText(c.full_name) === name && normText(c.city) === city && normText(c.state) === state); if (m) return { m, reason: 'name_city_state' }; }
  }
  return null;
}

const lit = (v: any) => (v === undefined || v === null ? 'null' : typeof v === 'number' ? String(v) : Array.isArray(v) ? `'{${v.map((x) => `"${String(x).replace(/"/g, '\\"')}"`).join(',')}}'` : `'${String(v).replace(/'/g, "''")}'`);

const CL = 'https://www.craigslist.org/view/d/';
const batch = [
  { full_name: 'Richard — Apartment Cleaning', phone: '984-289-3658', city: 'Upper East Side, Manhattan', state: 'NY', category_groups: ['Residential Cleaning'], source_platform: 'craigslist', source_url: `${CL}new-york-apartment-cleaning-by-richard/q6PX322TB5xq53GWVQLyDH`, notes: '$40/hr, references available', status: 'prospect' },
  { full_name: 'CleanliYes LLC', phone: null, city: 'Brooklyn', state: 'NY', category_groups: ['Residential Cleaning'], source_platform: 'craigslist', source_url: `${CL}brooklyn-professional-apartment/haSxR1bfScUu8zFdQMxc6N`, notes: 'Weekly & biweekly service. Service area: Downtown Brooklyn/Brooklyn Heights/DUMBO/Fort Greene/Clinton Hill/Park Slope/Prospect Heights/Williamsburg/Greenpoint/Boerum Hill', status: 'prospect' },
  { full_name: 'Polish Cleaning Lady — Staten Island', phone: '646-472-9644', city: 'Staten Island', state: 'NY', category_groups: ['Residential Cleaning'], source_platform: 'craigslist', source_url: `${CL}staten-island-polish-cleaning-lady-in/o9oXtrtdGpnrVhaurZV2qk`, notes: 'Experienced, references', status: 'prospect' },
  { full_name: 'Cleaning Lady at Your Service', phone: null, city: 'Manhattan', state: 'NY', category_groups: ['Residential Cleaning'], source_platform: 'craigslist', source_url: `${CL}new-york-cleaning-lady-at-your-service/73zY2L1X32YybxrtwowkGN`, notes: 'College student, part-time, experience with elderly/physically ill clients. Also serves Bronx and Queens', status: 'prospect' },
  { full_name: 'Sunflower Cleaning Services NY', phone: '425-591-5030', city: 'Jackson Heights, Queens', state: 'NY', category_groups: ['Residential Cleaning'], source_platform: 'craigslist', source_url: `${CL}jackson-heights-50hr-cleaning-services/5kkPhY5M8KDiMA2dDV7Qfy`, notes: 'Airbnb, deep clean, commercial, move-in/out; $50/hr one cleaner, $100/hr two. Serves all 5 boroughs', status: 'prospect' },
];

for (const input of batch) {
  const rows = load();
  const hit = findExisting(rows, input);
  if (hit) { console.log(`DUPLICATE  reason=${hit.reason}  canonical=${hit.m.id}  "${input.full_name}"`); continue; }
  const cols = Object.keys(input).filter((c) => (input as any)[c] !== null);
  const id = q(`insert into icw_sourced_leads (${cols.join(',')}) values (${cols.map((c) => lit((input as any)[c])).join(',')}) returning id`).trim();
  console.log(`INSERTED   ${id}  "${input.full_name}"`);
}
