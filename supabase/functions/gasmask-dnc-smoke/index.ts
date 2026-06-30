// Temporary smoke-test function for gasmask-dnc-write + isOnDNC gate path.
// Runs server-side so it can access GASMASK_DNC_TOOL_SECRET without exposing it.
// DELETE after smoke test passes.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TEST_PHONE = '+15555550199'; // reserved test range, never routable

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const secret = Deno.env.get('GASMASK_DNC_TOOL_SECRET') ?? '';
  const dncWriteUrl = `${SUPABASE_URL}/functions/v1/gasmask-dnc-write`;
  const dispatchUrl = `${SUPABASE_URL}/functions/v1/dc-bland-dispatch`;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const results: Record<string, unknown> = { test_phone: TEST_PHONE };

  // Pre-clean any prior test row so smoke is reproducible
  await supabase.from('dnc_list').delete().or(
    `phone_e164.eq.${TEST_PHONE},phone_number.eq.${TEST_PHONE}`,
  );

  // (a) auth blocks without header
  const a = await fetch(dncWriteUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anon },
    body: JSON.stringify({ phone: TEST_PHONE, reason: 'smoke_no_auth' }),
  });
  results.a_no_auth = { status: a.status, body: await a.json().catch(() => null) };

  // (b) write lands with secret
  const b = await fetch(dncWriteUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      'x-gasmask-dnc-secret': secret,
    },
    body: JSON.stringify({
      phone: '555-555-0199', // unnormalized form to prove normalization
      reason: 'smoke_test_layer_1',
      source: 'bland_agent_tool',
      agent_id: 'c238743a-aa35-4993-bfc0-8229178b465d',
      call_id: 'smoke-test-call-001',
    }),
  });
  results.b_write = { status: b.status, body: await b.json().catch(() => null) };

  const { data: rowsAfterFirst } = await supabase.from('dnc_list')
    .select('id, phone_e164, phone_number, source, reason, metadata, created_at')
    .or(`phone_e164.eq.${TEST_PHONE},phone_number.eq.${TEST_PHONE}`);
  results.b_db_rows = rowsAfterFirst;

  // (c) idempotency — same call again
  const c = await fetch(dncWriteUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      'x-gasmask-dnc-secret': secret,
    },
    body: JSON.stringify({
      phone: TEST_PHONE,
      reason: 'smoke_test_layer_1_retry',
      agent_id: 'c238743a-aa35-4993-bfc0-8229178b465d',
      call_id: 'smoke-test-call-002',
    }),
  });
  results.c_rewrite = { status: c.status, body: await c.json().catch(() => null) };

  const { data: rowsAfterSecond, count } = await supabase.from('dnc_list')
    .select('id, phone_e164, reason, metadata', { count: 'exact' })
    .or(`phone_e164.eq.${TEST_PHONE},phone_number.eq.${TEST_PHONE}`);
  results.c_db_rows = rowsAfterSecond;
  results.c_row_count = count;

  // (d) dispatcher gate must now block this number
  const d = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({
      phoneNumber: TEST_PHONE,
      businessType: 'gasmask',
      leadName: 'DNC Smoke Test',
    }),
  });
  results.d_dispatch = { status: d.status, body: await d.json().catch(() => null) };

  // Cleanup
  await supabase.from('dnc_list').delete().or(
    `phone_e164.eq.${TEST_PHONE},phone_number.eq.${TEST_PHONE}`,
  );

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
