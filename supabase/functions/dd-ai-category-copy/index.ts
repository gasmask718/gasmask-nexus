import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { category, regenerate = false } = await req.json();
    if (!category || typeof category !== 'string') {
      return new Response(JSON.stringify({ error: 'category required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!regenerate) {
      const { data: existing } = await admin.from('category_descriptions').select('*').eq('category', category).maybeSingle();
      if (existing) return new Response(JSON.stringify(existing), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Best-effort: pull up to 12 active products whose name mentions the category
    const { data: products } = await admin
      .from('products_all')
      .select('product_name')
      .eq('status', 'active')
      .ilike('product_name', `%${category}%`)
      .limit(12);

    const prompt = `Write a warm 2-sentence intro for a wholesale-direct category page for ${category}. Mention typical use, not specific products. Brand voice: Aesop x Allbirds — confident, plain, no exclamation marks.${products?.length ? `\n\nFor reference, some products in this category:\n- ${products.map((p) => p.product_name).join('\n- ')}` : ''}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: 'ai_failed', detail: t }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const ai = await aiRes.json();
    const body = ai?.choices?.[0]?.message?.content?.trim();
    if (!body) return new Response(JSON.stringify({ error: 'empty_ai_response' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: upserted, error } = await admin
      .from('category_descriptions')
      .upsert({ category, body, ai_assisted: true, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: 'category' })
      .select()
      .single();
    if (error) throw error;

    return new Response(JSON.stringify({ category: upserted.category, body: upserted.body, ai_assisted: upserted.ai_assisted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
