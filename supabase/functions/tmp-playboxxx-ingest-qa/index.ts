// TEMPORARY QA harness — calls playboxxx-recruiting-ingest with the real shared
// secret from the environment so the full webhook path can be proven end to end.
// Deleted immediately after the acceptance test. No outreach of any kind.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const secret = Deno.env.get('PLAYBOXXX_INGEST_SECRET');
  if (!secret) return new Response(JSON.stringify({ error: 'no secret configured' }), { status: 500, headers: corsHeaders });

  const body = await req.json();
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/playboxxx-recruiting-ingest`;
  const send = async (payload: unknown, withSecret = true) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(withSecret ? { 'x-playboxxx-secret': secret } : {}),
      },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  const out: Record<string, unknown> = {};
  if (body.unauthorized_probe) out.unauthorized = await send({ leads: [] }, false);
  if (body.payloads) {
    out.runs = [];
    for (const p of body.payloads) (out.runs as unknown[]).push(await send(p));
  }
  return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
