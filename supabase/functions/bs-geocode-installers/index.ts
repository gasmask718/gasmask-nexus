import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batch-geocodes BrightSun installer office addresses with Google Geocoding.
 * Internal-only. Rows are geocoded ONCE — lat/lng are cached back onto
 * bs_installers and rows already carrying a geocode_status are skipped
 * unless { revalidate: true } is passed.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const keys = [
      ['GOOGLE_PLACES_API_KEY', Deno.env.get('GOOGLE_PLACES_API_KEY')],
      ['GOOGLE_MAPS_BROWSER_KEY', Deno.env.get('GOOGLE_MAPS_BROWSER_KEY')],
      ['GOOGLE_STREETVIEW_API_KEY', Deno.env.get('GOOGLE_STREETVIEW_API_KEY')],
    ].filter(([, v]) => !!v) as [string, string][];

    // Prefer Google (approved). Fall back to Mapbox when no Google key is
    // authorised for the Geocoding API (e.g. billing disabled on the project).
    let apiKey = '';
    let keyName = '';
    const probeErrors: string[] = [];
    for (const [name, key] of keys) {
      const probe = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Denver,CO&key=${key}`).then(r => r.json());
      if (probe?.status === 'OK') { apiKey = key; keyName = name; break; }
      probeErrors.push(`${name}: ${probe?.status} ${probe?.error_message ?? ''}`.trim());
    }
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN') || '';
    const provider: 'google' | 'mapbox' = apiKey ? 'google' : 'mapbox';
    if (provider === 'mapbox') {
      if (!mapboxToken) {
        return json({ success: false, error: 'No usable geocoding provider', detail: probeErrors }, 400);
      }
      keyName = 'MAPBOX_PUBLIC_TOKEN';
      console.warn('[bs-geocode-installers] Google unavailable, using Mapbox:', probeErrors.join(' | '));
    }


    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let revalidate = false;
    let limit = 250;
    try {
      const body = await req.json();
      revalidate = body?.revalidate === true;
      if (typeof body?.limit === 'number') limit = Math.min(Math.max(body.limit, 1), 500);
    } catch { /* no body */ }

    let query = supabase
      .from('bs_installers')
      .select('id, company_name, office_address, licence_state')
      .eq('business', 'brightsun')
      .not('office_address', 'is', null)
      .neq('office_address', '')
      .limit(limit);

    if (!revalidate) query = query.is('geocode_status', null);

    const { data: rows, error } = await query;
    if (error) throw new Error(`fetch failed: ${error.message}`);
    if (!rows?.length) {
      return json({ success: true, geocoded: 0, failed: 0, remaining: 0, message: 'Nothing to geocode' });
    }

    let geocoded = 0;
    let failed = 0;

    for (const row of rows) {
      const address = [row.office_address, row.licence_state].filter(Boolean).join(', ');
      try {
        let lat: number | null = null;
        let lng: number | null = null;
        let status = 'no_match';

        if (provider === 'google') {
          const body = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=us&key=${apiKey}`,
          ).then(r => r.json());
          const loc = body?.results?.[0]?.geometry?.location;
          if (body?.status === 'OK' && loc) { lat = loc.lat; lng = loc.lng; status = 'ok'; }
          else if (body?.status !== 'ZERO_RESULTS') status = `error:${body?.status ?? 'unknown'}`;
        } else {
          const body = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=us&limit=1&access_token=${mapboxToken}`,
          ).then(r => r.json());
          const c = body?.features?.[0]?.center;
          if (Array.isArray(c)) { lng = c[0]; lat = c[1]; status = 'ok'; }
          else if (body?.message) status = `error:${String(body.message).slice(0, 60)}`;
        }

        await supabase.from('bs_installers').update({
          lat, lng, geocoded_at: new Date().toISOString(), geocode_status: status,
        }).eq('id', row.id);
        status === 'ok' ? geocoded++ : failed++;
      } catch (e) {
        await supabase.from('bs_installers').update({
          geocoded_at: new Date().toISOString(),
          geocode_status: `error:${(e as Error).message.slice(0, 60)}`,
        }).eq('id', row.id);

        failed++;
      }
      // Stay well under Google's QPS ceiling
      await new Promise(r => setTimeout(r, 25));
    }

    const { count: remaining } = await supabase
      .from('bs_installers')
      .select('id', { count: 'exact', head: true })
      .eq('business', 'brightsun')
      .is('geocode_status', null)
      .not('office_address', 'is', null);

    return json({ success: true, key: keyName, geocoded, failed, processed: rows.length, remaining: remaining ?? 0 });
  } catch (e) {
    console.error('[bs-geocode-installers]', e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

