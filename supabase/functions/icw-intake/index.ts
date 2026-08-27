// ICW Intake — STUB
// Will receive booking payloads from the standalone public booking site and
// create rows in public.icw_jobs. No persistence logic yet.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    payload = null;
  }

  console.log('[icw-intake] stub invoked', JSON.stringify(payload));

  return new Response(
    JSON.stringify({
      ok: true,
      stub: true,
      message: 'icw-intake is scaffolded only. Booking payloads are not persisted yet.',
      received: payload,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  );
});
