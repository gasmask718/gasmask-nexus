// gasmask-public-stores
// Read-only public endpoint feeding the GasMask "Where to Buy" locator.
// HARD-CODED FIELD WHITELIST. No phones, contacts, revenue, balances, notes.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
};

// Naive in-memory rate limit per IP (best-effort; resets on cold start).
const RATE_LIMIT = 60; // requests per window
const WINDOW_MS = 60_000;
const ipHits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || entry.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (rateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Whitelisted master fields only.
    const { data: masters, error } = await supabase
      .from('store_master')
      .select('id, store_name, address, city, state, zip')
      .eq('status', 'active')
      .eq('show_on_public_site', true)
      .is('deleted_at', null)
      .limit(5000);

    if (error) throw error;

    const ids = (masters ?? []).map((m: any) => m.id);
    let geoMap = new Map<string, { lat: number; lng: number }>();
    if (ids.length) {
      const { data: geos } = await supabase
        .from('stores')
        .select('id, lat, lng')
        .in('id', ids);
      for (const g of geos ?? []) {
        if (g.lat != null && g.lng != null) {
          geoMap.set(g.id, { lat: Number(g.lat), lng: Number(g.lng) });
        }
      }
    }

    const stores = (masters ?? []).map((m: any) => {
      const g = geoMap.get(m.id);
      return {
        id: m.id,
        name: m.store_name,
        address: m.address,
        city: m.city,
        state: m.state,
        zip: m.zip,
        neighborhood: m.city,
        lat: g?.lat ?? null,
        lng: g?.lng ?? null,
      };
    });

    return new Response(
      JSON.stringify({ count: stores.length, stores, updated_at: new Date().toISOString() }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=900, s-maxage=900',
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
