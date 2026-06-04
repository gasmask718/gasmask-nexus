// dd-affiliate-track — public click tracker for affiliate ?ref= landings
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const code = (body?.code ?? '').toString().trim();
    if (!code) {
      return new Response(JSON.stringify({ success: false, error: 'code_required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const meta = body?.meta ?? {};

    // visitor hash: prefer explicit client-passed, fallback to IP + UA SHA-256
    let visitor_hash: string | null = body?.visitor_hash ?? null;
    if (!visitor_hash) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      const ua = req.headers.get('user-agent') ?? '';
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}|${code}`));
      visitor_hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 32);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data, error } = await supabase.rpc('dd_affiliate_track_click', {
      p_code: code, p_visitor_hash: visitor_hash, p_meta: meta,
    });
    if (error) throw error;

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
