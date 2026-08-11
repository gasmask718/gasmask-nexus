// One-off maintenance function: restores dd_ai_config.anthropic_api_key from the
// ANTHROPIC_API_KEY platform secret. Safe to delete after use.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
  if (!key) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { error } = await supabase
    .from('dd_ai_config')
    .update({ anthropic_api_key: key })
    .eq('id', 1);

  return new Response(
    JSON.stringify({ ok: !error, error: error?.message ?? null, key_prefix: key.slice(0, 14) }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
