import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { asset_type, brand, store_ids, product_name } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results: any[] = [];
    const ids = store_ids || [];

    // Process in batches of 5
    for (let i = 0; i < ids.length; i += 5) {
      const batch = ids.slice(i, i + 5);

      await Promise.all(batch.map(async (storeId: string) => {
        try {
          const { data } = await supabase.functions.invoke('generate-canva-asset', {
            body: { asset_type, brand, store_id: storeId, product_name },
          });
          results.push({ store_id: storeId, ...data });
        } catch (e: any) {
          results.push({ store_id: storeId, success: false, error: e.message });
        }
      }));

      if (i + 5 < ids.length) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: ids.length,
      generated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
