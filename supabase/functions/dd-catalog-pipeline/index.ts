// Dynasty Direct — Catalog Pipeline
// Single endpoint, multiple modes (POST body: { mode, ... }):
//   - 'enhance'         : 1 input photo → clean, retouched product shot on neutral bg
//   - 'stage'           : 1 hero photo → N AI-staged lifestyle composites
//   - 'copy_pricing'    : product_name + cost + selected image → title/desc/bullets/SEO + suggested pricing
//   - 'publish'         : draft_id → inserts products_all row + marketplace_inventory + closes draft
//   - 'content_factory' : draft_id or product_id → spins a dd_content_briefs row with UGC + photoshoot concepts
//
// Uses Gemini 3 Pro Image Preview for image gen, Gemini 2.5 Pro for copy/concept generation.
// Generated images are uploaded to the public 'product-images' bucket; URLs returned.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sbAdmin = () => createClient(SUPABASE_URL, SERVICE_ROLE);

// ---------- helpers ----------

async function uploadPng(buf: Uint8Array, path: string): Promise<string> {
  const sb = sbAdmin();
  const { error } = await sb.storage.from('product-images').upload(path, buf, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  const { data } = sb.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch image ${url} → ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const ct = r.headers.get('content-type') || 'image/png';
  let bin = '';
  for (const b of buf) bin += String.fromCharCode(b);
  return `data:${ct};base64,${btoa(bin)}`;
}

// Gemini image generation — returns array of base64 PNGs
async function geminiImage(promptParts: any[]): Promise<string[]> {
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
      messages: [{ role: 'user', content: promptParts }],
      modalities: ['image', 'text'],
    }),
  });
  if (!r.ok) throw new Error(`gemini image ${r.status} ${await r.text()}`);
  const j = await r.json();
  const out: string[] = [];
  const msg = j.choices?.[0]?.message;
  if (Array.isArray(msg?.content)) {
    for (const part of msg.content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const m = String(part.image_url.url).match(/^data:[^;]+;base64,(.+)$/);
        if (m) out.push(m[1]);
      }
    }
  }
  if (Array.isArray(msg?.images)) {
    for (const im of msg.images) {
      if (im.image_url?.url) {
        const m = String(im.image_url.url).match(/^data:[^;]+;base64,(.+)$/);
        if (m) out.push(m[1]);
      }
    }
  }
  return out;
}

async function geminiText(system: string, user: string): Promise<string> {
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!r.ok) throw new Error(`gemini text ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}

function parseJson(s: string): any {
  const cleaned = s.replace(/^```json\s*|\s*```$/g, '').trim();
  try { return JSON.parse(cleaned); }
  catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) try { return JSON.parse(m[0]); } catch { /* */ }
    return {};
  }
}

// ---------- modes ----------

async function runEnhance(body: any) {
  const { draft_id, photo_url, product_name } = body;
  if (!photo_url || !product_name) throw new Error('photo_url + product_name required');
  const dataUrl = await fetchAsDataUrl(photo_url);
  const prompt = `Studio product photography retouch. Subject: "${product_name}".
Take this photo and produce ONE clean, professional ecommerce product shot:
- Pure neutral background (#f7f7f7), soft natural studio lighting, subtle drop shadow
- Subject centered, no crop, full product visible
- Sharp focus, color-accurate, no text overlays, no watermarks
- Square 1:1 framing
Return the image.`;
  const images = await geminiImage([
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: dataUrl } },
  ]);
  if (!images.length) throw new Error('no enhanced image returned');
  const url = await uploadPng(b64ToBytes(images[0]), `dd-catalog/${draft_id || crypto.randomUUID()}/enhanced-${Date.now()}.png`);
  if (draft_id) {
    const sb = sbAdmin();
    const { data: cur } = await sb.from('dd_catalog_drafts').select('enhanced').eq('id', draft_id).single();
    const existing = (cur?.enhanced as any[]) || [];
    await sb.from('dd_catalog_drafts').update({ enhanced: [...existing, { url, created_at: new Date().toISOString() }], status: 'enhanced' }).eq('id', draft_id);
  }
  return { enhanced_url: url };
}

async function runStage(body: any) {
  const { draft_id, hero_url, product_name, count = 3 } = body;
  if (!hero_url || !product_name) throw new Error('hero_url + product_name required');
  const dataUrl = await fetchAsDataUrl(hero_url);

  const scenes = [
    { title: 'Lifestyle', prompt: `Lifestyle scene: place the product naturally in a real-world use context. Warm golden-hour light, shallow depth of field, magazine-quality.` },
    { title: 'Flat lay', prompt: `Top-down flat lay on a textured surface with complementary props that hint at the product's use-case. Even lighting, editorial composition.` },
    { title: 'Bold studio', prompt: `Bold studio shot on a saturated colored backdrop, hard rim light, dramatic shadow, modern e-commerce hero.` },
    { title: 'Hand-held', prompt: `Hand-held product showcase — a human hand presenting the product, natural light, clean background.` },
  ].slice(0, count);

  const urls: { title: string; url: string; prompt: string }[] = [];
  for (const s of scenes) {
    try {
      const imgs = await geminiImage([
        { type: 'text', text: `${s.prompt}\nSubject: "${product_name}". Keep the product visually faithful to the reference. No text, no watermarks. Square 1:1.` },
        { type: 'image_url', image_url: { url: dataUrl } },
      ]);
      if (imgs[0]) {
        const url = await uploadPng(b64ToBytes(imgs[0]), `dd-catalog/${draft_id || 'tmp'}/staged-${s.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`);
        urls.push({ title: s.title, url, prompt: s.prompt });
      }
    } catch (e) {
      console.error('stage scene failed', s.title, e);
    }
  }

  if (draft_id) {
    const sb = sbAdmin();
    const { data: cur } = await sb.from('dd_catalog_drafts').select('staged').eq('id', draft_id).single();
    const existing = (cur?.staged as any[]) || [];
    await sb.from('dd_catalog_drafts').update({ staged: [...existing, ...urls], status: 'staged' }).eq('id', draft_id);
  }
  return { staged: urls };
}

async function runCopyPricing(body: any) {
  const { draft_id, product_name, brand_hint, cost, hero_url } = body;
  if (!product_name) throw new Error('product_name required');
  const numericCost = Number(cost) || 0;

  const system = `You are a senior ecommerce copywriter + pricing analyst. Output STRICT JSON only.`;
  const user = `Product: "${product_name}"${brand_hint ? `, brand: "${brand_hint}"` : ''}.
Cost basis (wholesale unit cost USD): ${numericCost}.
Generate JSON:
{
  "title": "...",                                  // <= 70 chars, SEO-friendly
  "short_description": "...",                      // 1-2 sentences hook
  "long_description": "...",                       // 2-3 paragraphs, scannable
  "bullets": ["...", "...", "..."],                // 3-5 benefit-led bullets
  "seo": { "meta_title": "...", "meta_description": "...", "keywords": ["..."] },
  "pricing": {
    "suggested_wholesale": <num>,                  // ~ cost * 1.35  (B2B)
    "suggested_store": <num>,                      // ~ cost * 2.2   (retail to stores)
    "suggested_retail": <num>,                     // ~ cost * 3.0   (D2C MSRP)
    "suggested_street": <num>,                     // typical street/market price
    "rationale": "..."
  },
  "category_guess": "...",
  "tags": ["...", "..."]
}`;
  const raw = await geminiText(system, user);
  const parsed = parseJson(raw);
  if (draft_id) {
    await sbAdmin().from('dd_catalog_drafts').update({
      copy: {
        title: parsed.title,
        short_description: parsed.short_description,
        long_description: parsed.long_description,
        bullets: parsed.bullets || [],
        seo: parsed.seo || {},
        category_guess: parsed.category_guess,
        tags: parsed.tags || [],
      },
      pricing: parsed.pricing || {},
      status: 'copy_ready',
    }).eq('id', draft_id);
  }
  return parsed;
}

async function runPublish(body: any) {
  const { draft_id } = body;
  if (!draft_id) throw new Error('draft_id required');
  const sb = sbAdmin();
  const { data: draft, error } = await sb.from('dd_catalog_drafts').select('*').eq('id', draft_id).single();
  if (error || !draft) throw new Error(`draft not found: ${error?.message}`);
  if (draft.published_product_id) {
    return { product_id: draft.published_product_id, already_published: true };
  }

  const copy = (draft.copy || {}) as any;
  const pricing = (draft.pricing || {}) as any;
  const selected = (draft.selected || []) as any[];
  const images = selected.length ? selected.map((s: any) => s.url || s) : (draft.enhanced as any[])?.map((e: any) => e.url) || [];
  if (!images.length) throw new Error('cannot publish: no selected images');

  const categoryRaw = (copy.category_guess || '').toString().trim().toLowerCase();
  const category = categoryRaw ? categoryRaw.replace(/\s+/g, '-') : null;

  const { data: prod, error: insErr } = await sb.from('products_all').insert({
    wholesaler_id: draft.supplier_id,
    product_name: copy.title || draft.product_name,
    description: copy.long_description || copy.short_description || null,
    images,
    category,
    retail_price: pricing.suggested_retail || 0,
    store_price: pricing.suggested_store || 0,
    wholesale_price: pricing.suggested_wholesale || 0,
    street_price: pricing.suggested_street || null,
    status: 'active',
  }).select().single();
  if (insErr) throw new Error(`publish insert: ${insErr.message}`);

  // Seed marketplace_inventory row if missing
  await sb.from('marketplace_inventory').insert({
    product_id: prod.id,
    wholesaler_id: draft.supplier_id,
    quantity_on_hand: 0,
    quantity_reserved: 0,
  }).select().maybeSingle().catch(() => null);

  await sb.from('dd_catalog_drafts').update({
    status: 'published',
    published_product_id: prod.id,
  }).eq('id', draft_id);

  return { product_id: prod.id };
}

async function runContentFactory(body: any) {
  const { draft_id, product_id } = body;
  if (!draft_id && !product_id) throw new Error('draft_id or product_id required');
  const sb = sbAdmin();

  let productName = '', brandName = '', heroUrl = '', cb: string | null = null, pid: string | null = product_id || null;
  if (draft_id) {
    const { data: d } = await sb.from('dd_catalog_drafts').select('*').eq('id', draft_id).single();
    if (!d) throw new Error('draft not found');
    productName = (d.copy as any)?.title || d.product_name;
    const selected = (d.selected as any[]) || (d.enhanced as any[]) || [];
    heroUrl = selected[0]?.url || selected[0] || '';
    cb = d.created_by;
    pid = pid || d.published_product_id;
  } else if (pid) {
    const { data: p } = await sb.from('products_all').select('product_name, images').eq('id', pid).single();
    productName = p?.product_name || 'Product';
    const imgs = (p?.images as any[]) || [];
    heroUrl = imgs[0] || '';
  }

  const brief = await sb.from('dd_content_briefs').insert({
    product_id: pid,
    draft_id: draft_id || null,
    created_by: cb,
    product_name: productName,
    brand_name: brandName || null,
    hero_image_url: heroUrl || null,
    status: 'generating',
  }).select().single();
  if (brief.error) throw new Error(brief.error.message);

  const system = 'You are a Gen-Z content strategist for D2C ecommerce. Output STRICT JSON only.';
  const user = `Product: "${productName}".
Generate a content brief as JSON:
{
  "ugc_concepts": [
    { "hook": "...", "script": "...", "persona": "...", "platform": "TikTok|Reels|Shorts" },
    ... 3 total
  ],
  "photoshoot_concepts": [
    { "title": "...", "mood": "...", "props": ["..."], "lighting": "...", "composition": "...", "prompt": "ready-to-paste image-gen prompt" },
    ... 3 total
  ],
  "social_captions": [
    { "platform": "Instagram", "caption": "...", "hashtags": ["#..."] },
    { "platform": "TikTok", "caption": "...", "hashtags": ["#..."] },
    { "platform": "X", "caption": "...", "hashtags": ["#..."] }
  ]
}`;
  try {
    const raw = await geminiText(system, user);
    const parsed = parseJson(raw);
    await sb.from('dd_content_briefs').update({
      ugc_concepts: parsed.ugc_concepts || [],
      photoshoot_concepts: parsed.photoshoot_concepts || [],
      social_captions: parsed.social_captions || [],
      status: 'ready',
    }).eq('id', brief.data.id);
    return { brief_id: brief.data.id, ...parsed };
  } catch (e) {
    await sb.from('dd_content_briefs').update({ status: 'failed', notes: String(e) }).eq('id', brief.data.id);
    throw e;
  }
}

// ---------- entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const mode = body.mode as string;
    let result: any;
    switch (mode) {
      case 'enhance':         result = await runEnhance(body); break;
      case 'stage':           result = await runStage(body); break;
      case 'copy_pricing':    result = await runCopyPricing(body); break;
      case 'publish':         result = await runPublish(body); break;
      case 'content_factory': result = await runContentFactory(body); break;
      default: throw new Error(`unknown mode: ${mode}`);
    }
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('pipeline error', e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
