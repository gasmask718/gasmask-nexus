import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, platform } = await req.json();
    if (!image) throw new Error('No image provided');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use AI Gateway to parse the prop image
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a sports prop parser. Extract ALL player props from the image.
Return a JSON array of objects with these fields:
- player_name (string, full name)
- team (string, team abbreviation if visible)
- stat_type (string, e.g. "points", "rebounds", "assists", "pts+reb+ast", "3-pointers", "blocks", "steals", "turnovers")
- line (number, the prop line value)
- prediction (string, "MORE" or "LESS" based on highlighted/selected pick if visible, otherwise null)
- odds (string, if visible, e.g. "-110")

IMPORTANT: Return ONLY the JSON array, no markdown, no explanation.
If you can't parse any props, return an empty array [].
Normalize stat types to lowercase. Example: "Points" -> "points", "PTS + REB + AST" -> "pts+reb+ast".`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Parse all player props from this ${platform || 'sportsbook'} screenshot.` },
              { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';

    // Parse the JSON response
    let props: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      props = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI could not extract props from the image');
    }

    if (!Array.isArray(props) || props.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: 'No props found in image' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate upload group ID
    const uploadGroupId = crypto.randomUUID();
    const today = new Date();
    const gameDate = today.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Insert into props_master
    const rows = props.map((p: any) => ({
      player_name: p.player_name,
      team: p.team || null,
      stat_type: (p.stat_type || '').toLowerCase(),
      line: parseFloat(p.line) || 0,
      platform: platform || 'manual',
      odds: p.odds || null,
      source: 'image',
      prediction: p.prediction || null,
      game_date: gameDate,
      upload_group_id: uploadGroupId,
      result: 'pending',
    }));

    const { error: insertError } = await supabase.from('props_master').upsert(rows, {
      onConflict: 'player_name,stat_type,game_date,platform',
      ignoreDuplicates: false,
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    return new Response(JSON.stringify({
      success: true,
      count: rows.length,
      upload_group_id: uploadGroupId,
      parsed: rows.map(r => ({ player: r.player_name, stat: r.stat_type, line: r.line })),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
