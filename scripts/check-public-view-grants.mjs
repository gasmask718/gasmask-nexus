#!/usr/bin/env node
/**
 * DEPLOY GUARD — public-facing view grants.
 *
 * Blocks the build if any public-facing view has drifted out of its declared
 * safe state. Runs the same anon-key probes as the scheduled
 * `public-view-security-probe` edge function, using only the public anon key
 * (no service credentials needed), so it is safe to run in CI/deploy.
 *
 * PASS  = anon can SELECT, and every write (PATCH / POST / DELETE) is refused.
 * FAIL  = a write succeeded → non-zero exit → deploy stops.
 *
 * Run via `node scripts/check-public-view-grants.mjs` (wired into `prebuild`).
 * Set SKIP_VIEW_GRANT_CHECK=1 to bypass (offline/local builds only).
 */
import fs from 'node:fs';
import path from 'node:path';

const VIEWS = ['products_public'];
const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

if (process.env.SKIP_VIEW_GRANT_CHECK === '1') {
  console.log('⚠️  Public view grant check skipped (SKIP_VIEW_GRANT_CHECK=1)');
  process.exit(0);
}

// ─── Resolve credentials (env first, then .env) ─────────────────────────────
function fromDotEnv(key) {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return undefined;
  const line = fs
    .readFileSync(p, 'utf8')
    .split('\n')
    .find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : undefined;
}
const pick = (...keys) => keys.map((k) => process.env[k] ?? fromDotEnv(k)).find(Boolean);

const SUPABASE_URL = pick('VITE_SUPABASE_URL', 'SUPABASE_URL');
const ANON_KEY = pick('VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !ANON_KEY) {
  console.log('⚠️  Public view grant check skipped — no Supabase URL/anon key available');
  process.exit(0);
}

const req = async (view, method, { query = '', body } = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${view}${query}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.text()).slice(0, 300) };
};

const blocked = ({ status, body }) =>
  !(status >= 200 && status < 300) &&
  (status === 401 || status === 403 || status === 404 || status === 405 ||
    body.includes('42501') || body.toLowerCase().includes('permission denied'));

const failures = [];

for (const view of VIEWS) {
  const read = await req(view, 'GET', { query: '?select=id&limit=1' });
  if (!(read.status >= 200 && read.status < 300)) {
    failures.push(`${view}: anon SELECT unexpectedly BLOCKED (${read.status}) — storefront will break`);
  } else {
    console.log(`  ✓ ${view} GET allowed (${read.status})`);
  }

  const writes = [
    ['PATCH name', await req(view, 'PATCH', { query: `?id=eq.${ZERO_UUID}`, body: { product_name: 'DEPLOY_GUARD_PROBE' } })],
    ['PATCH status', await req(view, 'PATCH', { query: `?id=eq.${ZERO_UUID}`, body: { status: 'inactive' } })],
    ['POST', await req(view, 'POST', { body: { product_name: 'DEPLOY_GUARD_PROBE', status: 'inactive' } })],
    ['DELETE', await req(view, 'DELETE', { query: `?id=eq.${ZERO_UUID}` })],
  ];

  for (const [label, res] of writes) {
    if (blocked(res)) {
      console.log(`  ✓ ${view} ${label} blocked (${res.status})`);
    } else {
      failures.push(`${view}: anon ${label} SUCCEEDED (${res.status}) ${res.body}`);
    }
  }
}

if (failures.length) {
  console.error('\n❌ PUBLIC VIEW GRANT CHECK FAILED — deploy blocked\n');
  failures.forEach((f) => console.error(`   • ${f}`));
  console.error(
    '\nExpected safe state: anon/authenticated = SELECT only.\n' +
      'Fix with: REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.<view> FROM anon, authenticated;\n' +
      'See the safe-state contract in the view comment and public.public_view_contracts.\n',
  );
  process.exit(1);
}

console.log('\n✅ Public view grant check passed — anon is SELECT-only on:', VIEWS.join(', '), '\n');
