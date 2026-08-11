/**
 * dd-generate-description
 *
 * Generates AI product copy for products_all via Claude Sonnet 4.6.
 * Always returns HTTP 200 — errors are surfaced via { error } in the body,
 * matching every other DD function's contract.
 *
 * Accepts:
 *   { product_id?: uuid, name?, brand?, category?, supplier_cost?, store_price_a?, persist?: boolean }
 * If only product_id is passed, hydrates the row from products_all.
 * When persist=true, writes ai_description, ai_description_short, seo_title,
 * seo_keywords, and description_generated_at back to products_all.
 */
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { logDdError } from '../_shared/ddAlert.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;

type GenResult = {
  ai_description: string;
  ai_description_short: string;
  seo_title: string;
  seo_keywords: string[];
};

type RecognitionFacts = {
  key_features?: string[] | null;
  item_type?: string | null;
  package_text?: string | null;
  flavor_or_variant?: string | null;
  size_or_count?: string | null;
  brand_visible?: string | null;
};

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function placeholderFor(input: { name?: string; brand?: string; category?: string }): GenResult {
  const name = input.name ?? 'Product';
  const brand = input.brand ? `${input.brand} ` : '';
  const cat = input.category ?? 'accessory';
  return {
    ai_description:
      `${brand}${name} is a quality ${cat.replace(/_/g, ' ')} available through Dynasty Direct. ` +
      `Full AI-generated copy will appear once the Dynasty Direct AI key is configured. ` +
      `This placeholder ensures the product remains listable without blocking the catalog pipeline.`,
    ai_description_short: `${brand}${name} — quality ${cat.replace(/_/g, ' ')} from Dynasty Direct.`,
    seo_title: `${brand}${name} | Dynasty Direct`.slice(0, 60),
    seo_keywords: [name.toLowerCase(), cat.replace(/_/g, ' '), 'dynasty direct', 'wholesale'].filter(Boolean),
  };
}

function buildVisibleFactsBlock(r: RecognitionFacts): string {
  const lines: string[] = [];
  if (r.brand_visible) lines.push(`- Brand on package: ${r.brand_visible}`);
  if (r.package_text) lines.push(`- Text/tagline printed on package: "${r.package_text}"`);
  if (r.flavor_or_variant) lines.push(`- Flavor / variant: ${r.flavor_or_variant}`);
  if (r.size_or_count) lines.push(`- Size / count: ${r.size_or_count}`);
  if (r.item_type) lines.push(`- Item type: ${r.item_type}`);
  if (Array.isArray(r.key_features) && r.key_features.length) {
    lines.push(`- Visible features: ${r.key_features.filter(Boolean).join('; ')}`);
  }
  return lines.join('\n');
}

async function callClaude(
  apiKey: string,
  p: {
    name: string; brand?: string; category?: string;
    supplier_cost?: number; store_price_a?: number;
    recognition?: RecognitionFacts;
  },
): Promise<GenResult> {
  const factsBlock = p.recognition ? buildVisibleFactsBlock(p.recognition) : '';
  const factsSection = factsBlock
    ? `\n\nVisible on package (AI vision extracted these directly from the product photo — treat as ground truth and PREFER these concrete details over generic category language):\n${factsBlock}\n\nWrite copy that references these specific visible details (flavor, size, package text, brand) so the description clearly describes THIS product, not a generic category placeholder.`
    : '';

  const prompt = `You are writing product copy for a smoke shop / convenience wholesale catalog (Dynasty Direct).

Product:
- Name: ${p.name}
- Brand: ${p.brand ?? 'unbranded'}
- Category: ${p.category ?? 'accessories'}
${p.supplier_cost ? `- Cost: $${p.supplier_cost}` : ''}
${p.store_price_a ? `- Store price: $${p.store_price_a}` : ''}${factsSection}

Return ONLY valid JSON (no markdown fences, no prose) with these exact keys:
{
  "ai_description": "<150-250 words, benefit-led, retailer-focused, factual, no health claims — must reference the visible package details above when provided>",
  "ai_description_short": "<25-40 words>",
  "seo_title": "<50-60 chars, include product + brand>",
  "seo_keywords": ["<8-12 lowercase keywords/phrases>"]
}`;

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Claude ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const text: string = data?.content?.[0]?.text ?? '';
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(cleaned) as GenResult;

  if (!parsed.ai_description || !parsed.ai_description_short || !parsed.seo_title || !Array.isArray(parsed.seo_keywords)) {
    throw new Error('Claude returned incomplete JSON');
  }
  return parsed;
}

async function getDdAnthropicApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from('dd_ai_config')
    .select('anthropic_api_key')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    throw new Error(`dd_ai_config_read_failed: ${error.message}`);
  }

  return typeof data?.anthropic_api_key === 'string' && data.anthropic_api_key.length > 0
    ? data.anthropic_api_key
    : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if ((body as any)?.healthcheck === true) return ok({ ok: true, fn: 'dd-generate-description' });
    const {
      product_id,
      name: nameIn,
      brand: brandIn,
      category: categoryIn,
      supplier_cost: costIn,
      store_price_a: priceIn,
      persist = false,
    } = body ?? {};

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let name = nameIn;
    let brand = brandIn;
    let category = categoryIn;
    let supplier_cost = costIn;
    let store_price_a = priceIn;
    let recognition: RecognitionFacts | undefined = body?.recognition;

    if (product_id) {
      const { data, error } = await supabase
        .from('products_all')
        .select('product_name, brand, category, supplier_cost, store_price_a, key_features, item_type, package_text, flavor_or_variant, size_or_count, brand_visible')
        .eq('id', product_id)
        .maybeSingle();
      if (error) return ok({ error: error.message, product_id });
      if (!data) return ok({ error: 'product_not_found', product_id });
      name = name ?? data.product_name;
      brand = brand ?? data.brand;
      category = category ?? data.category;
      supplier_cost = supplier_cost ?? data.supplier_cost;
      store_price_a = store_price_a ?? data.store_price_a;
      if (!recognition) {
        recognition = {
          key_features: (data as any).key_features ?? null,
          item_type: (data as any).item_type ?? null,
          package_text: (data as any).package_text ?? null,
          flavor_or_variant: (data as any).flavor_or_variant ?? null,
          size_or_count: (data as any).size_or_count ?? null,
          brand_visible: (data as any).brand_visible ?? null,
        };
      }
    }

    if (!name) return ok({ error: 'name_required' });

    const apiKey = await getDdAnthropicApiKey(supabase);
    let result: GenResult;
    let usedPlaceholder = false;
    let genError: string | null = null;

    if (!apiKey) {
      result = placeholderFor({ name, brand, category });
      usedPlaceholder = true;
      genError = 'anthropic_api_key_missing';
    } else {
      try {
        result = await callClaude(apiKey, { name, brand, category, supplier_cost, store_price_a, recognition });
      } catch (e) {
        result = placeholderFor({ name, brand, category });
        usedPlaceholder = true;
        genError = (e as Error).message;
      }
    }

    if (persist && product_id) {
      const { error: upErr } = await supabase
        .from('products_all')
        .update({
          ai_description: result.ai_description,
          ai_description_short: result.ai_description_short,
          seo_title: result.seo_title,
          seo_keywords: result.seo_keywords,
          description_generated_at: new Date().toISOString(),
        })
        .eq('id', product_id);
      if (upErr) return ok({ error: upErr.message, product_id, result });
    }

    return ok({ product_id: product_id ?? null, result, placeholder: usedPlaceholder, warning: genError });
  } catch (e) {
    await logDdError({
      source: 'dd-generate-description',
      message: (e as Error).message ?? 'unknown_error',
    });
    return ok({ error: (e as Error).message ?? 'unknown_error' });
  }
});
