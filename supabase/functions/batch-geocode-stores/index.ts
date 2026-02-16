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

function isInvalidAddress(street: string | null): boolean {
  if (!street) return true;
  const trimmed = street.trim();
  if (trimmed.length <= 1) return true;
  return INVALID_ADDRESS_PATTERNS.some(p => p.test(trimmed));
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

    // Parse optional body
    let revalidate = false;
    try {
      const body = await req.json();
      revalidate = body?.revalidate === true;
    } catch {
      // No body or invalid JSON — default revalidate=false
    }

    // Build query
    let query = supabase
      .from('stores')
      .select('id, name, address_street, address_city, address_state, address_zip, address_country')
      .not('address_street', 'is', null)
      .limit(1000);

    if (!revalidate) {
      query = query.or('lat.is.null,lng.is.null');
    }

    const { data: stores, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch stores: ${fetchError.message}`);
    }

    if (!stores || stores.length === 0) {
      return new Response(
        JSON.stringify({ success: true, geocoded: 0, failed: 0, skipped: 0, total: 0, message: 'No stores to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let geocoded = 0;
    let failed = 0;
    let skipped = 0;
    const batchSize = 50;

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
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&country=us`;

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
            // Flag as unverified
            await supabase
              .from('stores')
              .update({ address_country: 'UNVERIFIED' })
              .eq('id', store.id);
            failed++;
            continue;
          }

          const feature = data.features[0];
          const [lng, lat] = feature.center;

          // Parse normalized address from Mapbox response
          const normalizedStreet = feature.address
            ? `${feature.address} ${feature.text}`
            : feature.text || store.address_street;

          let normalizedCity = store.address_city || null;
          let normalizedState = store.address_state || null;
          let normalizedZip = store.address_zip || null;

          if (feature.context) {
            for (const ctx of feature.context) {
              if (ctx.id?.startsWith('place')) normalizedCity = normalizedCity || ctx.text;
              if (ctx.id?.startsWith('region')) normalizedState = normalizedState || ctx.text;
              if (ctx.id?.startsWith('postcode')) normalizedZip = normalizedZip || ctx.text;
            }
          }

          // Update store with normalized address + coordinates
          const { error: updateError } = await supabase
            .from('stores')
            .update({
              lat,
              lng,
              address_street: normalizedStreet,
              address_city: normalizedCity,
              address_state: normalizedState,
              address_zip: normalizedZip,
              address_country: 'USA',
            })
            .eq('id', store.id);

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
        skipped,
        total: stores.length,
        message: `Validated ${geocoded} stores, ${failed} failed, ${skipped} skipped (invalid address), out of ${stores.length} total`,
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
