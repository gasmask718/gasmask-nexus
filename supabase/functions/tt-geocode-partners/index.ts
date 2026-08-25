import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Batch-geocodes TopTier supply partner office addresses (crm_partners).
 * Internal-only. Each row is geocoded ONCE — lat/lng are cached back onto the
 * row and rows carrying a geocode_status are skipped unless { revalidate: true }.
 * Google Geocoding preferred; Mapbox fallback.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const keys = [
      ['GOOGLE_PLACES_API_KEY', Deno.env.get('GOOGLE_PLACES_API_KEY')],
      ['GOOGLE_MAPS_BROWSER_KEY', Deno.env.get('GOOGLE_MAPS_BROWSER_KEY')],
      ['GOOGLE_STREETVIEW_API_KEY', Deno.env.get('GOOGLE_STREETVIEW_API_KEY')],
    ].filter(([, v]) => !!v) as [string, string][];

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
      console.warn('[tt-geocode-partners] Google unavailable, using Mapbox:', probeErrors.join(' | '));
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
      .from('crm_partners')
      .select('id, company_name, office_address, city, state, licence_state')
      .eq('business', 'toptier')
      .limit(limit);

    if (!revalidate) query = query.is('geocode_status', null);

    const { data: rows, error } = await query;
    if (error) throw new Error(`fetch failed: ${error.message}`);
    if (!rows?.length) {
      return json({ success: true, geocoded: 0, failed: 0, remaining: 0, message: 'Nothing to geocode' });
    }

    let geocoded = 0;
    let failed = 0;

    for (const row of rows as any[]) {
      const address = [row.office_address, row.city, row.state || row.licence_state]
        .filter(Boolean).join(', ');

      if (!address.trim()) {
        await supabase.from('crm_partners').update({
          geocoded_at: new Date().toISOString(), geocode_status: 'no_address',
        }).eq('id', row.id);
        failed++;
        continue;
      }

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

        await supabase.from('crm_partners').update({
          lat, lng, geocoded_at: new Date().toISOString(), geocode_status: status,
        }).eq('id', row.id);
        status === 'ok' ? geocoded++ : failed++;
      } catch (e) {
        await supabase.from('crm_partners').update({
          geocoded_at: new Date().toISOString(),
          geocode_status: `error:${(e as Error).message.slice(0, 60)}`,
        }).eq('id', row.id);
        failed++;
      }
      await new Promise(r => setTimeout(r, 25));
    }

    const { count: remaining } = await supabase
      .from('crm_partners')
      .select('id', { count: 'exact', head: true })
      .eq('business', 'toptier')
      .is('geocode_status', null);

    return json({ success: true, key: keyName, geocoded, failed, processed: rows.length, remaining: remaining ?? 0 });
  } catch (e) {
    console.error('[tt-geocode-partners]', e);
    return json({ success: false, error: (e as Error).message }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
