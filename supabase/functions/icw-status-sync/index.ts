// ICW Status Sync — STUB
// Will push icw_jobs status changes back to the standalone public booking site.
// No outbound calls or database writes yet.
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

  console.log('[icw-status-sync] stub invoked', JSON.stringify(payload));

  return new Response(
    JSON.stringify({
      ok: true,
      stub: true,
      message: 'icw-status-sync is scaffolded only. No status is pushed to the public site yet.',
      received: payload,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  );
});
