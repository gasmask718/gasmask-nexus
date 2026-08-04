// TEMPORARY Stage 1 verification harness. Forwards a synthetic delivery to
// sbo-telegram-intake with the real webhook secret. Delete after verification.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('SBO_TELEGRAM_WEBHOOK_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'secret_missing' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload = await req.json();
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/sbo-telegram-intake`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': secret,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  return new Response(
    JSON.stringify({ status: res.status, body: text }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
