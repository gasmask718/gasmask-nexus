// POD Design Factory — real AI image generation via Lovable AI Gateway.
// Input: { prompt, category, title?, channels?: string[] }
// Output: { design, listings }
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const DEFAULT_CHANNELS = ['printify', 'etsy', 'ebay', 'amazon', 'shopify'] as const;

// Map channel → secret-name required to flip it live
const CHANNEL_KEYS: Record<string, string> = {
  printify: 'PRINTIFY_API_KEY',
  etsy: 'ETSY_API_KEY',
  ebay: 'EBAY_API_TOKEN',
  amazon: 'AMAZON_SP_API_TOKEN',
  shopify: 'SHOPIFY_ADMIN_API_TOKEN',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { prompt, category = 'evergreen', title, channels = DEFAULT_CHANNELS } = body || {};
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'prompt required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Generate image via Lovable AI Gateway (non-streaming, returns b64_json)
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: `Print-on-demand design, no text overlay, transparent-friendly composition. ${prompt}` }],
        modalities: ['image', 'text'],
      }),
    });

    if (!aiRes.ok) {
      const errTxt = await aiRes.text();
      return new Response(JSON.stringify({ error: 'image_generation_failed', detail: errTxt, status: aiRes.status }), {
        status: aiRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiJson = await aiRes.json();
    const b64 = aiJson?.data?.[0]?.b64_json;
    if (!b64) {
      return new Response(JSON.stringify({ error: 'no_image_returned', raw: aiJson }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Upload to storage
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const fileName = `ai/${crypto.randomUUID()}.png`;
    const { error: upErr } = await supabase.storage.from('pod-designs').upload(fileName, bytes, {
      contentType: 'image/png', upsert: false,
    });
    if (upErr) {
      return new Response(JSON.stringify({ error: 'storage_upload_failed', detail: upErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // pod-designs is a PRIVATE bucket: store the object path. Any consumer
    // (UI, channel publisher) mints a signed URL from it at use time.
    const imageUrl = fileName;

    // 3. Insert pod_designs row
    const { data: design, error: designErr } = await supabase.from('pod_designs').insert({
      category,
      title: title || `AI · ${prompt.slice(0, 60)}`,
      ai_description: prompt,
      design_image_url: imageUrl,
      tags: [category, 'ai-generated'],
      seo_keywords: [category, 'print on demand'],
      generated_by_ai: true,
      status: 'new',
    }).select().single();
    if (designErr) throw designErr;

    // 4. Fan out draft listings (status: pending_keys if no credential, else draft)
    const listingRows = (channels as string[]).map((ch) => ({
      design_id: design.id,
      channel: ch,
      status: Deno.env.get(CHANNEL_KEYS[ch] || '') ? 'draft' : 'pending_keys',
      metadata: { required_secret: CHANNEL_KEYS[ch] || null },
    }));
    const { data: listings, error: listErr } = await supabase
      .from('pod_listings').insert(listingRows).select();
    if (listErr) throw listErr;

    await supabase.from('pod_ai_logs').insert({
      action: 'ai_design_generated',
      metadata: { design_id: design.id, prompt, category, channels },
    });

    return new Response(JSON.stringify({ design, listings }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
