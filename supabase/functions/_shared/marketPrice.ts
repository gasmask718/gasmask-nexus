// Shared market-price lookup (SerpAPI Google Shopping).
//
// Single source of truth for: key resolution, shopping search, bundle exclusion,
// title relevance filtering and outlier trimming. Consumed by
//   - dd-price-intelligence  (Check Market Price / Apply Sweet Spot on the Pricing page)
//   - dd-catalog-pipeline    (AI Catalog Wizard: market_check + copy_pricing)
// so both surfaces produce identical numbers for the same product.

export interface SerpResult { source: string; price: number; url: string | null; title: string }

/** Minimum number of apples-to-apples listings before we call a lookup market-informed. */
export const MIN_COMPARABLE_LISTINGS = 2;

/** Titles scoring below this share of product tokens are dropped as irrelevant. */
export const RELEVANCE_THRESHOLD = 0.6;

export interface MarketLookup {
  available: boolean;
  reason?: string;
  query: string;
  low: number | null;
  median: number | null;
  high: number | null;
  avg: number | null;
  count: number;
  samples_raw: number;
  excluded: { bundles: number; low_relevance: number; pack_mismatch: number; outliers: number };
  /** true only when enough same-pack-size listings survived to be a fair comparison. */
  comparable: boolean;
  /** Pack size (units per listing) the comparison was normalized to. */
  pack_size: number;
  samples: { title: string; price: number; source: string; link: string | null }[];
  checked_at: string;
}

/**
 * Key resolution order: dd_ai_config.serpapi_key → SERPAPI_KEY env → null.
 * The DB row is the primary source; the env secret is a fallback so a
 * deployment can override without a DB write.
 */
export async function resolveSerpApiKey(supabase: any): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('dd_ai_config')
      .select('serpapi_key')
      .eq('id', 1)
      .maybeSingle();
    const k = (data as any)?.serpapi_key;
    if (typeof k === 'string' && k.length > 0) return k;
  } catch (_) { /* fall through to env */ }
  const env = Deno.env.get('SERPAPI_KEY');
  return env && env.length > 0 ? env : null;
}

export function parsePrice(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const n = Number(s);
  return isFinite(n) && n > 0 ? n : null;
}

// Tighter IQR trim (1.0 instead of 1.5) so bundle/variety-pack outliers don't
// skew the average as heavily. Also does a first-pass median-ratio trim to
// handle small sample sizes where IQR alone can't kill a single wild value.
export function trimOutliers(prices: number[]): number[] {
  if (prices.length < 2) return prices.slice();
  const sorted0 = prices.slice().sort((a, b) => a - b);
  const median = sorted0[Math.floor(sorted0.length / 2)];
  const preTrimmed = sorted0.filter((p) => p >= median * 0.25 && p <= median * 4);
  if (preTrimmed.length < 4) return preTrimmed;
  const s = preTrimmed;
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.0 * iqr;
  const hi = q3 + 1.0 * iqr;
  return s.filter((p) => p >= lo && p <= hi);
}

// Terms that almost always indicate a bundle / variety pack / multi-unit listing.
export const BUNDLE_EXCLUSIONS = [
  'variety pack', 'variety-pack', 'assortment', 'assorted', 'sampler',
  'bundle', 'combo', 'multi-pack', 'multipack', 'gift set', 'gift box',
  'wholesale lot', 'case of', 'display box', 'full case', 'bulk lot',
  'carton of', 'x pack', ' pk ', ' pcs', ' pieces', ' count', 'ct pack',
];

// Stop words only. Do NOT add category words like "paper" or "roll" — those are
// often the most discriminative token in a product name.
const STOP_TOKENS = new Set([
  'the', 'a', 'an', 'of', 'and', 'or', 'for', 'with', 'in', 'on',
  'new', 'authentic',
]);

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/** Fraction of significant product tokens present in a listing title (0–1). */
export function titleRelevance(productName: string, title: string): number {
  const pTokens = tokenize(productName).filter((t) => !STOP_TOKENS.has(t) && t.length > 1);
  if (pTokens.length === 0) return 1;
  const tTokens = new Set(tokenize(title));
  const hits = pTokens.filter((t) => {
    if (tTokens.has(t)) return true;
    if (t.endsWith('s') && tTokens.has(t.slice(0, -1))) return true;
    if (!t.endsWith('s') && tTokens.has(t + 's')) return true;
    return false;
  }).length;
  return hits / pTokens.length;
}

/**
 * Best-effort "how many retail units is this listing selling?" parser.
 *
 * Only counts BUNDLE units (packs / boxes / booklets of the product), never
 * content counts inside one pack ("32 leaves", "50 sheets") — those describe
 * the single retail unit and must not be treated as a multi-pack.
 */
export function parsePackUnits(title: string): number {
  const t = title.toLowerCase();
  const patterns: RegExp[] = [
    /(?:pack|packs|box|boxes|booklet|booklets|carton|cartons|lot|set)\s*of\s*(\d{1,4})/,
    /(\d{1,4})\s*[-\s]?(?:pack|packs|packets|booklets|boxes|box|cartons|units|ct\b|count\b)/,
    /(\d{1,4})\s*x\s*\d{1,4}\s*(?:leaves|sheets|papers)/,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 5000) return n;
    }
  }
  return 1;
}

/** Do two listings sell the same retail quantity? Allows a 1.5x fudge either way. */
export function packSizesComparable(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (lo <= 0) return false;
  return hi / lo < 1.5;
}

export async function serpApiShoppingSearch(apiKey: string, query: string): Promise<SerpResult[]> {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('engine', 'google_shopping');
  url.searchParams.set('q', query);
  url.searchParams.set('gl', 'us');
  url.searchParams.set('hl', 'en');
  url.searchParams.set('api_key', apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`serpapi_http_${res.status}`);
  const j = await res.json();
  const rows = Array.isArray(j?.shopping_results) ? j.shopping_results : [];
  const out: SerpResult[] = [];
  for (const r of rows) {
    const price = parsePrice(r?.extracted_price ?? r?.price);
    if (price == null) continue;
    out.push({
      source: String(r?.source || r?.seller || 'google_shopping').slice(0, 120),
      price,
      url: r?.product_link || r?.link || null,
      title: String(r?.title || '').slice(0, 300),
    });
  }
  return out;
}

/** Build the shopping query the same way on every surface. */
export function buildMarketQuery(productName: string | null, brandHint?: string | null): string {
  const nameRaw = (productName ?? '').trim();
  const brandRaw = (brandHint ?? '').trim();
  const brandPart = brandRaw && !nameRaw.toLowerCase().includes(brandRaw.toLowerCase())
    ? `${brandRaw} `
    : '';
  return (brandPart + nameRaw).trim() || nameRaw;
}

/**
 * Apply bundle + relevance + pack-size filtering, then trim price outliers.
 *
 * Pack-size awareness: a single-pack product must never be priced against a
 * 50-pack listing. We infer the product's own pack size from its name (default
 * 1 unit) and drop every listing selling a materially different quantity.
 */
export function filterAndTrim(productName: string, rawResults: SerpResult[]) {
  const targetUnits = parsePackUnits(productName || '');
  let bundles = 0;
  let lowRelevance = 0;
  let packMismatch = 0;
  const filtered: (SerpResult & { pack_units: number })[] = [];
  for (const r of rawResults) {
    const titleLc = r.title.toLowerCase();
    if (BUNDLE_EXCLUSIONS.some((t) => titleLc.includes(t))) { bundles++; continue; }
    if (productName && titleRelevance(productName, r.title) < RELEVANCE_THRESHOLD) { lowRelevance++; continue; }
    const units = parsePackUnits(r.title);
    if (!packSizesComparable(units, targetUnits)) { packMismatch++; continue; }
    filtered.push({ ...r, pack_units: units });
  }
  const rawPrices = filtered.map((r) => r.price);
  const prices = trimOutliers(rawPrices);
  return {
    filtered,
    prices,
    target_units: targetUnits,
    excluded: { bundles, low_relevance: lowRelevance, pack_mismatch: packMismatch, outliers: rawPrices.length - prices.length },
  };
}

/**
 * Non-persisting market lookup used by the catalog wizard.
 * Never throws for expected conditions — returns { available: false, reason }.
 */
export async function lookupMarket(
  supabase: any,
  productName: string,
  brandHint?: string | null,
): Promise<MarketLookup> {
  const base: MarketLookup = {
    available: false, query: '', low: null, median: null, high: null, avg: null,
    count: 0, samples_raw: 0,
    excluded: { bundles: 0, low_relevance: 0, pack_mismatch: 0, outliers: 0 },
    comparable: false, pack_size: 1,
    samples: [], checked_at: new Date().toISOString(),
  };

  const key = await resolveSerpApiKey(supabase);
  if (!key) return { ...base, reason: 'SerpAPI key not configured' };

  const query = buildMarketQuery(productName, brandHint);
  if (!query) return { ...base, reason: 'no product name' };

  let raw: SerpResult[];
  try {
    raw = await serpApiShoppingSearch(key, query);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...base, query, reason: msg.includes('429') ? 'SerpAPI quota exhausted' : msg };
  }

  const { filtered, prices, excluded, target_units } = filterAndTrim(productName, raw);
  if (prices.length === 0) {
    return {
      ...base, available: true, query, samples_raw: raw.length, excluded,
      pack_size: target_units, reason: 'no comparable listings after bundle/pack-size filtering',
    };
  }

  const sorted = prices.slice().sort((a, b) => a - b);
  const avg = sorted.reduce((s, p) => s + p, 0) / sorted.length;
  const r2 = (n: number) => Number(n.toFixed(2));

  const comparable = sorted.length >= MIN_COMPARABLE_LISTINGS;

  return {
    available: true,
    reason: comparable
      ? undefined
      : `only ${sorted.length} comparable listing(s) — below the ${MIN_COMPARABLE_LISTINGS} needed for a fair comparison`,
    comparable,
    pack_size: target_units,
    query,
    low: r2(sorted[0]),
    median: r2(sorted[Math.floor(sorted.length / 2)]),
    high: r2(sorted[sorted.length - 1]),
    avg: r2(avg),
    count: sorted.length,
    samples_raw: raw.length,
    excluded,
    samples: filtered.slice(0, 8).map((r) => ({ title: r.title, price: r.price, source: r.source, link: r.url })),
    checked_at: new Date().toISOString(),
  };
}
