import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SPORTS_CONTEXT = `
SUPPORTED SPORTS & STAT TYPES:
- NBA/WNBA/NCAAB: points, rebounds, assists, steals, blocks, turnovers, 3-pointers, pts+reb+ast, pts+reb, pts+ast, reb+ast, double-double, fantasy
- NFL: passing_yards, rushing_yards, receiving_yards, touchdowns, pass_completions, interceptions, receptions, longest_reception, fantasy
- MLB: hits, home_runs, rbis, runs, stolen_bases, total_bases, strikeouts_pitched, earned_runs, walks, hits_allowed, pitcher_outs
- NHL: goals, assists, points, shots, saves, blocks, power_play_points, faceoff_wins
- Soccer/MLS: goals, assists, shots, shots_on_target, tackles, passes, crosses
- UFC/MMA: method_of_victory, rounds, significant_strikes
- Tennis: aces, double_faults, games_won, sets_won

BET TYPES:
- prop: player prop (OVER/UNDER a line)
- moneyline: team to win
- spread: point spread
- total: game total (OVER/UNDER)
- futures: season/tournament outcome
- parlay: multi-leg bet (list each leg)

DIRECTION VALUES: OVER, UNDER, WIN, LOSE, YES, NO
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image, capper_id, capper_name, platform } = await req.json();
    if (!image) throw new Error('No image provided');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Use AI to parse the capper pick image
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a multi-sport betting pick parser. Extract ALL picks from the image.

Return a JSON array of objects with these EXACT fields:
- player_name (string or null for game bets)
- team (string, team name or abbreviation)
- opponent (string or null)
- sport (string: "NBA", "WNBA", "NFL", "MLB", "NHL", "Soccer", "UFC", "Tennis", "NCAAB", "NCAAF")
- league (string or null, e.g. "Premier League", "MLS", "UFC 300")
- stat_type (string, normalized lowercase)
- line (number or null)
- direction (string: "OVER", "UNDER", "WIN", "LOSE", "YES", "NO")
- odds (string or null, e.g. "-110")
- bet_type (string: "prop", "moneyline", "spread", "total", "futures", "parlay")
- confidence_note (string or null, any confidence/lock/fire emoji or text from capper)
- game_date (string YYYY-MM-DD if visible, else null)

${SPORTS_CONTEXT}

RULES:
1. Return ONLY the JSON array, no markdown
2. Auto-detect the sport from context clues (player names, stat types, teams)
3. Normalize stat types to lowercase (e.g. "Points" → "points", "Passing Yards" → "passing_yards")
4. For parlays, return each leg as a separate object
5. If confidence/conviction is indicated (🔒, 💰, "LOCK", "MAX PLAY"), note it
6. If you can't parse something, still include it with what you can extract
7. Return empty array [] if no picks found`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Parse all picks from this ${platform || 'capper'} screenshot. Extract every bet/pick visible.` },
              { type: 'image_url', image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 6000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI API error [${aiResponse.status}]: ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';

    let picks: any[] = [];
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      picks = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content);
      throw new Error('AI could not extract picks from the image');
    }

    if (!Array.isArray(picks) || picks.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, picks: [], message: 'No picks found in image' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate parse confidence per pick
    const scoredPicks = picks.map((p: any) => {
      let confidence = 100;
      if (!p.player_name && p.bet_type === 'prop') confidence -= 30;
      if (!p.sport) confidence -= 25;
      if (!p.direction) confidence -= 20;
      if (!p.line && p.bet_type === 'prop') confidence -= 15;
      if (!p.stat_type && p.bet_type === 'prop') confidence -= 10;
      return { ...p, parse_confidence: Math.max(0, confidence) };
    });

    // Insert into sbo_capper_picks if capper_id provided
    if (capper_id) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const rows = scoredPicks.map((p: any) => ({
        capper_id,
        pick_text: [p.player_name, p.direction, p.line, p.stat_type].filter(Boolean).join(' '),
        player_name: p.player_name || null,
        team: p.team || null,
        prop_type: p.stat_type || null,
        line: p.line ? parseFloat(p.line) : null,
        direction: p.direction || null,
        odds: p.odds ? parseInt(String(p.odds).replace('+', '')) : null,
        sport: p.sport || 'NBA',
        league: p.league || null,
        bet_type: p.bet_type || 'prop',
        parse_confidence: p.parse_confidence,
        review_status: p.parse_confidence >= 70 ? 'verified' : 'needs_review',
        parsed_by_ai: true,
        game_date: p.game_date || today,
        result: 'pending',
      }));

      const { error: insertError } = await supabase.from('sbo_capper_picks').insert(rows);
      if (insertError) {
        console.error('Insert error:', insertError);
        throw new Error(`Database error: ${insertError.message}`);
      }

      // Update capper sports list
      const sports = [...new Set(scoredPicks.map((p: any) => p.sport).filter(Boolean))];
      if (sports.length > 0) {
        const { data: capper } = await supabase.from('sbo_cappers').select('sports').eq('id', capper_id).single();
        const existingSports = (capper?.sports as string[]) || [];
        const allSports = [...new Set([...existingSports, ...sports])];
        await supabase.from('sbo_cappers').update({ sports: allSports }).eq('id', capper_id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: scoredPicks.length,
      picks: scoredPicks,
      needs_review: scoredPicks.filter((p: any) => p.parse_confidence < 70).length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
