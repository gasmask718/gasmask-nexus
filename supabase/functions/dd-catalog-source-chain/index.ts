// Dynasty Direct — Catalog Source Chain (B1)
// Streams photo candidates for a product. Two adapters:
//   1) geminiVisionAdapter  — ACTIVE (uses LOVABLE_API_KEY)
//   2) serpApiAdapter       — DORMANT until SERPAPI_KEY exists; auto-promotes to primary when present
//
// Streams NDJSON lines: {type:'progress'|'candidate'|'done'|'error', ...}
// Candidates: { url, source, confidence, attribution, thumb? }
//
// Zero candidates is a valid outcome — the wizard's B2/B3 stages carry the gallery.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Candidate {
  url: string;
  source: string;            // 'serpapi' | 'gemini' | etc.
  confidence: number;        // 0..1
  attribution?: string;      // host/site name
  thumb?: string;
}

type SourceAdapter = {
  name: string;
  enabled: () => boolean;
  basePriority: number;      // higher = ranked first; promoted to primary if enabled
  run: (input: { product_name: string; brand_hint?: string; image_url?: string }) => Promise<Candidate[]>;
};

// --- ADAPTER 1: SerpAPI Google Images (dormant until SERPAPI_KEY exists) ---
const serpApiAdapter: SourceAdapter = {
  name: 'serpapi',
  basePriority: 100, // becomes top when SERPAPI_KEY exists
  enabled: () => !!Deno.env.get('SERPAPI_KEY'),
  run: async ({ product_name, brand_hint }) => {
    const key = Deno.env.get('SERPAPI_KEY');
    if (!key) return [];
    const q = [brand_hint, product_name].filter(Boolean).join(' ').trim();
    const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(q)}&api_key=${key}&num=12&ijn=0`;
    try {
      const r = await fetch(url);
      if (!r.ok) return [];
      const j = await r.json();
      const items = (j.images_results || []) as any[];
      return items.slice(0, 12).map((it, idx): Candidate => ({
        url: it.original || it.thumbnail,
        thumb: it.thumbnail,
        source: 'serpapi',
        confidence: Math.max(0.4, 1 - idx * 0.05),
        attribution: it.source || it.domain || '',
      })).filter(c => !!c.url);
    } catch (e) {
      console.error('[serpapi] error', e);
      return [];
    }
  },
};

// --- ADAPTER 2: Gemini vision identify → extract from public product pages ---
const geminiVisionAdapter: SourceAdapter = {
  name: 'gemini',
  basePriority: 50,
  enabled: () => !!Deno.env.get('LOVABLE_API_KEY'),
  run: async ({ product_name, brand_hint, image_url }) => {
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return [];

    // Step 1: ask Gemini to identify the product & suggest 3-6 likely product-page URLs.
    const userContent: any[] = [
      {
        type: 'text',
        text: `Identify this product. Name hint: "${product_name}"${brand_hint ? `, brand hint: "${brand_hint}"` : ''}.
Return STRICT JSON only (no prose, no markdown fences):
{
  "brand": "...",
  "product": "...",
  "variant": "...",
  "candidate_urls": ["https://...", "..."]
}
candidate_urls = up to 6 LIKELY canonical product-page URLs (manufacturer site, major retailer PDPs) where official product photos would be found. Use real domains you actually know.`,
      },
    ];
    if (image_url) {
      userContent.push({ type: 'image_url', image_url: { url: image_url } });
    }

    let identified: { brand?: string; product?: string; variant?: string; candidate_urls?: string[] } = {};
    try {
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-pro',
          messages: [
            { role: 'system', content: 'You identify retail products from photos and return strict JSON.' },
            { role: 'user', content: userContent },
          ],
        }),
      });
      if (!r.ok) {
        console.error('[gemini] identify error', r.status, await r.text());
        return [];
      }
      const j = await r.json();
      const raw = j.choices?.[0]?.message?.content ?? '{}';
      const cleaned = raw.replace(/^```json\s*|\s*```$/g, '').trim();
      identified = JSON.parse(cleaned);
    } catch (e) {
      console.error('[gemini] identify parse', e);
      return [];
    }

    const urls = (identified.candidate_urls || []).slice(0, 6);
    if (urls.length === 0) return [];

    // Step 2: fetch each candidate URL and extract og:image / JSON-LD Product.image[].
    const out: Candidate[] = [];
    await Promise.all(
      urls.map(async (u, idx) => {
        try {
          const r = await fetch(u, {
            headers: { 'User-Agent': 'Mozilla/5.0 (DynastyDirectCatalog/1.0)' },
            signal: AbortSignal.timeout(7000),
          });
          if (!r.ok) return;
          const html = await r.text();
          const found = new Set<string>();
          // og:image
          for (const m of html.matchAll(/<meta[^>]+property=["'](?:og:image|og:image:secure_url)["'][^>]+content=["']([^"']+)["']/gi)) {
            found.add(m[1]);
          }
          for (const m of html.matchAll(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["'](?:og:image|og:image:secure_url)["']/gi)) {
            found.add(m[1]);
          }
          // JSON-LD product images
          for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
            try {
              const data = JSON.parse(m[1].trim());
              const collect = (node: any) => {
                if (!node) return;
                if (Array.isArray(node)) return node.forEach(collect);
                if (typeof node === 'object') {
                  const t = node['@type'];
                  if (t === 'Product' || (Array.isArray(t) && t.includes('Product'))) {
                    const img = node.image;
                    if (typeof img === 'string') found.add(img);
                    else if (Array.isArray(img)) img.forEach((x) => typeof x === 'string' && found.add(x));
                    else if (img && typeof img === 'object' && typeof img.url === 'string') found.add(img.url);
                  }
                  Object.values(node).forEach(collect);
                }
              };
              collect(data);
            } catch { /* ignore bad JSON-LD */ }
          }
          let host = '';
          try { host = new URL(u).hostname.replace(/^www\./, ''); } catch { /* */ }
          for (const img of found) {
            const abs = img.startsWith('//') ? `https:${img}` : (img.startsWith('http') ? img : '');
            if (!abs) continue;
            out.push({
              url: abs,
              source: 'gemini',
              confidence: Math.max(0.35, 0.75 - idx * 0.08),
              attribution: host,
            });
          }
        } catch (e) {
          console.error('[gemini] extract', u, e);
        }
      })
    );
    return out;
  },
};

const SOURCE_CHAIN: SourceAdapter[] = [serpApiAdapter, geminiVisionAdapter];

function dedupeAndSort(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const dedup = cands.filter((c) => {
    const k = c.url.split('?')[0];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  // Active adapters' basePriority decides ordering; promoted source floats to top
  return dedup.sort((a, b) => {
    const pa = SOURCE_CHAIN.find((s) => s.name === a.source && s.enabled())?.basePriority ?? 0;
    const pb = SOURCE_CHAIN.find((s) => s.name === b.source && s.enabled())?.basePriority ?? 0;
    if (pa !== pb) return pb - pa;
    return b.confidence - a.confidence;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { product_name, brand_hint, image_url } = await req.json();
    if (!product_name || typeof product_name !== 'string') {
      return new Response(JSON.stringify({ error: 'product_name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const enabled = SOURCE_CHAIN.filter((s) => s.enabled());
    const promoted = [...enabled].sort((a, b) => b.basePriority - a.basePriority)[0]?.name;

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const send = (obj: unknown) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));

        send({
          type: 'progress',
          stage: 'init',
          adapters: enabled.map((a) => a.name),
          primary: promoted,
          serpapi_available: !!Deno.env.get('SERPAPI_KEY'),
        });

        const all: Candidate[] = [];
        for (const adapter of enabled) {
          send({ type: 'progress', stage: `running:${adapter.name}` });
          try {
            const found = await adapter.run({ product_name, brand_hint, image_url });
            for (const c of found) {
              all.push(c);
              send({ type: 'candidate', candidate: c });
            }
            send({ type: 'progress', stage: `done:${adapter.name}`, count: found.length });
          } catch (e) {
            send({ type: 'progress', stage: `failed:${adapter.name}`, error: String(e) });
          }
        }

        const merged = dedupeAndSort(all);
        send({ type: 'done', total_unique: merged.length, candidates: merged });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
    });
  } catch (e) {
    console.error('source-chain fatal', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
