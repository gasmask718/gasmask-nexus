import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHash } from 'node:crypto';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { product_id } = await req.json();
    if (!product_id) return new Response(JSON.stringify({ error: 'product_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: reviews } = await admin
      .from('reviews')
      .select('id, text, rating, updated_at')
      .eq('product_id', product_id)
      .eq('status', 'approved')
      .order('created_at', { ascending: true });

    if (!reviews || reviews.length < 3) {
      await admin.from('review_summaries').delete().eq('product_id', product_id);
      return new Response(JSON.stringify({ skipped: 'too_few_reviews', count: reviews?.length ?? 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const sortedIds = reviews.map((r) => r.id).sort();
    const maxUpdated = reviews.reduce((a, r) => (r.updated_at && r.updated_at > a ? r.updated_at : a), '');
    const source_hash = createHash('md5').update(sortedIds.join('|') + '::' + maxUpdated).digest('hex');

    const { data: existing } = await admin.from('review_summaries').select('*').eq('product_id', product_id).maybeSingle();
    if (existing && existing.source_hash === source_hash) {
      return new Response(JSON.stringify({ cached: true, ...existing }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const text = reviews.map((r) => `(${r.rating}/5) ${r.text ?? ''}`).join('\n').slice(0, 4000);
    const prompt = `Reviews:\n${text}\n\nSummarize what buyers actually mention about this product in ONE sentence starting with 'Buyers mention'. Keep it under 22 words. Quote no one.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-3-flash-preview', messages: [{ role: 'user', content: prompt }] }),
    });
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: 'ai_failed', detail: t }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const ai = await aiRes.json();
    const summary = ai?.choices?.[0]?.message?.content?.trim();
    if (!summary) return new Response(JSON.stringify({ error: 'empty_ai_response' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: upserted, error } = await admin
      .from('review_summaries')
      .upsert({ product_id, summary, review_count: reviews.length, source_hash, generated_at: new Date().toISOString() }, { onConflict: 'product_id' })
      .select()
      .single();
    if (error) throw error;

    // Drain job row
    await admin.from('review_summary_jobs').delete().eq('product_id', product_id);

    return new Response(JSON.stringify(upserted), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
