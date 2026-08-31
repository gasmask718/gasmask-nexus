// Harness: exercises the REAL dedupe comparison helpers from src/lib/icw/leadIngestion.ts
// against the live table via psql (no browser session available in the sandbox).
import { execFileSync } from 'node:child_process';
import { normalizePhoneKey, normText, normLicense } from '@/lib/icw/leadIngestion';

const q = (sql: string) => execFileSync('psql', ['-At', '-F', '\u0001', '-c', sql], { encoding: 'utf8' });

type Row = { id: string; full_name: string; phone: string; license_number: string; address: string; city: string; state: string };
const load = (): Row[] =>
  q(`select id,coalesce(full_name,''),coalesce(phone,''),coalesce(license_number,''),coalesce(address,''),coalesce(city,''),coalesce(state,'') from icw_sourced_leads`)
    .trim().split('\n').filter(Boolean)
    .map((l) => { const [id, full_name, phone, license_number, address, city, state] = l.split('\u0001'); return { id, full_name, phone, license_number, address, city, state }; });

export function findExisting(rows: Row[], input: any) {
  const license = normLicense(input.license_number);
  const phoneKey = normalizePhoneKey(input.phone);
  const name = normText(input.full_name);
  const addr = normText(input.address);
  const city = normText(input.city);
  const state = normText(input.state);
  if (license) { const m = rows.find((c) => normLicense(c.license_number) === license); if (m) return { m, reason: 'license_number' }; }
  if (phoneKey) { const m = rows.find((c) => normalizePhoneKey(c.phone) === phoneKey); if (m) return { m, reason: 'phone' }; }
  if (name) {
    if (license && addr) { const m = rows.find((c) => normText(c.full_name) === name && normText(c.address) === addr); if (m) return { m, reason: 'name_address' }; }
    if (!license && (city || state)) { const m = rows.find((c) => normText(c.full_name) === name && normText(c.city) === city && normText(c.state) === state); if (m) return { m, reason: 'name_city_state' }; }
  }
  return null;
}

const lit = (v: any) => (v === undefined || v === null ? 'null' : typeof v === 'number' ? String(v) : Array.isArray(v) ? `'{${v.map((x) => `"${x}"`).join(',')}}'` : `'${String(v).replace(/'/g, "''")}'`);

const batch = [
  { full_name: 'TEST SEED — Marisol Vega Floor Care', phone: '(305) 555-0142', license_number: 'FL-FLR-99001', address: '1420 NW 7th St', city: 'Miami', state: 'FL', postal_code: '33125', latitude: 25.7796, longitude: -80.2210, category_groups: ['Floors'], source_platform: 'test_seed', status: 'prospect' },
  { full_name: 'TEST SEED — Dana Okafor Reorg Studio', phone: '(718) 555-0199', address: '88 Nostrand Ave', city: 'Brooklyn', state: 'NY', postal_code: '11205', latitude: 40.6944, longitude: -73.9506, category_groups: ['Professional Reorganizer'], source_platform: 'test_seed', status: 'prospect' },
  { full_name: 'TEST SEED — Bright Path Cleaning', phone: '(404) 555-0177', address: '905 Peachtree St NE', city: 'Atlanta', state: 'GA', postal_code: '30309', latitude: 33.7815, longitude: -84.3831, category_groups: ['Cleaning', 'Mobile Wash'], source_platform: 'test_seed', status: 'qualified' },
  { full_name: 'TEST SEED — Duplicate Dupe Candidate', phone: '(213) 555-0123', address: '700 S Flower St', city: 'Los Angeles', state: 'CA', postal_code: '90017', latitude: 34.0466, longitude: -118.2586, category_groups: ['Handyman'], source_platform: 'test_seed', status: 'prospect' },
  { full_name: 'TEST SEED — Duplicate Dupe Candidate', phone: '213-555-0123', address: '700 South Flower Street', city: 'Los Angeles', state: 'CA', postal_code: '90017', latitude: 34.0467, longitude: -118.2588, category_groups: ['Handyman', 'Moving'], source_platform: 'test_seed', status: 'prospect' },
];

const dry = process.argv.includes('--dry');
for (const input of batch) {
  const rows = load();
  const hit = findExisting(rows, input);
  if (hit) { console.log(`DUPLICATE  reason=${hit.reason}  canonical=${hit.m.id}  "${input.full_name}" ${input.phone}`); continue; }
  if (dry) { console.log(`WOULD INSERT  "${input.full_name}" ${input.phone}`); continue; }
  const cols = Object.keys(input);
  const id = q(`insert into icw_sourced_leads (${cols.join(',')}) values (${cols.map((c) => lit((input as any)[c])).join(',')}) returning id`).trim();
  console.log(`INSERTED   ${id}  "${input.full_name}" ${input.phone}`);
}
