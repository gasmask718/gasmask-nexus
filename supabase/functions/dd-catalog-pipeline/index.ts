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
import { lookupMarket, type MarketLookup } from '../_shared/marketPrice.ts';
import { DD_CATEGORIES, mapDdCategory } from '../_shared/ddCategory.ts';

const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REMOVEBG_API_KEY = Deno.env.get('REMOVEBG_API_KEY') || '';

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

// ---------- caller privilege ----------

/**
 * Only admin/owner callers may see or persist retail pricing + margin math.
 * The wholesaler self-serve wizard calls this same pipeline — without this gate
 * the suggested retail, margin floor, and market-check snapshot would be written
 * into dd_catalog_drafts, a row the wholesaler can SELECT (creators-see-own-drafts
 * policy), leaking Dynasty's margin. Wholesalers get copy only.
 */
async function callerIsPrivileged(req: Request): Promise<boolean> {
  try {
    const auth = req.headers.get('Authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    if (!token) return false;
    const sb = sbAdmin();
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return false;
    const { data: roles } = await sb.from('user_roles').select('role').eq('user_id', user.id);
    const set = new Set((roles || []).map((r: any) => r.role));
    return set.has('admin') || set.has('owner');
  } catch (_e) {
    return false; // fail closed — no pricing for unverifiable callers
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

async function runCopyPricing(body: any, privileged = true) {
  const { draft_id, product_name, brand_hint, cost, hero_url, supplier_id } = body;
  if (!product_name) throw new Error('product_name required');
  const numericCost = Number(cost) || 0;
  const sb = sbAdmin();

  // D-verify: read effective margin from dd_get_effective_margin_pct so suggested retail
  // covers the configured platform margin. Falls back to dd_config.default_margin_pct, then 15%.
  let effectiveMarginPct = 15;
  try {
    if (supplier_id) {
      const { data: m } = await sb.rpc('dd_get_effective_margin_pct', {
        p_product_id: null, p_wholesaler_id: supplier_id,
      });
      if (typeof m === 'number' && m > 0) effectiveMarginPct = m;
    } else {
      const { data: cfg } = await sb.from('dd_config').select('default_margin_pct').eq('id', true).maybeSingle();
      if (cfg?.default_margin_pct) effectiveMarginPct = Number(cfg.default_margin_pct);
    }
  } catch (_) { /* keep default */ }

  // Floor: retail must cover (cost / (1 - margin%)) so DD margin is preserved on retail.
  const marginFraction = Math.min(0.9, Math.max(0, effectiveMarginPct / 100));
  const retailFloor = numericCost > 0 && marginFraction > 0
    ? Number((numericCost / (1 - marginFraction)).toFixed(2))
    : 0;

  // --- Market context (real competitor listings via SerpAPI Google Shopping) ---
  // Never fatal: if the key is missing, quota is exhausted, or nothing relevant
  // matched, we degrade to formula-only pricing and say so in the response.
  let market: MarketLookup | null = null;
  try {
    market = await lookupMarket(sb, product_name, brand_hint);
  } catch (e) {
    market = null;
    console.error('[copy_pricing] market lookup failed', e);
  }
  // Only apples-to-apples data steers price: same pack size, enough surviving listings.
  const marketUsable = !!(market && market.available && market.comparable && market.count > 0 && market.median);
  const marketBlock = marketUsable
    ? `Live market data (Google Shopping, ${market!.count} listings matching pack size ${market!.pack_size}, after bundle/relevance/outlier filtering):
  low $${market!.low} / median $${market!.median} / high $${market!.high}.
Anchor suggested_retail near the market median, but NEVER below ${retailFloor}. Do not exceed $${market!.high} unless you state why.`
    : `No live market data available${market?.reason ? ` (${market.reason})` : ''} — price from cost and margin only.`;

  const system = `You are a senior ecommerce copywriter + pricing analyst. Output STRICT JSON only.`;
  const user = `Product: "${product_name}"${brand_hint ? `, brand: "${brand_hint}"` : ''}.
Cost basis (wholesale unit cost USD): ${numericCost}.
Platform margin requirement: ${effectiveMarginPct}% (suggested_retail MUST be >= ${retailFloor} to honor this).
${marketBlock}
Generate JSON:
{
  "title": "...",                                  // <= 70 chars, SEO-friendly
  "short_description": "...",
  "long_description": "...",
  "bullets": ["...", "...", "..."],
  "seo": { "meta_title": "...", "meta_description": "...", "keywords": ["..."] },
  "pricing": {
    "suggested_wholesale": <num>,
    "suggested_store": <num>,
    "suggested_retail": <num>,                     // >= ${retailFloor}
    "suggested_street": <num>,
    "rationale": "..."
  },
  "category_guess": "<EXACTLY one of: ${DD_CATEGORIES.join(' | ')}>",
  "tags": ["...", "..."]
}`;
  const raw = await geminiText(system, user);
  const parsed = parseJson(raw);

  // Normalize the AI category onto the products_all check-constraint values now,
  // so the wizard shows (and the publish insert receives) a legal slug.
  const catMap = mapDdCategory(parsed.category_guess, [product_name, brand_hint, (parsed.tags || []).join(' ')].filter(Boolean).join(' '));
  parsed.category_guess = catMap.category;
  parsed.category_source = catMap.method;
  parsed.category_raw = catMap.raw;

  // Server-side price arbitration. Order is fixed: margin floor always wins.
  const pricing = parsed.pricing || {};
  const notes: string[] = [];
  let pricingBasis: 'market_informed' | 'formula_only' | 'floor_over_market' = marketUsable ? 'market_informed' : 'formula_only';

  if (marketUsable) {
    const median = Number(market!.median);
    const high = Number(market!.high);
    if (retailFloor > 0 && median < retailFloor) {
      // Market sits below what our margin requires — keep the floor, surface the conflict.
      pricing.suggested_retail = retailFloor;
      pricingBasis = 'floor_over_market';
      notes.push(`market median $${median} is BELOW the ${effectiveMarginPct}% margin floor $${retailFloor} — floor kept, this product may be uncompetitive`);
    } else {
      const suggested = Number(pricing.suggested_retail);
      if (!Number.isFinite(suggested) || suggested <= 0) {
        pricing.suggested_retail = median;
        notes.push(`retail set to market median $${median}`);
      } else if (suggested < retailFloor) {
        pricing.suggested_retail = Math.max(retailFloor, median);
        notes.push(`retail raised to $${pricing.suggested_retail} (margin floor $${retailFloor}, market median $${median})`);
      } else if (high > 0 && suggested > high) {
        pricing.suggested_retail = Math.max(retailFloor, median);
        notes.push(`retail pulled back to market median $${median} (AI suggestion $${suggested} exceeded market high $${high})`);
      } else {
        notes.push(`retail $${suggested} validated against market median $${median} (${market!.count} listings)`);
      }
    }
  } else if (retailFloor > 0 && (!pricing.suggested_retail || Number(pricing.suggested_retail) < retailFloor)) {
    pricing.suggested_retail = retailFloor;
    notes.push(`floor ${retailFloor} applied to honor ${effectiveMarginPct}% margin`);
  }

  if (!marketUsable) notes.push(`no market data${market?.reason ? `: ${market.reason}` : ''}`);
  if (notes.length) {
    pricing.rationale = (pricing.rationale ? pricing.rationale + ' ' : '') + `[${notes.join('; ')}]`;
  }
  pricing.basis = pricingBasis;


  // Emit Product JSON-LD for the public card to consume.
  const jsonld = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: parsed.title || product_name,
    description: parsed.short_description || parsed.long_description || '',
    image: hero_url ? [hero_url] : undefined,
    brand: brand_hint ? { '@type': 'Brand', name: brand_hint } : undefined,
    category: parsed.category_guess || undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'USD',
      price: pricing.suggested_retail || 0,
      availability: 'https://schema.org/InStock',
    },
  };

  // Audit snapshot of exactly what market data drove the suggestion.
  const marketSnapshot = {
    available: marketUsable,
    reason: market?.reason,
    query: market?.query ?? null,
    range: marketUsable
      ? { low: market!.low, median: market!.median, high: market!.high, avg: market!.avg, count: market!.count }
      : null,
    samples: market?.samples ?? [],
    excluded: market?.excluded ?? null,
    comparable: market?.comparable ?? false,
    pack_size: market?.pack_size ?? 1,
    used_for_pricing: marketUsable,
    basis: pricingBasis,
    checked_at: market?.checked_at ?? new Date().toISOString(),
  };

  if (draft_id) {
    await sb.from('dd_catalog_drafts').update({
      copy: {
        title: parsed.title,
        short_description: parsed.short_description,
        long_description: parsed.long_description,
        bullets: parsed.bullets || [],
        seo: parsed.seo || {},
        category_guess: parsed.category_guess,
        category_source: catMap.method,
        category_raw: catMap.raw,
        tags: parsed.tags || [],
        // Margin math is admin/owner-only — wholesalers can SELECT their own drafts.
        ...(privileged ? { jsonld, margin_pct_applied: effectiveMarginPct, retail_floor: retailFloor } : {}),
      },
      // Pricing columns are written for privileged callers only; admin re-prices
      // wholesaler submissions during review regardless.
      ...(privileged ? { pricing, market_check: marketSnapshot } : {}),
      status: 'copy_ready',
    }).eq('id', draft_id);
  }
  if (!privileged) {
    // Wholesaler self-serve response: copy fields only. No retail, no margin, no floor.
    return { ...parsed };
  }
  return {
    ...parsed,
    pricing,
    jsonld,
    margin_pct_applied: effectiveMarginPct,
    retail_floor: retailFloor,
    pricing_basis: pricingBasis,
    market: marketSnapshot,
  };
}



async function runMarketCheck(body: any) {
  const { product_name, brand_hint, draft_id } = body;
  if (!product_name) throw new Error('product_name required');
  const sb = sbAdmin();
  const m = await lookupMarket(sb, product_name, brand_hint);
  const payload = {
    available: m.available && m.count > 0,
    reason: m.reason,
    query: m.query,
    range: m.count > 0 ? { low: m.low, median: m.median, high: m.high, avg: m.avg, count: m.count } : null,
    samples: m.samples,
    excluded: m.excluded,
    comparable: m.comparable,
    pack_size: m.pack_size,
    checked_at: m.checked_at,
  };
  if (draft_id) {
    await sb.from('dd_catalog_drafts').update({ market_check: payload }).eq('id', draft_id);
  }
  return payload;

}

async function runEstimateMeasurements(body: any) {
  const { product_name, photo_url, draft_id } = body;
  if (!product_name || !photo_url) throw new Error('product_name + photo_url required');
  const dataUrl = await fetchAsDataUrl(photo_url);
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `Estimate the SHIPPING weight (oz) and physical dimensions (inches) of "${product_name}" in this photo. Use any visible reference objects (hand, coin, ruler, common packaging) or known product specs. Return STRICT JSON only:
{
  "weight_oz": <number>,
  "dimensions": { "length_in": <number>, "width_in": <number>, "height_in": <number> },
  "confidence": "low|medium|high",
  "reasoning": "<one short sentence: what reference / known specs you used>"
}
If you cannot estimate any field, set it to null. NEVER guess wildly — shipping bills on actuals.` },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error(`gemini estimate ${r.status}`);
  const j = await r.json();
  const txt = j.choices?.[0]?.message?.content ?? '';
  const parsed = parseJson(typeof txt === 'string' ? txt : '');
  const payload = {
    weight_oz: parsed.weight_oz ?? null,
    dimensions: parsed.dimensions ?? null,
    confidence: parsed.confidence ?? 'low',
    reasoning: parsed.reasoning ?? '',
    estimated_at: new Date().toISOString(),
  };
  if (draft_id) {
    // Prefill the editable fields, but DO NOT mark verified — David must tap the checkbox.
    await sbAdmin().from('dd_catalog_drafts').update({
      measurements_estimate: payload,
      weight_oz: payload.weight_oz,
      dimensions: payload.dimensions,
    }).eq('id', draft_id);
  }
  return payload;
}

async function runPublish(body: any) {
  const { draft_id, confirmed_by } = body;
  if (!draft_id) throw new Error('draft_id required');
  const sb = sbAdmin();
  const { data: draft, error } = await sb.from('dd_catalog_drafts').select('*').eq('id', draft_id).single();
  if (error || !draft) throw new Error(`draft not found: ${error?.message}`);
  if (draft.published_product_id) {
    return { product_id: draft.published_product_id, already_published: true };
  }

  // CONTRACT GUARD: wholesaler_id (supplier_id on the draft) is REQUIRED — routing + splits depend on it.
  if (!draft.supplier_id) throw new Error('cannot publish: draft.supplier_id (wholesaler_id) is required');

  // MEASUREMENT GUARD: never publish on an unverified estimate (shipping bills on actuals).
  if (!draft.measurements_verified_at) {
    throw new Error('cannot publish: measurements not verified — tap "measurements verified" in Step D');
  }


  const copy = (draft.copy || {}) as any;
  const pricing = (draft.pricing || {}) as any;
  const selected = (draft.selected || []) as any[];

  // images jsonb array — confirmed B2 hero MUST be images[0]; selected[0] is the user-confirmed hero,
  // remaining selected items form the detail-page gallery. Fall back to enhanced[0] only as a safety net.
  const selectedUrls = selected.map((s: any) => (typeof s === 'string' ? s : s.url)).filter(Boolean);
  const enhancedUrls = ((draft.enhanced as any[]) || []).map((e: any) => e.url).filter(Boolean);
  const images = selectedUrls.length ? selectedUrls : enhancedUrls;
  if (!images.length) throw new Error('cannot publish: no selected images (need at least 1 for images[0] hero)');

  const recognitionEarly = (draft.recognition || {}) as any;

  // CATEGORY GATE: products_all.category is check-constrained to ten snake_case
  // slugs. The AI returns human-readable text, so map it — never hyphenate raw
  // text into the column (that produced "rolling-papers" and a 400 on insert).
  const catCtx = [draft.product_name, copy.title, recognitionEarly.item_type, (copy.tags || []).join(' ')]
    .filter(Boolean).join(' ');
  const catMap = mapDdCategory(copy.category_guess || draft.category, catCtx);
  if (!catMap.category) {
    throw new Error(
      `cannot publish: category "${catMap.raw ?? '(blank)'}" does not map to a Dynasty Direct category. ` +
      `Pick one manually in Step C: ${DD_CATEGORIES.join(', ')}`,
    );
  }
  const category = catMap.category;

  // SUPPLIER FK GATE: products_all.wholesaler_id references wholesaler_profiles(id),
  // but drafts may carry an id from the legacy `wholesalers` table. Resolve it via
  // wholesaler_profiles.wholesaler_id instead of failing on the FK at insert time.
  const wholesalerProfileId = await resolveWholesalerProfileId(sb, draft.supplier_id);

  // EXACTNESS-GATE CONFIRM: mark the draft as confirmed BEFORE the products_all insert so the
  // BEFORE-INSERT trigger (dd_enforce_catalog_confirm_gate) sees confirmed_at and allows status='active'.
  await sb.from('dd_catalog_drafts').update({
    confirmed_at: new Date().toISOString(),
    confirmed_by: confirmed_by || null,
  }).eq('id', draft_id);

  const recognition = recognitionEarly;

  const { data: prod, error: insErr } = await sb.from('products_all').insert({
    wholesaler_id: wholesalerProfileId,
    product_name: copy.title || draft.product_name,
    description: copy.long_description || copy.short_description || null,
    images,
    category,
    retail_price: pricing.suggested_retail || 0,
    store_price: pricing.suggested_store || 0,
    wholesale_price: pricing.suggested_wholesale || 0,
    // MARGIN GUARD FEED: without supplier cost the dd_margin_guard trigger short-circuits (v_cost <= 0)
    // and every wizard-published product bypasses the margin floor. Always pass the draft's real cost.
    supplier_cost: draft.cost ?? null,
    supplier_cost_cents: draft.cost != null ? Math.round(Number(draft.cost) * 100) : null,
    street_price: pricing.suggested_street || null,
    inventory_qty: typeof draft.inventory_qty === 'number' ? draft.inventory_qty : 0,
    weight_oz: draft.weight_oz ?? null,
    dimensions: draft.dimensions ?? null,
    key_features: Array.isArray(recognition.key_features) && recognition.key_features.length ? recognition.key_features : null,
    item_type: recognition.item_type || null,
    package_text: recognition.package_text || null,
    flavor_or_variant: recognition.flavor_or_variant || null,
    size_or_count: recognition.size_or_count || null,
    brand_visible: recognition.brand_visible || null,
    recognition: Object.keys(recognition).length ? recognition : null,
    status: 'active',
  }).select().single();
  if (insErr) throw new Error(`publish insert: ${insErr.message}`);

  // Safety check: if the confirm-gate trigger downgraded status (e.g. missing confirmed_at race),
  // the insert may have landed as 'draft'. Surface this loudly.
  if ((prod as any).status !== 'active') {
    throw new Error(`publish failed exactness gate: row landed as status=${(prod as any).status}`);
  }

  try {
    await sb.from('marketplace_inventory').insert({
      product_id: prod.id,
      wholesaler_id: wholesalerProfileId,
      quantity_on_hand: typeof draft.inventory_qty === 'number' ? draft.inventory_qty : 0,
      quantity_reserved: 0,
    }).select().maybeSingle();
  } catch (_e) { /* inventory row is best-effort — never fail a successful publish */ }

  await sb.from('dd_catalog_drafts').update({
    status: 'published',
    published_product_id: prod.id,
  }).eq('id', draft_id);

  return { product_id: prod.id, images_count: images.length, hero: images[0] };
}

/**
 * Resolve whatever supplier id a draft is carrying into a valid
 * wholesaler_profiles.id (the FK target of products_all.wholesaler_id).
 *
 * Accepts either a wholesaler_profiles.id (pass-through) or a legacy
 * wholesalers.id, which is bridged through wholesaler_profiles.wholesaler_id.
 */
async function resolveWholesalerProfileId(sb: any, supplierId: string): Promise<string> {
  const { data: direct } = await sb
    .from('wholesaler_profiles').select('id').eq('id', supplierId).maybeSingle();
  if (direct?.id) return direct.id;

  const { data: bridged } = await sb
    .from('wholesaler_profiles').select('id').eq('wholesaler_id', supplierId).maybeSingle();
  if (bridged?.id) return bridged.id;

  const { data: legacy } = await sb
    .from('wholesalers').select('name').eq('id', supplierId).maybeSingle();
  throw new Error(
    `cannot publish: supplier ${legacy?.name ? `"${legacy.name}" ` : ''}(${supplierId}) has no ` +
    `Dynasty Direct wholesaler profile. Create/link one before publishing.`,
  );
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

// ---------- new modes: price research, vision recognize, image standardize ----------

async function runPriceResearch(body: any) {
  const { draft_id, product_name, category, supplier_cost } = body;
  if (!product_name) throw new Error('product_name required');
  const cost = Number(supplier_cost) || 0;
  const hasCost = cost > 0;

  const system = 'You are a pricing analyst for a wholesale-to-retail business. Output STRICT JSON only.';
  const user = `Product: ${product_name}
Category: ${category || 'unknown'}
Supplier cost: ${hasCost ? '$' + cost.toFixed(2) : 'NOT PROVIDED'}

Research this product and provide a best-effort competitive pricing snapshot for the US market.

Return ONLY this JSON (numbers, no $ signs):
{
  "amazon_price": 0.00,
  "walmart_price": 0.00,
  "competitor_avg": 0.00,
  "suggested_store_price": 0.00,
  "suggested_retail_price": 0.00,
  "store_margin_pct": 0,
  "retail_margin_pct": 0,
  "pricing_notes": "brief explanation${hasCost ? '' : '. No supplier cost provided — margin calculations approximate'}"
}

Pricing rules:
- store_price = wholesale-to-store price (typically cost × 1.5 to cost × 2.5)
- retail_price = direct-to-consumer (typically cost × 2.5 to cost × 4)
- If cost not provided, infer a reasonable cost from competitor data and compute margins from that inference.`;

  const raw = await geminiText(system, user);
  const parsed = parseJson(raw);

  // Normalize the AI category onto the products_all check-constraint values now,
  // so the wizard shows (and the publish insert receives) a legal slug.
  const catMap = mapDdCategory(parsed.category_guess, [product_name, brand_hint, (parsed.tags || []).join(' ')].filter(Boolean).join(' '));
  parsed.category_guess = catMap.category;
  parsed.category_source = catMap.method;
  parsed.category_raw = catMap.raw;
  const payload = {
    amazon_price: Number(parsed.amazon_price) || 0,
    walmart_price: Number(parsed.walmart_price) || 0,
    competitor_avg: Number(parsed.competitor_avg) || 0,
    suggested_store_price: Number(parsed.suggested_store_price) || 0,
    suggested_retail_price: Number(parsed.suggested_retail_price) || 0,
    store_margin_pct: Number(parsed.store_margin_pct) || 0,
    retail_margin_pct: Number(parsed.retail_margin_pct) || 0,
    pricing_notes: String(parsed.pricing_notes || ''),
    cost_basis: cost,
    researched_at: new Date().toISOString(),
  };
  if (draft_id) {
    await sbAdmin().from('dd_catalog_drafts').update({ price_research: payload }).eq('id', draft_id);
  }
  return payload;
}

async function runRecognizeProduct(body: any) {
  const { draft_id, photo_url } = body;
  if (!photo_url) throw new Error('photo_url required');
  const dataUrl = await fetchAsDataUrl(photo_url);
  const visionPrompt = `Look CLOSELY at this product image. Extract concrete, visible details — read text on the package, note flavor/variant, size/count, and brand marks. Do NOT invent details you can't see.

Return ONLY this JSON:
{
  "product_name": "string — the specific product name as it reads on the package",
  "category": "string",
  "key_features": ["string","string","string"],
  "item_type": "bulk|single",
  "package_text": "string — any distinctive text/tagline/branding visible on packaging (empty string if none)",
  "flavor_or_variant": "string — the specific flavor, scent, color, style or variant if visible (empty string if none)",
  "size_or_count": "string — visible size, weight, count, volume, or pack quantity (e.g. '5-pack', '12 oz', '100 ct') (empty string if none)",
  "brand_visible": "string — brand name exactly as printed (empty string if none)",
  "confidence": "low|medium|high"
}`;
  const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: visionPrompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
    }),
  });
  if (!r.ok) throw new Error(`vision recognize ${r.status} ${await r.text()}`);
  const j = await r.json();
  const parsed = parseJson(j.choices?.[0]?.message?.content ?? '');
  const payload = {
    product_name: String(parsed.product_name || ''),
    category: String(parsed.category || ''),
    key_features: Array.isArray(parsed.key_features) ? parsed.key_features.slice(0, 5) : [],
    item_type: parsed.item_type === 'single' ? 'single' : 'bulk',
    package_text: String(parsed.package_text || ''),
    flavor_or_variant: String(parsed.flavor_or_variant || ''),
    size_or_count: String(parsed.size_or_count || ''),
    brand_visible: String(parsed.brand_visible || ''),
    confidence: parsed.confidence || 'medium',
    recognized_at: new Date().toISOString(),
  };
  if (draft_id) {
    await sbAdmin().from('dd_catalog_drafts').update({ recognition: payload }).eq('id', draft_id);
  }
  return payload;
}

async function runStandardizeImage(body: any) {
  const { draft_id, photo_url } = body;
  if (!photo_url) throw new Error('photo_url required');
  const id = draft_id || crypto.randomUUID();
  const variants: { size: string; url: string }[] = [{ size: 'original', url: photo_url }];

  // 1) Background removal via Remove.bg (optional)
  let cleanUrl = '';
  if (REMOVEBG_API_KEY) {
    try {
      const fd = new FormData();
      fd.append('image_url', photo_url);
      fd.append('size', 'auto');
      fd.append('bg_color', 'ffffff');
      const rb = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': REMOVEBG_API_KEY },
        body: fd,
      });
      if (!rb.ok) {
        console.warn('remove.bg failed', rb.status, await rb.text());
      } else {
        const buf = new Uint8Array(await rb.arrayBuffer());
        cleanUrl = await uploadPng(buf, `dd-catalog/${id}/clean-${Date.now()}.png`);
        variants.push({ size: 'clean', url: cleanUrl });
      }
    } catch (e) {
      console.warn('remove.bg error', e);
    }
  } else {
    console.log('Background removal skipped — add REMOVEBG_API_KEY to Vault');
  }

  // 2) Card (800) + thumb (400) variants via ImageScript
  const sourceUrl = cleanUrl || photo_url;
  try {
    const { Image } = await import('https://deno.land/x/imagescript@1.2.17/mod.ts');
    const src = await fetch(sourceUrl);
    const bytes = new Uint8Array(await src.arrayBuffer());
    const img = await Image.decode(bytes);
    const card = img.clone().resize(800, Image.RESIZE_AUTO);
    const cardBytes = await card.encode();
    const cardUrl = await uploadPng(cardBytes, `dd-catalog/${id}/card-${Date.now()}.png`);
    variants.push({ size: 'card', url: cardUrl });
    const thumb = img.clone().resize(400, Image.RESIZE_AUTO);
    const thumbBytes = await thumb.encode();
    const thumbUrl = await uploadPng(thumbBytes, `dd-catalog/${id}/thumb-${Date.now()}.png`);
    variants.push({ size: 'thumb', url: thumbUrl });
  } catch (e) {
    console.warn('image variant generation failed', e);
  }

  if (draft_id) {
    await sbAdmin().from('dd_catalog_drafts').update({ image_variants: variants }).eq('id', draft_id);
  }
  return { variants, removebg_used: !!cleanUrl };
}

// ---------- entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const mode = body.mode as string;
    const privileged = await callerIsPrivileged(req);
    let result: any;
    switch (mode) {
      case 'enhance':                result = await runEnhance(body); break;
      case 'stage':                  result = await runStage(body); break;
      case 'copy_pricing':           result = await runCopyPricing(body, privileged); break;
      case 'market_check':           result = await runMarketCheck(body); break;
      case 'estimate_measurements':  result = await runEstimateMeasurements(body); break;
      // price_research returns retail margin math — admin/owner only.
      case 'price_research':
        if (!privileged) throw new Error('forbidden: pricing research is admin-only');
        result = await runPriceResearch(body);
        break;
      case 'recognize_product':      result = await runRecognizeProduct(body); break;
      case 'standardize_image':      result = await runStandardizeImage(body); break;
      case 'publish':                result = await runPublish(body); break;
      case 'content_factory':        result = await runContentFactory(body); break;
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
