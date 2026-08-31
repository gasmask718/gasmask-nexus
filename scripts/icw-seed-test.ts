import { supabase } from '@/integrations/supabase/client';
import { ingestSourcedLeads } from '@/lib/icw/leadIngestion';

const batch = [
  { full_name: 'TEST SEED — Marisol Vega Floor Care', phone: '(305) 555-0142', license_number: 'FL-FLR-99001', license_type: 'Flooring Contractor', license_status: 'active', address: '1420 NW 7th St', city: 'Miami', state: 'FL', postal_code: '33125', latitude: 25.7796, longitude: -80.2210, category_groups: ['Floors'], source_platform: 'test_seed', status: 'prospect' },
  { full_name: 'TEST SEED — Dana Okafor Reorg Studio', phone: '(718) 555-0199', address: '88 Nostrand Ave', city: 'Brooklyn', state: 'NY', postal_code: '11205', latitude: 40.6944, longitude: -73.9506, category_groups: ['Professional Reorganizer'], source_platform: 'test_seed', source_id: 'seed-reorg-001', status: 'prospect' },
  { full_name: 'TEST SEED — Bright Path Cleaning', phone: '(404) 555-0177', address: '905 Peachtree St NE', city: 'Atlanta', state: 'GA', postal_code: '30309', latitude: 33.7815, longitude: -84.3831, category_groups: ['Cleaning', 'Mobile Wash'], source_platform: 'test_seed', source_id: 'seed-clean-001', status: 'qualified' },
  { full_name: 'TEST SEED — Duplicate Dupe Candidate', phone: '(213) 555-0123', address: '700 S Flower St', city: 'Los Angeles', state: 'CA', postal_code: '90017', latitude: 34.0466, longitude: -118.2586, category_groups: ['Handyman'], source_platform: 'test_seed', source_id: 'seed-dupe-a', status: 'prospect' },
  { full_name: 'TEST SEED — Duplicate Dupe Candidate', phone: '213-555-0123', address: '700 South Flower Street', city: 'Los Angeles', state: 'CA', postal_code: '90017', latitude: 34.0467, longitude: -118.2588, category_groups: ['Handyman', 'Moving'], source_platform: 'test_seed', source_id: 'seed-dupe-b', status: 'prospect' },
];

const email = process.env.ICW_TEST_EMAIL!, password = process.env.ICW_TEST_PASSWORD!;
const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
if (authErr) { console.error('auth failed:', authErr.message); process.exit(1); }

const res = await ingestSourcedLeads(batch as never[]);
for (const r of res.results) console.log(r.action, r.matchReason ?? '', r.lead.id, r.lead.full_name);
console.log(JSON.stringify({ newLeadCount: res.newLeadCount, duplicateCount: res.duplicateCount }));
