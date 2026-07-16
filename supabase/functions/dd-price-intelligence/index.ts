// dd-price-intelligence
// Actions: analyze | set_optimal | check_alerts
// Contract: every path returns HTTP 200. Errors → { error }. Missing key → { demo_mode: true }.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 800;

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Charm-round UP to next .49 or .99 (never below target price).
function charmRound(price: number): number {
  if (!isFinite(price) || price <= 0) return 0;
  const floor = Math.floor(price);
  const candidates = [floor + 0.49, floor + 0.99, floor + 1.49, floor + 1.99];
  for (const c of candidates) if (c >= price - 1e-9) return Math.round(c * 100) / 100;
  return Math.round((floor + 1.99) * 100) / 100;
}

function priceFromMargin(cost: number, marginPct: number): number {
  const m = Math.min(Math.max(Number(marginPct) || 0, 0), 95) / 100;
  if (m >= 1) return cost;
  return cost / (1 - m);
}

function marginPctFromPrice(price: number, cost: number): number {
  if (!price || price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

interface ProductRow {
  id: string;
  product_name: string | null;
  brand: string | null;
  category: string | null;
  supplier_cost: number | null;
  store_price_a: number | null;
  dtc_price_b: number | null;
  map_price: number | null;
  target_store_margin_pct: number | null;
  target_dtc_margin_pct: number | null;
  min_store_margin_pct: number | null;
  min_dtc_margin_pct: number | null;
}

interface SweetSpot {
  store_price: number;
  dtc_price: number;
  store_margin_pct: number;
  dtc_margin_pct: number;
  basis: 'market_avg' | 'floor_snap' | 'map_snap' | 'target_margin';
  notes: string;
}

interface Analysis {
  recommended_store_price: number;
  recommended_dtc_price: number;
  projected_store_margin_pct: number;
  projected_dtc_margin_pct: number;
  price_position: 'below_market' | 'at_market' | 'above_market' | 'unknown';
  recommendation: string;
  alert_flags: string[];
  source: 'ai' | 'placeholder';
  sweet_spot?: SweetSpot | null;
}

/**
 * Sweet-spot pricing: aim near market_avg_retail (competitive) but never
 * violate the min-margin floor or MAP. Store price stays on target-margin
 * (wholesale isn't market-comparable). Returns null if market_avg is missing.
 */
function computeSweetSpot(p: ProductRow, marketAvg: number | null): SweetSpot | null {
  const cost = Number(p.supplier_cost || 0);
  if (!cost || cost <= 0 || marketAvg == null || marketAvg <= 0) return null;

  const map = Number(p.map_price || 0);
  const minDtc = Number(p.min_dtc_margin_pct ?? 0);
  const tgtDtc = Number(p.target_dtc_margin_pct ?? 65);
  const tgtStore = Number(p.target_store_margin_pct ?? 40);

  const dtcFloor = priceFromMargin(cost, minDtc);        // lowest legal DTC by margin
  const dtcTarget = priceFromMargin(cost, tgtDtc);       // upper DTC (target margin)
  const dtcHardFloor = Math.max(dtcFloor, map);          // margin OR MAP, whichever higher

  let basis: SweetSpot['basis'] = 'market_avg';
  let dtcRaw = marketAvg;
  if (marketAvg < dtcHardFloor) {
    dtcRaw = dtcHardFloor;
    basis = map > dtcFloor ? 'map_snap' : 'floor_snap';
  } else if (marketAvg > dtcTarget) {
    // don't leave money on the table — cap at target margin
    dtcRaw = dtcTarget;
    basis = 'target_margin';
  }
  const dtc = charmRound(dtcRaw);
  const store = charmRound(priceFromMargin(cost, tgtStore));

  const dtcMargin = Number(marginPctFromPrice(dtc, cost).toFixed(2));
  const storeMargin = Number(marginPctFromPrice(store, cost).toFixed(2));

  const notes =
    basis === 'floor_snap'
      ? `Market avg $${marketAvg.toFixed(2)} is below min-margin floor $${dtcFloor.toFixed(2)}; snapped to floor.`
    : basis === 'map_snap'
      ? `Market avg $${marketAvg.toFixed(2)} is below MAP $${map.toFixed(2)}; snapped to MAP.`
    : basis === 'target_margin'
      ? `Market avg $${marketAvg.toFixed(2)} is above target-margin price $${dtcTarget.toFixed(2)}; capped at target.`
      : `Priced at market avg $${marketAvg.toFixed(2)}.`;

  return {
    store_price: store,
    dtc_price: dtc,
    store_margin_pct: storeMargin,
    dtc_margin_pct: dtcMargin,
    basis,
    notes,
  };
}

// Deterministic fallback — reads targets and MAP directly from the product row.
function placeholderAnalysis(p: ProductRow, marketAvg: number | null): Analysis {
  const cost = Number(p.supplier_cost || 0);
  const targetStore = Number(p.target_store_margin_pct ?? 40);
  const targetDtc = Number(p.target_dtc_margin_pct ?? 65);

  let store = charmRound(priceFromMargin(cost, targetStore));
  let dtc = charmRound(priceFromMargin(cost, targetDtc));

  const flags: string[] = [];
  const map = Number(p.map_price || 0);
  if (map > 0) {
    if (store < map) { store = charmRound(map); flags.push('map_enforced_store'); }
    if (dtc < map) { dtc = charmRound(map); flags.push('map_enforced_dtc'); }
  }

  let position: Analysis['price_position'] = 'unknown';
  if (marketAvg && marketAvg > 0) {
    const diff = (store - marketAvg) / marketAvg;
    position = diff < -0.05 ? 'below_market' : diff > 0.05 ? 'above_market' : 'at_market';
  }

  return {
    recommended_store_price: store,
    recommended_dtc_price: dtc,
    projected_store_margin_pct: Number(marginPctFromPrice(store, cost).toFixed(2)),
    projected_dtc_margin_pct: Number(marginPctFromPrice(dtc, cost).toFixed(2)),
    price_position: position,
    recommendation: `Deterministic pricing from row targets (store ${targetStore}% / dtc ${targetDtc}%)${map > 0 ? `, MAP ${map} enforced` : ''}.`,
    alert_flags: flags,
    source: 'placeholder',
    sweet_spot: computeSweetSpot(p, marketAvg),
  };
}

async function aiAnalysis(
  apiKey: string,
  p: ProductRow,
  marketAvg: number | null,
  marketSamples: Array<{ source: string; price: number }>,
): Promise<Analysis> {
  const payload = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: 'user',
        content:
          `You are a wholesale pricing analyst. Return PURE JSON only (no markdown, no prose).
Product: ${p.product_name} / brand ${p.brand} / category ${p.category}
Supplier cost: ${p.supplier_cost}
Current store_price_a: ${p.store_price_a}
Current dtc_price_b: ${p.dtc_price_b}
Target margins from row: store ${p.target_store_margin_pct}% / dtc ${p.target_dtc_margin_pct}%
Minimum margins from row: store ${p.min_store_margin_pct}% / dtc ${p.min_dtc_margin_pct}%
MAP price (0 = none): ${p.map_price ?? 0}
Market average: ${marketAvg ?? 'unknown'}
Market samples: ${JSON.stringify(marketSamples)}

Return JSON:
{
  "recommended_store_price": number,
  "recommended_dtc_price": number,
  "projected_store_margin_pct": number,
  "projected_dtc_margin_pct": number,
  "price_position": "below_market" | "at_market" | "above_market" | "unknown",
  "recommendation": string,
  "alert_flags": string[]
}
Rules: prices must charm-round to .49 or .99. Never go below MAP if MAP > 0. Never below min margins.`,
      },
    ],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const raw = await res.json();
  const text = raw?.content?.[0]?.text || '{}';
  const parsed = JSON.parse(text.trim().replace(/^```json\s*|\s*```$/g, ''));
  return { ...parsed, source: 'ai', sweet_spot: computeSweetSpot(p, marketAvg) } as Analysis;
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

async function getDdSerpApiKey(supabase: ReturnType<typeof createClient>): Promise<string | null> {
  const { data, error } = await supabase
    .from('dd_ai_config')
    .select('serpapi_key')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw new Error(`dd_ai_config_read_failed: ${error.message}`);
  return typeof (data as any)?.serpapi_key === 'string' && (data as any).serpapi_key.length > 0
    ? (data as any).serpapi_key
    : null;
}

function parsePrice(raw: unknown): number | null {
  if (raw == null) return null;
  const s = String(raw).replace(/[^0-9.,]/g, '').replace(/,/g, '');
  const n = Number(s);
  return isFinite(n) && n > 0 ? n : null;
}

// Robust IQR-based outlier trim so a single $1 sticker or $999 bundle can't skew the avg.
function trimOutliers(prices: number[]): number[] {
  if (prices.length < 4) return prices.slice();
  const s = prices.slice().sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return s.filter((p) => p >= lo && p <= hi);
}

interface SerpResult { source: string; price: number; url: string | null; title: string }

async function serpApiShoppingSearch(apiKey: string, query: string): Promise<SerpResult[]> {
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

async function refreshMarketForProduct(
  supabase: any,
  product: { id: string; product_name: string | null; brand: string | null },
  serpKey: string,
  queryOverride?: string,
): Promise<{ product_id: string; samples: number; avg: number | null; low: number | null; high: number | null; query: string; results: SerpResult[] }> {
  const query = (queryOverride && queryOverride.trim())
    || [product.brand, product.product_name].filter(Boolean).join(' ').trim()
    || (product.product_name ?? '');
  if (!query) return { product_id: product.id, samples: 0, avg: null, low: null, high: null, query: '', results: [] };

  const results = await serpApiShoppingSearch(serpKey, query);
  if (results.length === 0) {
    await supabase
      .from('products_all')
      .update({ market_updated_at: new Date().toISOString() })
      .eq('id', product.id);
    return { product_id: product.id, samples: 0, avg: null, low: null, high: null, query, results };
  }

  const rows = results.slice(0, 25).map((r) => ({
    product_id: product.id,
    source: r.source,
    source_url: r.url,
    price: r.price,
    price_type: 'retail',
  }));
  await supabase.from('dd_market_prices').insert(rows);

  const prices = trimOutliers(results.map((r) => r.price));
  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
  const low = Math.min(...prices);
  const high = Math.max(...prices);

  await supabase
    .from('products_all')
    .update({
      market_avg_retail: Number(avg.toFixed(2)),
      market_low_retail: Number(low.toFixed(2)),
      market_high_retail: Number(high.toFixed(2)),
      market_updated_at: new Date().toISOString(),
    })
    .eq('id', product.id);

  return {
    product_id: product.id,
    samples: prices.length,
    avg: Number(avg.toFixed(2)),
    low: Number(low.toFixed(2)),
    high: Number(high.toFixed(2)),
    query,
    results,
  };
}

async function computeAlerts(
  supabase: any,
  product: ProductRow,
): Promise<Array<Record<string, unknown>>> {
  const { data: marketRows } = await supabase
    .from('dd_market_prices')
    .select('source, price')
    .eq('product_id', product.id)
    .order('observed_at', { ascending: false })
    .limit(20);
  const samples = (marketRows || []).map((r: any) => ({ source: r.source, price: Number(r.price) }));
  const marketAvg = samples.length
    ? samples.reduce((s: number, r: any) => s + r.price, 0) / samples.length
    : null;

  const alerts: Array<Record<string, unknown>> = [];
  const cost = Number(product.supplier_cost || 0);
  const store = Number(product.store_price_a || 0);
  const dtc = Number(product.dtc_price_b || 0);
  const map = Number(product.map_price || 0);
  const minStore = Number(product.min_store_margin_pct ?? 0);
  const minDtc = Number(product.min_dtc_margin_pct ?? 0);

  if (map > 0 && store > 0 && store < map)
    alerts.push({ product_id: product.id, alert_type: 'map_violation', structure: 'store_price_a', current_price: store, recommended_price: map, message: `store_price_a $${store} below MAP $${map}` });
  if (map > 0 && dtc > 0 && dtc < map)
    alerts.push({ product_id: product.id, alert_type: 'map_violation', structure: 'dtc_price_b', current_price: dtc, recommended_price: map, message: `dtc_price_b $${dtc} below MAP $${map}` });
  if (minStore > 0 && cost > 0 && store > 0 && marginPctFromPrice(store, cost) < minStore)
    alerts.push({ product_id: product.id, alert_type: 'below_floor', structure: 'store_price_a', current_price: store, message: `store margin below floor ${minStore}%` });
  if (minDtc > 0 && cost > 0 && dtc > 0 && marginPctFromPrice(dtc, cost) < minDtc)
    alerts.push({ product_id: product.id, alert_type: 'below_floor', structure: 'dtc_price_b', current_price: dtc, message: `dtc margin below floor ${minDtc}%` });
  if (marketAvg && store > 0 && store < marketAvg * 0.85)
    alerts.push({ product_id: product.id, alert_type: 'undercut', structure: 'store_price_a', current_price: store, competitor_price: marketAvg, message: `store_price_a >15% below market avg $${marketAvg.toFixed(2)}` });

  return alerts;
}

const PRODUCT_COLS =
  'id, product_name, brand, category, supplier_cost, store_price_a, dtc_price_b, map_price, target_store_margin_pct, target_dtc_margin_pct, min_store_margin_pct, min_dtc_margin_pct';

const MARKET_STALE_DAYS = 7;
const MARKET_REFRESH_CAP_PER_RUN = 40; // hard cap so a single cron run can't burn the SerpAPI budget

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { product_id, action, query } = await req.json().catch(() => ({}));
    if (!action) return ok({ error: 'action is required' });
    if (!['analyze', 'set_optimal', 'check_alerts', 'check_all_alerts', 'refresh_market'].includes(action))
      return ok({ error: `unknown action: ${action}` });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // ============ REFRESH_MARKET (single product, on-demand) ============
    if (action === 'refresh_market') {
      if (!product_id) return ok({ error: 'product_id is required' });
      const serpKey = await getDdSerpApiKey(supabase);
      if (!serpKey) return ok({ error: 'serpapi_key not configured in dd_ai_config' });
      const { data: p, error: pErr } = await supabase
        .from('products_all')
        .select('id, product_name, brand')
        .eq('id', product_id)
        .maybeSingle();
      if (pErr) return ok({ error: pErr.message });
      if (!p) return ok({ error: 'product not found' });
      const result = await refreshMarketForProduct(supabase, p as any, serpKey, query);
      return ok({ success: true, ...result });
    }

    // ============ CHECK_ALL_ALERTS: batch across active products ============
    if (action === 'check_all_alerts') {
      let checked = 0;
      let alertsCreated = 0;
      let marketRefreshed = 0;
      const errors: Array<{ product_id: string; error: string }> = [];
      const PAGE = 1000;
      let from = 0;

      // Market-refresh phase (SerpAPI): only stale/null, hard-capped per run
      const serpKey = await getDdSerpApiKey(supabase);
      if (serpKey) {
        const cutoff = new Date(Date.now() - MARKET_STALE_DAYS * 86400_000).toISOString();
        const { data: stale } = await supabase
          .from('products_all')
          .select('id, product_name, brand, market_updated_at')
          .neq('status', 'deleted')
          .or(`market_updated_at.is.null,market_updated_at.lt.${cutoff}`)
          .order('market_updated_at', { ascending: true, nullsFirst: true })
          .limit(MARKET_REFRESH_CAP_PER_RUN);
        for (const row of stale || []) {
          try {
            await refreshMarketForProduct(supabase, row as any, serpKey);
            marketRefreshed++;
          } catch (e) {
            errors.push({ product_id: (row as any).id, error: `market_refresh: ${String((e as Error).message || e)}` });
          }
        }
      }

      while (true) {
        const { data: batch, error: bErr } = await supabase
          .from('products_all')
          .select(PRODUCT_COLS)
          .neq('status', 'deleted')
          .range(from, from + PAGE - 1);
        if (bErr) return ok({ error: bErr.message, checked, alerts_created: alertsCreated });
        if (!batch || batch.length === 0) break;

        for (const row of batch as ProductRow[]) {
          checked++;
          try {
            const alerts = await computeAlerts(supabase, row);
            if (alerts.length) {
              const { error: insErr } = await supabase.from('dd_price_alerts').insert(alerts);
              if (insErr) errors.push({ product_id: row.id, error: insErr.message });
              else alertsCreated += alerts.length;
            }
          } catch (e) {
            errors.push({ product_id: row.id, error: String((e as Error).message || e) });
          }
        }

        if (batch.length < PAGE) break;
        from += PAGE;
      }

      return ok({ ok: true, checked, alerts_created: alertsCreated, market_refreshed: marketRefreshed, errors });
    }


    // ============ Single-product actions ============
    if (!product_id) return ok({ error: 'product_id is required' });

    const { data: p, error: pErr } = await supabase
      .from('products_all')
      .select(PRODUCT_COLS)
      .eq('id', product_id)
      .maybeSingle();
    if (pErr) return ok({ error: pErr.message });
    if (!p) return ok({ error: 'product not found' });
    const product = p as ProductRow;

    // Market context (for analyze/set_optimal)
    const { data: marketRows } = await supabase
      .from('dd_market_prices')
      .select('source, price')
      .eq('product_id', product_id)
      .order('observed_at', { ascending: false })
      .limit(20);
    const samples = (marketRows || []).map((r: any) => ({ source: r.source, price: Number(r.price) }));
    const marketAvg = samples.length
      ? samples.reduce((s: number, r: any) => s + r.price, 0) / samples.length
      : null;

    if (action === 'check_alerts') {
      const alerts = await computeAlerts(supabase, product);
      if (alerts.length) {
        const { error: insErr } = await supabase.from('dd_price_alerts').insert(alerts);
        if (insErr) return ok({ error: insErr.message, alerts_detected: alerts.length });
      }
      return ok({ success: true, alerts_created: alerts.length, alerts });
    }

    // ============ ANALYZE / SET_OPTIMAL ============
    const apiKey = await getDdAnthropicApiKey(supabase);
    let analysis: Analysis;
    if (!apiKey) {
      analysis = placeholderAnalysis(product, marketAvg);
      (analysis as any).demo_mode = true;
    } else {
      try {
        analysis = await aiAnalysis(apiKey, product, marketAvg, samples);
      } catch (e) {
        analysis = placeholderAnalysis(product, marketAvg);
        (analysis as any).ai_error = String((e as Error).message || e);
      }
    }

    if (action === 'analyze') return ok({ success: true, analysis });

    const patch = {
      store_price_a: analysis.recommended_store_price,
      dtc_price_b: analysis.recommended_dtc_price,
    };
    const { error: upErr } = await supabase
      .from('products_all')
      .update(patch)
      .eq('id', product_id);
    if (upErr) return ok({ error: upErr.message, analysis });
    return ok({ success: true, applied: patch, analysis });
  } catch (e) {
    return ok({ error: String((e as Error).message || e) });
  }
});
