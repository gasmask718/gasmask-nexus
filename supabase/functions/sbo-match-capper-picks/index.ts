import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize stat type for matching
function normalizeStat(s: string): string {
  if (!s) return '';
  const lower = s.toLowerCase().trim()
    .replace(/three.?pointers?|3.?pt|3pm|threes/i, '3-pointers')
    .replace(/pts|point/i, 'points')
    .replace(/reb|rebound/i, 'rebounds')
    .replace(/ast|assist/i, 'assists')
    .replace(/stl|steal/i, 'steals')
    .replace(/blk|block/i, 'blocks')
    .replace(/tov|turnover/i, 'turnovers')
    .replace(/pts\+reb\+ast|pra/i, 'pts+reb+ast')
    .replace(/passing.?yard/i, 'passing_yards')
    .replace(/rushing.?yard/i, 'rushing_yards')
    .replace(/receiving.?yard/i, 'receiving_yards')
    .replace(/td|touchdown/i, 'touchdowns')
    .replace(/hr|home.?run/i, 'home_runs')
    .replace(/so|strikeout/i, 'strikeouts')
    .replace(/rbi/i, 'rbis')
    .replace(/total.?base/i, 'total_bases');
  return lower;
}

// Normalize player name for fuzzy matching
function normalizePlayer(name: string): string {
  if (!name) return '';
  return name.toLowerCase().trim()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(w => w.length > 1)
    .sort()
    .join(' ');
}

// Simple similarity check
function playerMatch(a: string, b: string): boolean {
  const na = normalizePlayer(a);
  const nb = normalizePlayer(b);
  if (na === nb) return true;
  // Check if one contains all words of the other
  const wordsA = na.split(' ');
  const wordsB = nb.split(' ');
  if (wordsA.length >= 2 && wordsB.length >= 2) {
    const lastA = wordsA[wordsA.length - 1];
    const lastB = wordsB[wordsB.length - 1];
    if (lastA === lastB && (wordsA[0][0] === wordsB[0][0])) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'match_and_resolve'; // 'match', 'resolve', 'match_and_resolve'

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let matched = 0;
    let resolved = 0;
    let errors: string[] = [];

    // ── STEP 1: Match unmatched capper picks to props_master ──
    if (mode === 'match' || mode === 'match_and_resolve') {
      // Get unmatched picks
      const { data: unmatched, error: fetchErr } = await supabase
        .from('sbo_capper_picks')
        .select('id, player_name, prop_type, line, game_date, sport, direction')
        .is('matched_prop_id', null)
        .eq('review_status', 'verified')
        .not('player_name', 'is', null)
        .limit(500);

      if (fetchErr) {
        errors.push(`Fetch unmatched: ${fetchErr.message}`);
      } else if (unmatched && unmatched.length > 0) {
        // Get unique game dates
        const dates = [...new Set(unmatched.map(p => p.game_date).filter(Boolean))];
        
        // Fetch props for those dates
        let allProps: any[] = [];
        for (const d of dates) {
          const { data: props } = await supabase
            .from('props_master')
            .select('id, player_name, stat_type, line, game_date, sport')
            .eq('game_date', d)
            .limit(1000);
          if (props) allProps.push(...props);
        }

        console.log(`[match] ${unmatched.length} unmatched picks, ${allProps.length} props to search`);

        // Match each pick
        for (const pick of unmatched) {
          if (!pick.player_name) continue;
          
          const normStat = normalizeStat(pick.prop_type || '');
          
          // Find matching prop: player + stat + date + line within tolerance
          const candidates = allProps.filter(p => {
            if (pick.game_date && p.game_date && pick.game_date !== p.game_date) return false;
            if (!playerMatch(pick.player_name, p.player_name)) return false;
            if (normStat && normalizeStat(p.stat_type) !== normStat) return false;
            // Line tolerance ±1.0
            if (pick.line != null && p.line != null && Math.abs(pick.line - p.line) > 1.0) return false;
            return true;
          });

          if (candidates.length > 0) {
            // Pick closest line match
            const best = candidates.sort((a, b) => {
              const diffA = pick.line != null ? Math.abs(a.line - pick.line) : 0;
              const diffB = pick.line != null ? Math.abs(b.line - pick.line) : 0;
              return diffA - diffB;
            })[0];

            const { error: updErr } = await supabase
              .from('sbo_capper_picks')
              .update({ matched_prop_id: best.id })
              .eq('id', pick.id);

            if (!updErr) matched++;
          }
        }
        console.log(`[match] Matched ${matched}/${unmatched.length} picks`);
      }
    }

    // ── STEP 2: Auto-resolve results from props_master ──
    if (mode === 'resolve' || mode === 'match_and_resolve') {
      // Get pending picks that have a matched prop
      const { data: pending, error: pendErr } = await supabase
        .from('sbo_capper_picks')
        .select('id, matched_prop_id, direction, line, prop_type')
        .eq('result', 'pending')
        .not('matched_prop_id', 'is', null)
        .limit(500);

      if (pendErr) {
        errors.push(`Fetch pending: ${pendErr.message}`);
      } else if (pending && pending.length > 0) {
        // Get matched prop results
        const propIds = [...new Set(pending.map(p => p.matched_prop_id).filter(Boolean))];
        
        let resolvedProps: any[] = [];
        for (let i = 0; i < propIds.length; i += 50) {
          const chunk = propIds.slice(i, i + 50);
          const { data: props } = await supabase
            .from('props_master')
            .select('id, actual_result, result, line')
            .in('id', chunk);
          if (props) resolvedProps.push(...props);
        }

        const propMap = new Map(resolvedProps.map(p => [p.id, p]));

        for (const pick of pending) {
          const prop = propMap.get(pick.matched_prop_id);
          if (!prop || prop.result === 'pending' || prop.result === null) continue;
          if (prop.actual_result == null) continue;

          const pickLine = pick.line ?? prop.line;
          const dir = (pick.direction || '').toUpperCase();
          let result: string;

          if (prop.actual_result === pickLine) {
            result = 'push';
          } else if (['OVER', 'MORE', 'YES'].includes(dir)) {
            result = prop.actual_result > pickLine ? 'won' : 'lost';
          } else if (['UNDER', 'LESS', 'NO'].includes(dir)) {
            result = prop.actual_result < pickLine ? 'won' : 'lost';
          } else {
            // For moneyline/spread, use prop result directly
            result = prop.result === 'won' || prop.result === 'W' ? 'won' : 'lost';
          }

          const { error: resErr } = await supabase
            .from('sbo_capper_picks')
            .update({ result })
            .eq('id', pick.id);

          if (!resErr) resolved++;
        }

        console.log(`[resolve] Resolved ${resolved}/${pending.length} picks`);

        // Recalculate capper stats for affected cappers
        if (resolved > 0) {
          const affectedCapperIds = [...new Set(pending.map(p => p.id))]; // need capper_ids
          const { data: affectedPicks } = await supabase
            .from('sbo_capper_picks')
            .select('capper_id')
            .in('id', pending.map(p => p.id));
          
          const capperIds = [...new Set((affectedPicks || []).map(p => p.capper_id).filter(Boolean))];
          
          for (const cid of capperIds) {
            const { data: allPicks } = await supabase
              .from('sbo_capper_picks')
              .select('result')
              .eq('capper_id', cid);
            
            if (allPicks) {
              const total = allPicks.length;
              const resolvedAll = allPicks.filter(p => p.result !== 'pending');
              const wins = resolvedAll.filter(p => p.result === 'won').length;
              const winRate = resolvedAll.length > 0 ? (wins / resolvedAll.length) * 100 : 0;
              
              await supabase.from('sbo_cappers').update({
                total_picks: total,
                win_rate: Math.round(winRate * 10) / 10,
                updated_at: new Date().toISOString(),
              }).eq('id', cid);
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      matched,
      resolved,
      errors: errors.length > 0 ? errors : undefined,
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
