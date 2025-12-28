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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { line_ids } = await req.json();

    if (!line_ids || !Array.isArray(line_ids) || line_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No line IDs provided', simulated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[simulate-lines] Processing ${line_ids.length} lines`);

    // Fetch the sportsbook lines
    const { data: lines, error: linesError } = await supabase
      .from('sportsbook_lines')
      .select('*')
      .in('id', line_ids);

    if (linesError) {
      console.error('[simulate-lines] Error fetching lines:', linesError);
      throw linesError;
    }

    if (!lines || lines.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No lines found', simulated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch NBA player stats for matching
    const { data: playerStats } = await supabase
      .from('nba_player_stats')
      .select('player_id, player_name, team_abbreviation, pts, reb, ast, stl, blk, fg3m, tov')
      .order('pts', { ascending: false })
      .limit(500);

    const playerMap = new Map();
    playerStats?.forEach(p => {
      const nameLower = p.player_name?.toLowerCase() || '';
      playerMap.set(nameLower, p);
      // Also map by last name for fuzzy matching
      const parts = nameLower.split(' ');
      if (parts.length > 1) {
        playerMap.set(parts[parts.length - 1], p);
      }
    });

    let simulatedCount = 0;
    const simulations = [];

    for (const line of lines) {
      try {
        // Try to match player
        const searchName = line.player_or_team?.toLowerCase().trim() || '';
        let matchedPlayer = playerMap.get(searchName);
        
        // Fuzzy match by last name
        if (!matchedPlayer) {
          const parts = searchName.split(' ');
          if (parts.length > 1) {
            matchedPlayer = playerMap.get(parts[parts.length - 1]);
          }
        }

        let aiProjection = 0;
        let impliedProb = 0.5;
        let aiProb = 0.5;
        let edge = 0;
        let recommendation = 'PASS';

        if (matchedPlayer) {
          // Calculate AI projection based on market type
          switch (line.market_type?.toUpperCase()) {
            case 'PTS':
              aiProjection = matchedPlayer.pts || 0;
              break;
            case 'REB':
              aiProjection = matchedPlayer.reb || 0;
              break;
            case 'AST':
              aiProjection = matchedPlayer.ast || 0;
              break;
            case 'PRA':
              aiProjection = (matchedPlayer.pts || 0) + (matchedPlayer.reb || 0) + (matchedPlayer.ast || 0);
              break;
            case '3PM':
              aiProjection = matchedPlayer.fg3m || 0;
              break;
            case 'STL':
              aiProjection = matchedPlayer.stl || 0;
              break;
            case 'BLK':
              aiProjection = matchedPlayer.blk || 0;
              break;
            case 'TO':
              aiProjection = matchedPlayer.tov || 0;
              break;
            default:
              aiProjection = matchedPlayer.pts || 0;
          }

          // Calculate probabilities
          const lineValue = parseFloat(line.line_value) || 0;
          
          // Simple probability model: how far is projection from line?
          // Positive diff = projection > line = lean OVER
          const diff = aiProjection - lineValue;
          const stdDev = lineValue * 0.15 || 3; // Assume ~15% volatility
          const zScore = diff / stdDev;
          
          // Convert z-score to probability (simplified normal CDF approximation)
          aiProb = 1 / (1 + Math.exp(-1.7 * zScore));
          aiProb = Math.max(0.05, Math.min(0.95, aiProb));

          // Calculate implied probability from odds
          const overOdds = line.over_odds || -110;
          if (overOdds < 0) {
            impliedProb = Math.abs(overOdds) / (Math.abs(overOdds) + 100);
          } else {
            impliedProb = 100 / (overOdds + 100);
          }

          // Calculate edge
          edge = (aiProb - impliedProb) * 100;

          // Generate recommendation
          if (edge > 5) {
            recommendation = 'OVER';
          } else if (edge < -5) {
            recommendation = 'UNDER';
          } else {
            recommendation = 'PASS';
          }

          // Update the sportsbook_lines with matched player
          await supabase
            .from('sportsbook_lines')
            .update({ 
              matched_player_id: matchedPlayer.player_id,
              is_valid: true 
            })
            .eq('id', line.id);
        } else {
          // Mark as unmatched
          await supabase
            .from('sportsbook_lines')
            .update({ 
              is_valid: false,
              validation_notes: 'Player not found in database'
            })
            .eq('id', line.id);
        }

        // Insert simulation result into bets_simulated
        const simulation = {
          sportsbook_line_id: line.id,
          source: 'line_intake',
          platform: line.sportsbook,
          bet_type: line.market_type,
          description: `${line.player_or_team} ${line.market_type} ${line.line_value}`,
          estimated_probability: aiProb,
          confidence_score: matchedPlayer ? 75 : 25,
          ai_projection: aiProjection,
          implied_probability: impliedProb,
          ai_probability: aiProb,
          edge: edge,
          recommendation: recommendation,
          status: 'pending',
        };

        simulations.push(simulation);
        simulatedCount++;

        console.log(`[simulate-lines] Simulated: ${line.player_or_team} ${line.market_type} ${line.line_value} -> ${recommendation} (edge: ${edge.toFixed(1)}%)`);

      } catch (lineError) {
        console.error(`[simulate-lines] Error processing line ${line.id}:`, lineError);
      }
    }

    // Bulk insert simulations
    if (simulations.length > 0) {
      const { error: insertError } = await supabase
        .from('bets_simulated')
        .insert(simulations);

      if (insertError) {
        console.error('[simulate-lines] Error inserting simulations:', insertError);
      }
    }

    console.log(`[simulate-lines] Completed: ${simulatedCount}/${lines.length} lines simulated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        simulated: simulatedCount,
        total: lines.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[simulate-lines] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, simulated: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
