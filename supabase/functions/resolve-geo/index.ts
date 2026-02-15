import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GeoRequest {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  entity_type?: 'store' | 'influencer' | 'driver' | 'biker';
  entity_id?: string;
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
    const body: GeoRequest | GeoRequest[] = await req.json();
    const requests = Array.isArray(body) ? body : [body];

    const results = [];

    for (const request of requests) {
      const result = await resolveGeo(supabase, mapboxToken, request);
      results.push(result);
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: Array.isArray(body) ? results : results[0],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Resolve-geo error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function resolveGeo(
  supabase: any,
  mapboxToken: string,
  request: GeoRequest
) {
  const { street, city, state, postal_code, country = 'USA', entity_type, entity_id } = request;

  // Build address string
  const addressParts = [street, city, state, postal_code, country].filter(Boolean);
  if (addressParts.length === 0) {
    return { error: 'No address provided', verified: false };
  }

  const addressString = addressParts.join(', ');

  // Check cache: exact formatted_address match
  const { data: cached } = await supabase
    .from('geo_identities')
    .select('*')
    .eq('raw_input', addressString)
    .eq('verified', true)
    .limit(1)
    .maybeSingle();

  if (cached) {
    // Link entity if provided
    if (entity_type && entity_id) {
      await linkGeoToEntity(supabase, cached.id, entity_type, entity_id);
    }
    return { geo_identity: cached, source: 'cache' };
  }

  // Geocode via Mapbox
  const encodedAddress = encodeURIComponent(addressString);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxToken}&limit=1&country=us`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mapbox geocoding failed [${response.status}]: ${text}`);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    // Store unverified record for ops cleanup
    const { data: unverified } = await supabase
      .from('geo_identities')
      .insert({
        formatted_address: addressString,
        street: street || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        latitude: 0,
        longitude: 0,
        source: 'mapbox',
        verified: false,
        raw_input: addressString,
      })
      .select()
      .single();

    if (entity_type && entity_id && unverified) {
      await linkGeoToEntity(supabase, unverified.id, entity_type, entity_id);
    }

    return { error: 'Address not found', verified: false, geo_identity: unverified };
  }

  const feature = data.features[0];
  const [lng, lat] = feature.center;

  // Extract components from Mapbox context
  let resolvedCity = city || null;
  let resolvedState = state || null;
  let resolvedPostal = postal_code || null;
  let resolvedNeighborhood: string | null = null;
  let resolvedBorough: string | null = null;

  if (feature.context) {
    for (const ctx of feature.context) {
      if (ctx.id?.startsWith('neighborhood')) resolvedNeighborhood = ctx.text;
      if (ctx.id?.startsWith('locality')) resolvedBorough = ctx.text;
      if (ctx.id?.startsWith('place')) resolvedCity = resolvedCity || ctx.text;
      if (ctx.id?.startsWith('region')) resolvedState = resolvedState || ctx.text;
      if (ctx.id?.startsWith('postcode')) resolvedPostal = resolvedPostal || ctx.text;
    }
  }

  // Try to resolve region
  let regionId: string | null = null;
  let regionName: string | null = null;

  if (resolvedState) {
    const { data: region } = await supabase
      .from('regions')
      .select('id, name')
      .eq('state', resolvedState)
      .limit(1)
      .maybeSingle();

    if (region) {
      regionId = region.id;
      regionName = region.name;
    }
  }

  // Upsert geo identity
  const { data: geoIdentity, error: insertError } = await supabase
    .from('geo_identities')
    .insert({
      formatted_address: feature.place_name,
      street: street || null,
      city: resolvedCity,
      state: resolvedState,
      postal_code: resolvedPostal,
      neighborhood: resolvedNeighborhood,
      borough: resolvedBorough,
      latitude: lat,
      longitude: lng,
      region_id: regionId,
      region_name: regionName,
      source: 'mapbox',
      verified: true,
      raw_input: addressString,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Geo identity insert error:', insertError);
    throw new Error(`Failed to store geo identity: ${insertError.message}`);
  }

  // Link to entity
  if (entity_type && entity_id && geoIdentity) {
    await linkGeoToEntity(supabase, geoIdentity.id, entity_type, entity_id);
  }

  return { geo_identity: geoIdentity, source: 'mapbox' };
}

async function linkGeoToEntity(
  supabase: any,
  geoId: string,
  entityType: string,
  entityId: string
) {
  const tableMap: Record<string, string> = {
    store: 'stores',
    influencer: 'influencers',
    driver: 'drivers',
    biker: 'bikers',
  };

  const table = tableMap[entityType];
  if (!table) return;

  const { error } = await supabase
    .from(table)
    .update({ geo_id: geoId })
    .eq('id', entityId);

  if (error) {
    console.error(`Failed to link geo to ${entityType} ${entityId}:`, error);
  }
}
