// T7a Phase 3 — One-shot: rewrite Voice URL on all 5 target numbers to canonical dc-inbound-call.
// Read-then-write. Requires x-bootstrap-token header matching T4_BOOTSTRAP_TOKEN.
// Deletes itself after use (agent removes deployment + source).

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const CANONICAL_VOICE_URL =
  'https://qalaaroashbggynpvqct.supabase.co/functions/v1/dc-inbound-call';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const token = req.headers.get('x-bootstrap-token');
  const expected = Deno.env.get('T4_BOOTSTRAP_TOKEN');
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sid = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
  if (!sid.startsWith('AC')) {
    return new Response(
      JSON.stringify({
        error: 'TWILIO_ACCOUNT_SID_PREFIX_INVALID',
        observed_prefix: sid.slice(0, 2),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const numbers: string[] = (await req.json()).phone_numbers ?? [];
  const basic = 'Basic ' + btoa(`${sid}:${auth}`);
  const base = `https://api.twilio.com/2010-04-01/Accounts/${sid}`;
  const results: unknown[] = [];

  for (const n of numbers) {
    const lookup = await fetch(
      `${base}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(n)}`,
      { headers: { Authorization: basic } },
    );
    const lookupJson = await lookup.json();
    const row = lookupJson.incoming_phone_numbers?.[0];
    if (!row) {
      results.push({ phone_number: n, ok: false, error: 'not_found_in_twilio' });
      continue;
    }
    const before = {
      voice_url: row.voice_url,
      voice_method: row.voice_method,
      voice_fallback_url: row.voice_fallback_url,
    };
    const body = new URLSearchParams({
      VoiceUrl: CANONICAL_VOICE_URL,
      VoiceMethod: 'POST',
    });
    const upd = await fetch(`${base}/IncomingPhoneNumbers/${row.sid}.json`, {
      method: 'POST',
      headers: {
        Authorization: basic,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const updJson = await upd.json();
    results.push({
      phone_number: n,
      ok: upd.ok,
      twilio_sid: row.sid,
      before,
      after: {
        voice_url: updJson.voice_url,
        voice_method: updJson.voice_method,
        date_updated: updJson.date_updated,
      },
      http_status: upd.status,
    });
  }

  return new Response(
    JSON.stringify({ canonical: CANONICAL_VOICE_URL, results }, null, 2),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
