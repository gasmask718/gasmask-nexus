import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Fetch stores with addresses but no lat/lng
    const { data: stores, error: fetchError } = await supabase
      .from('stores')
      .select('id, name, address_street, address_city, address_state, address_zip, address_country')
      .or('lat.is.null,lng.is.null')
      .not('address_street', 'is', null)
      .limit(1000);

    if (fetchError) {
      throw new Error(`Failed to fetch stores: ${fetchError.message}`);
    }

    if (!stores || stores.length === 0) {
      return new Response(
        JSON.stringify({ success: true, geocoded: 0, message: 'All stores already geocoded or no addresses found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let geocoded = 0;
    let failed = 0;
    const batchSize = 50;

    for (let i = 0; i < stores.length; i += batchSize) {
      const batch = stores.slice(i, i + batchSize);

      for (const store of batch) {
        try {
          const addressParts = [
            store.address_street,
            store.address_city,
            store.address_state,
            store.address_zip,
            store.address_country || 'USA',
          ].filter(Boolean);

          if (addressParts.length < 2) {
            failed++;
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
            failed++;
            continue;
          }

          const [lng, lat] = data.features[0].center;

          const { error: updateError } = await supabase
            .from('stores')
            .update({ lat, lng })
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
        total: stores.length,
        message: `Geocoded ${geocoded} stores, ${failed} failed, out of ${stores.length} total`,
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
