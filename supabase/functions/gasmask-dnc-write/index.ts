// gasmask-dnc-write
// Bland AI agent tool endpoint. Called by hosted GasMask agents when a
// contact verbally opts out ("take me off your list", "do not call me", etc.).
//
// Layer 1 of the three-layer opt-out gate:
//   1. THIS FUNCTION    — agent-triggered AddToDNC tool (verbal opt-out)
//   2. tcpa:opt_out     — Bland hosted-side prompt recognition (drives this call)
//   3. dc-bland-webhook — post-call disposition_tag DO_NOT_CONTACT (safety net)
//
// All three converge on the same `public.dnc_list` table that `_shared/dnc.ts`
// checks at dispatch time. Insert is idempotent on (phone_e164) so duplicate
// calls from the agent are safe.
//
// Auth: shared-secret header `x-gasmask-dnc-secret` matching GASMASK_DNC_TOOL_SECRET.
// This endpoint is internet-facing because Bland's tool runner calls it.
// No JWT (Bland cannot mint one); the shared secret + idempotent insert is the
// entire trust boundary. Rotate the secret if it ever leaks.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { normalizeE164 } from '../_shared/dnc.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-gasmask-dnc-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_SOURCES = new Set([
  'bland_agent_tool',
  'bland_webhook',
  'manual_admin',
]);

type DncPayload = {
  phone?: string;
  reason?: string;
  source?: string;
  agent_id?: string;
  call_id?: string;
  notes?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  // --- Auth: shared secret ---
  const expected = Deno.env.get('GASMASK_DNC_TOOL_SECRET');
  if (!expected) {
    console.error('[gasmask-dnc-write] GASMASK_DNC_TOOL_SECRET not configured');
    return json({ error: 'server_misconfigured' }, 500);
  }
  const provided = req.headers.get('x-gasmask-dnc-secret');
  if (!provided || provided !== expected) {
    console.warn('[gasmask-dnc-write] unauthorized request');
    return json({ error: 'unauthorized' }, 401);
  }

  // --- Parse + validate ---
  let body: DncPayload;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const phone_e164 = normalizeE164(body.phone);
  if (!phone_e164 || phone_e164.length < 8) {
    return json({ error: 'invalid_phone', received: body.phone ?? null }, 400);
  }

  const source = body.source && ALLOWED_SOURCES.has(body.source)
    ? body.source
    : 'bland_agent_tool';

  const reason = (body.reason ?? '').toString().trim().slice(0, 500)
    || 'verbal_opt_out_via_bland_agent';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // --- Idempotent upsert on phone_e164 ---
  // Unique constraint exists on dnc_list(phone_number); we mirror phone into
  // both phone_e164 and phone_number so isOnDNC()'s OR-query catches it either way.
  const row = {
    phone_e164,
    phone_number: phone_e164,
    reason,
    source,
    business: 'gasmask',
    metadata: {
      agent_id: body.agent_id ?? null,
      call_id: body.call_id ?? null,
      notes: body.notes ?? null,
      received_at: new Date().toISOString(),
    },
  };

  const { data, error } = await supabase
    .from('dnc_list')
    .upsert(row, { onConflict: 'phone_number', ignoreDuplicates: false })
    .select('id, phone_e164, phone_number, reason, source, created_at')
    .maybeSingle();

  if (error) {
    console.error('[gasmask-dnc-write] upsert failed', error);
    return json({ error: 'db_write_failed', detail: error.message }, 500);
  }

  console.log(
    `[gasmask-dnc-write] DNC recorded phone=${phone_e164} source=${source} reason="${reason}"`,
  );

  return json({
    ok: true,
    blocked_phone: phone_e164,
    record: data,
  }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
