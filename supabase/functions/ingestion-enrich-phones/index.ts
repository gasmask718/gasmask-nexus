import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const GOOGLE_KEY =
      Deno.env.get('GOOGLE_PLACES_API_KEY') ||
      Deno.env.get('GOOGLE_MAPS_API_KEY') ||
      Deno.env.get('GOOGLE_API_KEY');

    if (!GOOGLE_KEY) throw new Error('Google API key not configured');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get records missing phone that have a place_id
    const { data: records } = await supabase
      .from('territory_addresses')
      .select('id, store_name, place_id')
      .is('phone', null)
      .not('place_id', 'is', null)
      .limit(100);

    if (!records?.length) {
      return new Response(
        JSON.stringify({ success: true, enriched: 0, total_checked: 0, message: 'No records with place_id missing phones' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let enriched = 0;

    for (const record of records) {
      try {
        const detailRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?` +
          `place_id=${record.place_id}` +
          `&fields=formatted_phone_number,formatted_address,website` +
          `&key=${GOOGLE_KEY}`
        );
        const detailData = await detailRes.json();

        if (detailData.status === 'OK' && detailData.result.formatted_phone_number) {
          await supabase
            .from('territory_addresses')
            .update({
              phone: detailData.result.formatted_phone_number,
              website: detailData.result.website || null,
              full_address: detailData.result.formatted_address || undefined,
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);

          enriched++;
          console.log(`Added phone for ${record.store_name}: ${detailData.result.formatted_phone_number}`);
        }

        await new Promise(r => setTimeout(r, 150));
      } catch (e: any) {
        console.error(`Enrich failed for ${record.store_name}:`, e.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        enriched,
        total_checked: records.length,
        message: `Added phone numbers to ${enriched} of ${records.length} records`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
