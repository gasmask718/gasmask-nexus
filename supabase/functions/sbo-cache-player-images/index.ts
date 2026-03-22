import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SPORTS_KEY = Deno.env.get('SPORTSDATAIO_API_KEY');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get props without cached images
    const { data: props } = await supabase
      .from('sbo_player_props')
      .select('id, player_name, team')
      .is('player_image_url', null)
      .limit(50);

    if (!props?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'All player images already cached', cached: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all NBA players from SportsDataIO
    let allPlayers: any[] = [];
    if (SPORTS_KEY) {
      try {
        const playersRes = await fetch(
          `https://api.sportsdata.io/v3/nba/scores/json/Players?key=${SPORTS_KEY}`
        );
        if (playersRes.ok) {
          allPlayers = await playersRes.json();
          console.log(`Loaded ${allPlayers.length} NBA players for image matching`);
        }
      } catch (e) {
        console.warn('Failed to fetch player list:', e);
      }
    }

    let cached = 0;

    for (const prop of props) {
      const player = allPlayers.find((p: any) => {
        const fullName = `${p.FirstName} ${p.LastName}`.toLowerCase();
        const propName = prop.player_name?.toLowerCase() || '';
        return fullName === propName || propName.includes(p.LastName?.toLowerCase() || '___');
      });

      const imageUrl = player?.PhotoUrl
        || `https://ui-avatars.com/api/?name=${encodeURIComponent(prop.player_name || '')}&background=1a1a1a&color=ffffff&size=128`;

      await supabase
        .from('sbo_player_props')
        .update({
          player_image_url: imageUrl,
          player_image_cached: true,
          player_image_cached_at: new Date().toISOString(),
        })
        .eq('id', prop.id);
      cached++;
    }

    return new Response(
      JSON.stringify({ success: true, cached, total: props.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('Player image cache error:', e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
