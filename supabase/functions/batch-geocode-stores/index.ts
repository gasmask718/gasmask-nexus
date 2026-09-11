import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const INVALID_ADDRESS_PATTERNS = [
  /^no\s*address$/i,
  /^n\/?a$/i,
  /^none$/i,
  /^unknown$/i,
  /^tbd$/i,
  /^test$/i,
  /^\s*$/,
  /^.$/,
];

const MIN_RELEVANCE = 0.8;

type StoreRow = {
  id: string;
  name: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  address_country: string | null;
};

function isInvalidAddress(street: string | null): boolean {
  if (!street) return true;
  const trimmed = street.trim();
  if (trimmed.length <= 1) return true;
  return INVALID_ADDRESS_PATTERNS.some(p => p.test(trimmed));
}

function normalize(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isEligibleStore(store: StoreRow): boolean {
  return !isInvalidAddress(store.address_street)
    && normalize(store.address_state).length > 0
    && (normalize(store.address_city).length > 0 || normalize(store.address_zip).length > 0);
}

function getContextText(feature: any, prefix: string): string {
  if (feature?.id?.startsWith(prefix)) return feature.text || '';
  const match = feature?.context?.find((entry: any) => entry?.id?.startsWith(prefix));
  return match?.text || '';
}

function getContext(feature: any, prefix: string): any {
  if (feature?.id?.startsWith(prefix)) return feature;
  return feature?.context?.find((entry: any) => entry?.id?.startsWith(prefix));
}

function isConfidentMatch(feature: any, store: StoreRow): boolean {
  if (!feature || !Array.isArray(feature.center) || feature.center.length !== 2) return false;
  if (!feature.place_type?.includes('address') || !feature.address) return false;
  if (typeof feature.relevance !== 'number' || feature.relevance < MIN_RELEVANCE) return false;

  const region = getContext(feature, 'region');
  const resultState = normalize(region?.text);
  const resultStateCode = normalize(region?.short_code?.split('-').pop());
  const resultCity = normalize(getContextText(feature, 'place'));
  const resultZip = normalize(getContextText(feature, 'postcode'));
  const expectedState = normalize(store.address_state);
  const expectedCity = normalize(store.address_city);
  const expectedZip = normalize(store.address_zip);

  if (expectedState && resultState && expectedState !== resultState && expectedState !== resultStateCode) return false;
  if (expectedZip && resultZip && expectedZip !== resultZip) return false;
  if (!expectedZip && expectedCity && resultCity && expectedCity !== resultCity) return false;
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN');

    if (!mapboxToken) {
      throw new Error('MAPBOX_PUBLIC_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice('Bearer '.length);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'owner']);
    if (roleError || !roleRows?.length) {
      return new Response(JSON.stringify({ success: false, error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse optional body
    let revalidate = false;
    let dryRun = false;
    try {
      const body = await req.json();
      revalidate = body?.revalidate === true;
      dryRun = body?.dry_run === true;
    } catch {
      // No body or invalid JSON — default revalidate=false
    }

    // Build query
    let query = supabase
      .from('stores')
      .select('id, name, address_street, address_city, address_state, address_zip, address_country')
      .is('deleted_at', null)
      .or('is_simulation.is.null,is_simulation.eq.false')
      .or('is_test_data.is.null,is_test_data.eq.false')
      .not('address_street', 'is', null)
      .neq('address_street', '')
      .limit(1000);

    if (!revalidate) {
      query = query.or('lat.is.null,lng.is.null');
    }

    const { data: fetchedStores, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch stores: ${fetchError.message}`);
    }

    const stores = ((fetchedStores || []) as StoreRow[]).filter(isEligibleStore);

    if (stores.length === 0) {
      return new Response(
        JSON.stringify({ success: true, geocoded: 0, failed: 0, skipped: 0, total: 0, message: 'No stores to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let geocoded = 0;
    let failed = 0;
    let ambiguous = 0;
    let skipped = 0;
    const batchSize = 50;

    if (dryRun) {
      return new Response(
        JSON.stringify({ success: true, dry_run: true, eligible: stores.length, total: stores.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    for (let i = 0; i < stores.length; i += batchSize) {
      const batch = stores.slice(i, i + batchSize);

      for (const store of batch) {
        // Skip invalid addresses
        if (isInvalidAddress(store.address_street)) {
          skipped++;
          continue;
        }

        try {
          // Build address string from all available parts
          const addressParts = [
            store.address_street,
            store.address_city,
            store.address_state,
            store.address_zip,
            store.address_country || 'USA',
          ].filter(Boolean);

          if (addressParts.length < 1) {
            skipped++;
            continue;
          }

          const addressString = addressParts.join(', ');
          const encodedAddress = encodeURIComponent(addressString);
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places-permanent/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&country=us`;

          const response = await fetch(url);
          if (!response.ok) {
            const text = await response.text();
            console.error(`Mapbox error for store ${store.id}: ${text}`);
            failed++;
            continue;
          }

          const data = await response.json();

          if (!data.features || data.features.length === 0) {
            console.warn(`No geocode result for store ${store.id}: ${addressString}`);
            failed++;
            continue;
          }

          const feature = data.features[0];
          if (!isConfidentMatch(feature, store)) {
            console.warn(`Ambiguous geocode result for store ${store.id}: ${addressString}`);
            ambiguous++;
            continue;
          }
          const [lng, lat] = feature.center;
          if (typeof lat !== 'number' || typeof lng !== 'number' || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            ambiguous++;
            continue;
          }

          // Coordinates only. Preserve the canonical address and every identity/assignment field.
          const { error: updateError } = await supabase
            .from('stores')
            .update({ lat, lng })
            .eq('id', store.id)
            .or('lat.is.null,lng.is.null');

          if (updateError) {
            console.error(`Failed to update store ${store.id}:`, updateError);
            failed++;
          } else {
            geocoded++;
          }
        } catch (storeError) {
          console.error(`Error geocoding store ${store.id}:`, storeError);
          failed++;
        }
      }

      // Rate limit pause between batches
      if (i + batchSize < stores.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        geocoded,
        failed,
        ambiguous,
        skipped,
        total: stores.length,
        message: `Geocoded ${geocoded} stores, ${ambiguous} ambiguous, ${failed} failed, ${skipped} skipped, out of ${stores.length} eligible`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Batch geocode error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
