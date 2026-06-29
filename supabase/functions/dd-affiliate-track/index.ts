// dd-affiliate-track — public click tracker for affiliate ?ref= landings
// and partner ?campaign= landings.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const refCode = ((body as any)?.ref_code ?? (body as any)?.code ?? '').toString().trim();
    const campaignCode = ((body as any)?.campaign_code ?? '').toString().trim();
    const supplierId = ((body as any)?.supplier_id ?? '').toString().trim() || null;
    const meta = (body as any)?.meta ?? {};

    if (!refCode && !campaignCode) {
      return new Response(JSON.stringify({ success: false, error: 'code_required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let visitor_hash: string | null = (body as any)?.visitor_hash ?? null;
    if (!visitor_hash) {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
      const ua = req.headers.get('user-agent') ?? '';
      const seed = `${ip}|${ua}|${refCode}|${campaignCode}`;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
      visitor_hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0, 32);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Affiliate click (existing RPC) — only if we have a ref code
    let affiliateResult: unknown = null;
    if (refCode) {
      const { data, error } = await supabase.rpc('dd_affiliate_track_click', {
        p_code: refCode, p_visitor_hash: visitor_hash, p_meta: { ...meta, supplier_id: supplierId, campaign_code: campaignCode || null },
      });
      if (error) console.error('[dd-affiliate-track] affiliate rpc error', error.message);
      affiliateResult = data ?? null;
    }

    // Campaign click — increment dd_campaigns.total_clicks
    if (campaignCode) {
      const { data: camp } = await supabase
        .from('dd_campaigns')
        .select('id, total_clicks')
        .eq('campaign_code', campaignCode)
        .maybeSingle();
      if (camp?.id) {
        await supabase
          .from('dd_campaigns')
          .update({ total_clicks: (camp.total_clicks ?? 0) + 1 })
          .eq('id', camp.id);
      }
    }

    return new Response(JSON.stringify({ success: true, affiliate: affiliateResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
