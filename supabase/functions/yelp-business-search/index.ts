import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const YELP_BASE = 'https://api.yelp.com/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const YELP_API_KEY = Deno.env.get('YELP_API_KEY');
    if (!YELP_API_KEY) {
      throw new Error('YELP_API_KEY is not configured');
    }

    const { action, term, location, business_id, limit } = await req.json();
    const headers = {
      'Authorization': `Bearer ${YELP_API_KEY}`,
      'Accept': 'application/json',
    };

    let result: any;

    if (action === 'search') {
      if (!term || !location) {
        throw new Error('search requires term and location');
      }
      const params = new URLSearchParams({
        term,
        location,
        limit: String(limit || 20),
        sort_by: 'best_match',
      });
      const resp = await fetch(`${YELP_BASE}/businesses/search?${params}`, { headers });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Yelp search failed [${resp.status}]: ${err}`);
      }
      result = await resp.json();

    } else if (action === 'details') {
      if (!business_id) throw new Error('details requires business_id');
      const resp = await fetch(`${YELP_BASE}/businesses/${encodeURIComponent(business_id)}`, { headers });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Yelp details failed [${resp.status}]: ${err}`);
      }
      result = await resp.json();

    } else if (action === 'reviews') {
      if (!business_id) throw new Error('reviews requires business_id');
      const params = new URLSearchParams({
        limit: String(limit || 3),
        sort_by: 'yelp_sort',
      });
      const resp = await fetch(`${YELP_BASE}/businesses/${encodeURIComponent(business_id)}/reviews?${params}`, { headers });
      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Yelp reviews failed [${resp.status}]: ${err}`);
      }
      result = await resp.json();

    } else {
      throw new Error(`Unknown action: ${action}. Use search, details, or reviews.`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('yelp-business-search error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
