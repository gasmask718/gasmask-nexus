// Shared SOURCED shipping-spec lookup (SerpAPI).
//
// Purpose: replace the LLM "guess the weight from a photo" path with numbers we
// can point at. Every weight / dimension returned here carries the verbatim text
// it was read from plus the URL it came from. If nothing sourced is found we say
// so (status = needs_measurement) and suggest a box from dd_box_sizes — we never
// fabricate a number.
//
// Sources, in order:
//   1. google_shopping → product_id → google_product  (structured spec panels)
//   2. google web search "<name> item weight dimensions" (organic snippets,
//      answer box, knowledge graph)
//
// Consumed by dd-catalog-pipeline (estimate_measurements mode).

import {
  resolveSerpApiKey,
  titleRelevance,
  RELEVANCE_THRESHOLD,
  parseExplicitUnitCount,
  packSizesComparable,
  buildCaseQueries,
} from './marketPrice.ts';

export type SpecStatus = 'sourced' | 'needs_measurement' | 'unavailable';

/**
 * What quantity does the SOURCE LISTING describe, relative to what we're selling?
 *  pack_match     — source states a count comparable to targetUnits
 *  single_unit    — source states/implies one retail unit
 *  count_mismatch — source states a different explicit count
 *  count_unknown  — source states no count at all
 */
export type QuantityClass = 'pack_match' | 'single_unit' | 'count_mismatch' | 'count_unknown';

/** How a value was arrived at. Never let an estimate look like a same-quantity source. */
export type WeightBasis = 'same_quantity_sourced' | 'estimated_from_single_unit_weight' | 'unverified_quantity';
export type DimensionBasis = 'same_quantity_sourced' | 'unverified_quantity';

export interface SpecEvidence {
  verbatim: string;
  source_url: string | null;
  source_title: string | null;
  via: 'google_product' | 'web_search';
  /** Unit count parsed from the source listing TITLE (null = not stated). */
  source_units?: number | null;
  quantity_class?: QuantityClass;
}

export interface SourcedWeight extends SpecEvidence {
  weight_oz: number;
  raw_value: number;
  raw_unit: string;
  /** Present when weight_oz was scaled up from a single-unit reading. */
  basis?: WeightBasis;
  unit_weight_oz?: number;
  multiplied_by?: number;
}

export interface SourcedDims extends SpecEvidence {
  length_in: number;
  width_in: number;
  height_in: number;
  raw_unit: string;
  basis?: DimensionBasis;
}

export interface SuggestedBox {
  box_id: string;
  box_name: string;
  length_in: number;
  width_in: number;
  height_in: number;
  max_weight_oz: number | null;
  reason: string;
}

export interface SourcedSpecs {
  status: SpecStatus;
  reason?: string;
  query: string;
  /** Pack/case quantity we are pricing & shipping (null = unknown). */
  target_units: number | null;
  weight: SourcedWeight | null;
  dimensions: SourcedDims | null;
  weight_basis: WeightBasis | null;
  dimension_basis: DimensionBasis | null;
  /** Dimensions are gated harder than weight, so they carry their own status. */
  dimensions_status: 'sourced' | 'needs_measurement';
  /** All candidate readings (agreeing + disagreeing) for audit. */
  weight_candidates: SourcedWeight[];
  dimension_candidates: SourcedDims[];
  /** Number of independent sources that agreed with the chosen value. */
  weight_agreement: number;
  dimension_agreement: number;
  confidence: 'low' | 'medium' | 'high';
  suggested_box: SuggestedBox | null;
  sources_consulted: { via: 'google_product' | 'web_search'; url: string | null; title: string | null }[];
  checked_at: string;
}


const OZ_PER: Record<string, number> = {
  oz: 1, ounce: 1, ounces: 1,
  lb: 16, lbs: 16, pound: 16, pounds: 16,
  kg: 35.27396, kilogram: 35.27396, kilograms: 35.27396,
  g: 0.03527396, gram: 0.03527396, grams: 0.03527396,
};
const IN_PER: Record<string, number> = {
  in: 1, inch: 1, inches: 1, '"': 1, '”': 1,
  cm: 0.393701, centimeter: 0.393701, centimeters: 0.393701,
  mm: 0.0393701, millimeter: 0.0393701, millimeters: 0.0393701,
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// Weight must be labelled as a weight — "12 oz" alone is usually net contents.
const WEIGHT_RE =
  /(?:item\s+weight|shipping\s+weight|product\s+weight|package\s+weight|gross\s+weight|net\s+weight|weight)\s*[:\-–]?\s*(?:approx\.?|about)?\s*(\d+(?:\.\d+)?)\s*(oz|ounces?|lbs?|pounds?|kg|kilograms?|g|grams?)\b/gi;

// L x W x H with a trailing unit. Accepts in / inches / " / cm / mm.
const DIMS_RE =
  /(\d+(?:\.\d+)?)\s*(?:in|inches|"|”|cm|mm)?\s*[x×✕]\s*(\d+(?:\.\d+)?)\s*(?:in|inches|"|”|cm|mm)?\s*[x×✕]\s*(\d+(?:\.\d+)?)\s*(in|inches|"|”|cm|mm)\b/gi;

function ozFrom(v: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (!(u in OZ_PER) || !Number.isFinite(v) || v <= 0) return null;
  return r2(v * OZ_PER[u]);
}
function inFrom(v: number, unit: string): number | null {
  const u = unit.toLowerCase();
  if (!(u in IN_PER) || !Number.isFinite(v) || v <= 0) return null;
  return r2(v * IN_PER[u]);
}

function extractWeights(text: string, ev: Omit<SpecEvidence, 'verbatim'>): SourcedWeight[] {
  const out: SourcedWeight[] = [];
  for (const m of text.matchAll(WEIGHT_RE)) {
    const oz = ozFrom(Number(m[1]), m[2]);
    if (oz == null || oz > 16 * 150) continue; // >150 lb is not a parcel
    out.push({ ...ev, verbatim: m[0].trim().slice(0, 160), weight_oz: oz, raw_value: Number(m[1]), raw_unit: m[2].toLowerCase() });
  }
  return out;
}

function extractDims(text: string, ev: Omit<SpecEvidence, 'verbatim'>): SourcedDims[] {
  const out: SourcedDims[] = [];
  for (const m of text.matchAll(DIMS_RE)) {
    const unit = m[4];
    const a = inFrom(Number(m[1]), unit), b = inFrom(Number(m[2]), unit), c = inFrom(Number(m[3]), unit);
    if (a == null || b == null || c == null) continue;
    if (Math.max(a, b, c) > 108) continue; // carrier max length
    const [l, w, h] = [a, b, c].sort((x, y) => y - x); // normalise L ≥ W ≥ H
    out.push({ ...ev, verbatim: m[0].trim().slice(0, 160), length_in: l, width_in: w, height_in: h, raw_unit: unit.toLowerCase() });
  }
  return out;
}

/** Flatten every string in a JSON blob into one text so spec panels of any shape are searchable. */
function flattenStrings(v: unknown, acc: string[] = [], depth = 0): string[] {
  if (depth > 8 || v == null) return acc;
  if (typeof v === 'string') { acc.push(v); return acc; }
  if (typeof v === 'number') { acc.push(String(v)); return acc; }
  if (Array.isArray(v)) { for (const x of v) flattenStrings(x, acc, depth + 1); return acc; }
  if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      // Keep key/value adjacency so "Weight" : "3.2 oz" matches the labelled regex.
      if (typeof x === 'string' || typeof x === 'number') acc.push(`${k}: ${x}`);
      else flattenStrings(x, acc, depth + 1);
    }
  }
  return acc;
}

async function serp(params: Record<string, string>, apiKey: string): Promise<any> {
  const url = new URL('https://serpapi.com/search.json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('gl', 'us');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`serpapi_http_${res.status}`);
  return await res.json();
}

/** Pick the value most sources agree on (±10 %); returns [value, agreementCount]. */
function consensus<T>(items: T[], key: (t: T) => number): [T | null, number] {
  if (items.length === 0) return [null, 0];
  let best: T | null = null, bestN = 0;
  for (const cand of items) {
    const v = key(cand);
    const n = items.filter((o) => Math.abs(key(o) - v) / v <= 0.1).length;
    if (n > bestN) { best = cand; bestN = n; }
  }
  return [best, bestN];
}

export async function suggestBox(supabase: any, weightOz: number | null, reason: string): Promise<SuggestedBox | null> {
  const { data } = await supabase
    .from('dd_box_sizes')
    .select('id, box_name, length_in, width_in, height_in, max_weight_oz, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  const rows = (data || []) as any[];
  if (!rows.length) return null;
  // Smallest by volume that can carry the known weight (if any).
  const fits = rows
    .filter((b) => weightOz == null || b.max_weight_oz == null || Number(b.max_weight_oz) >= weightOz)
    .sort((a, b) => (a.length_in * a.width_in * a.height_in) - (b.length_in * b.width_in * b.height_in));
  const b = fits[0] || rows[0];
  return {
    box_id: b.id, box_name: b.box_name,
    length_in: Number(b.length_in), width_in: Number(b.width_in), height_in: Number(b.height_in),
    max_weight_oz: b.max_weight_oz == null ? null : Number(b.max_weight_oz),
    reason,
  };
}

/**
 * Look up sourced shipping specs. Never throws for expected conditions.
 */
export async function lookupSourcedSpecs(
  supabase: any,
  productName: string,
  brandHint?: string | null,
): Promise<SourcedSpecs> {
  const name = (productName || '').trim();
  const brand = (brandHint || '').trim();
  const query = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
  const base: SourcedSpecs = {
    status: 'unavailable', query, weight: null, dimensions: null,
    weight_candidates: [], dimension_candidates: [], weight_agreement: 0, dimension_agreement: 0,
    confidence: 'low', suggested_box: null, sources_consulted: [], checked_at: new Date().toISOString(),
  };
  if (!query) return { ...base, reason: 'no product name' };

  const key = await resolveSerpApiKey(supabase);
  if (!key) return { ...base, reason: 'SerpAPI key not configured' };

  const weights: SourcedWeight[] = [];
  const dims: SourcedDims[] = [];
  const consulted: SourcedSpecs['sources_consulted'] = [];
  let quotaHit = false;

  // ── 1. Google Shopping → product spec panels ─────────────────────────────
  try {
    const shop = await serp({ engine: 'google_shopping', q: query }, key);
    const results: any[] = Array.isArray(shop?.shopping_results) ? shop.shopping_results : [];
    const relevant = results
      .filter((r) => r?.product_id && titleRelevance(query, String(r?.title || '')) >= RELEVANCE_THRESHOLD)
      .slice(0, 2);
    for (const r of relevant) {
      try {
        const prod = await serp({ engine: 'google_product', product_id: String(r.product_id) }, key);
        const pr = prod?.product_results ?? {};
        const link = pr?.link || r?.product_link || r?.link || null;
        const title = pr?.title || r?.title || null;
        consulted.push({ via: 'google_product', url: link, title });
        // Spec panels appear under several keys depending on the product page.
        const text = flattenStrings({
          specs: prod?.specs_results, product_specs: pr?.specs, about: pr?.about_this_item,
          description: pr?.description, highlights: pr?.highlights, extensions: pr?.extensions,
        }).join('\n');
        const ev = { source_url: link, source_title: title, via: 'google_product' as const };
        weights.push(...extractWeights(text, ev));
        dims.push(...extractDims(text, ev));
      } catch (e) {
        if (String(e).includes('429')) quotaHit = true;
      }
    }
  } catch (e) {
    if (String(e).includes('429')) quotaHit = true;
  }

  // ── 2. Web search snippets (only if the panels didn't already give both) ─
  if (!quotaHit && (weights.length === 0 || dims.length === 0)) {
    try {
      const web = await serp({ engine: 'google', q: `${query} item weight dimensions`, num: '10' }, key);
      const blocks: { text: string; url: string | null; title: string | null }[] = [];
      if (web?.answer_box) blocks.push({ text: flattenStrings(web.answer_box).join('\n'), url: web.answer_box?.link ?? null, title: web.answer_box?.title ?? 'answer box' });
      if (web?.knowledge_graph) blocks.push({ text: flattenStrings(web.knowledge_graph).join('\n'), url: web.knowledge_graph?.source?.link ?? null, title: web.knowledge_graph?.title ?? 'knowledge graph' });
      for (const o of (Array.isArray(web?.organic_results) ? web.organic_results : []).slice(0, 10)) {
        const t = String(o?.title || '');
        if (titleRelevance(query, `${t} ${o?.snippet || ''}`) < RELEVANCE_THRESHOLD) continue;
        blocks.push({ text: flattenStrings({ title: t, snippet: o?.snippet, rich: o?.rich_snippet }).join('\n'), url: o?.link ?? null, title: t });
      }
      for (const b of blocks) {
        consulted.push({ via: 'web_search', url: b.url, title: b.title });
        const ev = { source_url: b.url, source_title: b.title, via: 'web_search' as const };
        weights.push(...extractWeights(b.text, ev));
        dims.push(...extractDims(b.text, ev));
      }
    } catch (e) {
      if (String(e).includes('429')) quotaHit = true;
    }
  }

  const [weight, wN] = consensus(weights, (w) => w.weight_oz);
  const [dimensions, dN] = consensus(dims, (d) => d.length_in * d.width_in * d.height_in);

  if (weight && dimensions) {
    const confidence = wN >= 2 && dN >= 2 ? 'high' : 'medium';
    return {
      ...base, status: 'sourced', weight, dimensions,
      weight_candidates: weights, dimension_candidates: dims,
      weight_agreement: wN, dimension_agreement: dN, confidence,
      sources_consulted: consulted,
      reason: `weight from ${wN} source(s), dimensions from ${dN} source(s)`,
    };
  }

  // Partial or nothing → needs a real measurement. Suggest a box, log why.
  const missing = [!weight && 'weight', !dimensions && 'dimensions'].filter(Boolean).join(' + ');
  const reason = quotaHit
    ? 'SerpAPI quota exhausted — no sourced specs could be fetched'
    : consulted.length === 0
      ? 'no relevant listings or pages found for this product'
      : `no sourced ${missing} found across ${consulted.length} page(s)`;
  const box = await suggestBox(supabase, weight?.weight_oz ?? null, `fallback: ${reason}`);
  return {
    ...base,
    status: quotaHit && consulted.length === 0 ? 'unavailable' : 'needs_measurement',
    reason, weight, dimensions,
    weight_candidates: weights, dimension_candidates: dims,
    weight_agreement: wN, dimension_agreement: dN, confidence: 'low',
    suggested_box: box, sources_consulted: consulted,
  };
}
