import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function americanToDecimal(american: number): number {
  return american > 0 ? (american / 100) + 1 : (100 / Math.abs(american)) + 1;
}

function decimalToAmerican(decimal: number): number {
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

function calcParlayMultiplier(legs: any[]): number {
  return legs.reduce((m, leg) => {
    return m * americanToDecimal(leg.odds || -110);
  }, 1);
}

function formatOdds(american: number): string {
  return american > 0 ? `+${american}` : `${american}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const date = body.date || new Date().toISOString().split('T')[0];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. GET TODAY'S BEST MONEYLINE PREDICTIONS
    const { data: moneylinePreds } = await supabase
      .from('sbo_predictions')
      .select(`
        *,
        sbo_games(home_team, away_team, game_date,
          sbo_odds(sportsbook, market_type, home_odds, away_odds))
      `)
      .eq('prediction_type', 'moneyline')
      .in('confidence_tier', ['elite', 'strong'])
      .gte('created_at', date + 'T00:00:00')
      .lte('created_at', date + 'T23:59:59')
      .order('final_confidence', { ascending: false })
      .limit(10);

    // 2. GET TODAY'S BEST PROP PREDICTIONS
    const { data: propPreds } = await supabase
      .from('sbo_predictions')
      .select(`
        *,
        sbo_player_props(player_name, prop_type, line, over_odds, under_odds, team,
          sbo_games(home_team, away_team))
      `)
      .eq('prediction_type', 'player_prop')
      .in('confidence_tier', ['elite', 'strong'])
      .gte('created_at', date + 'T00:00:00')
      .lte('created_at', date + 'T23:59:59')
      .order('final_confidence', { ascending: false })
      .limit(20);

    // 3. GET TODAY'S GAMES
    const { data: todayGames } = await supabase
      .from('sbo_games')
      .select('*')
      .gte('game_date', date + 'T00:00:00')
      .lte('game_date', date + 'T23:59:59');

    // 4. BUILD PARLAY LEGS
    const parlayLegs: any[] = [];

    for (const pred of (moneylinePreds || []).slice(0, 8)) {
      const game = (pred as any).sbo_games;
      const odds_records = game?.sbo_odds || [];
      const dkOdds = odds_records.find((o: any) =>
        o.sportsbook === 'draftkings' && o.market_type === 'moneyline'
      );
      const isHome = pred.predicted_outcome === 'home';
      const teamName = isHome ? game?.home_team : game?.away_team;
      const odds = isHome ? dkOdds?.home_odds : dkOdds?.away_odds;
      if (!teamName || !odds) continue;

      parlayLegs.push({
        id: pred.id, type: 'moneyline', label: `${teamName} ML`,
        team: teamName, odds: odds || -110,
        confidence: pred.final_confidence, tier: pred.confidence_tier,
        game: `${game?.away_team} @ ${game?.home_team}`,
      });
    }

    for (const pred of (propPreds || []).slice(0, 12)) {
      const prop = (pred as any).sbo_player_props;
      if (!prop) continue;
      const isOver = pred.predicted_outcome === 'over';
      const odds = isOver ? prop.over_odds : prop.under_odds;

      parlayLegs.push({
        id: pred.id, type: 'player_prop',
        label: `${prop.player_name} ${pred.predicted_outcome?.toUpperCase()} ${prop.line} ${prop.prop_type}`,
        player: prop.player_name, prop_type: prop.prop_type,
        line: prop.line, direction: pred.predicted_outcome,
        odds: odds || -120, confidence: pred.final_confidence,
        tier: pred.confidence_tier,
        game: `${prop.sbo_games?.away_team} @ ${prop.sbo_games?.home_team}`,
      });
    }

    parlayLegs.sort((a, b) => b.confidence - a.confidence);

    // 5. CALCULATE PARLAY PAYOUTS
    const legCounts = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 20, 25];
    const stakes = [5, 10, 20, 25, 50, 100];
    const parlayPayouts: any[] = [];

    for (const count of legCounts) {
      if (parlayLegs.length < count) continue;
      const legs = parlayLegs.slice(0, count);
      const multiplier = calcParlayMultiplier(legs);
      const combinedWinProb = legs.reduce((p, l) => p * (l.confidence / 100), 1) * 100;
      const americanEquivalent = decimalToAmerican(multiplier);

      const payoutRow: any = {
        legs_count: count,
        legs: legs.map(l => ({ label: l.label, odds: l.odds, confidence: l.confidence })),
        multiplier: parseFloat(multiplier.toFixed(2)),
        american_odds: americanEquivalent,
        win_probability: parseFloat(combinedWinProb.toFixed(1)),
        ev_at_10: parseFloat(((combinedWinProb / 100 * (10 * multiplier - 10)) - (1 - combinedWinProb / 100) * 10).toFixed(2)),
      };

      for (const stake of stakes) {
        payoutRow[`payout_${stake}`] = parseFloat((stake * multiplier).toFixed(2));
        payoutRow[`profit_${stake}`] = parseFloat((stake * multiplier - stake).toFixed(2));
      }
      parlayPayouts.push(payoutRow);
    }

    // 6. FORMAT THE SMS MESSAGE
    const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric'
    });

    let message = `🏀 DYNASTY PICKS — ${dateFormatted}\n`;
    message += `${todayGames?.length || 0} games tonight\n`;
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    const topMLs = (moneylinePreds || []).slice(0, 5);
    if (topMLs.length > 0) {
      message += `💰 TOP MONEYLINES\n`;
      for (const pred of topMLs) {
        const game = (pred as any).sbo_games;
        const odds_records = game?.sbo_odds || [];
        const dkOdds = odds_records.find((o: any) =>
          o.sportsbook === 'draftkings' && o.market_type === 'moneyline'
        );
        const isHome = pred.predicted_outcome === 'home';
        const team = isHome ? game?.home_team : game?.away_team;
        const odds = isHome ? dkOdds?.home_odds : dkOdds?.away_odds;
        const tierEmoji = pred.confidence_tier === 'elite' ? '⭐' : '✅';
        message += `${tierEmoji} ${team} ML ${odds ? formatOdds(odds) : '?'} — ${pred.final_confidence}%\n`;
      }
      message += `\n`;
    }

    const topProps = (propPreds || []).slice(0, 8);
    if (topProps.length > 0) {
      message += `📊 TOP PROPS\n`;
      const propShort: Record<string, string> = {
        points: 'PTS', assists: 'AST', rebounds: 'REB',
        threes: '3PM', steals: 'STL', blocks: 'BLK',
        turnovers: 'TO', pts_reb_ast: 'PRA', pts_reb: 'PR',
        pts_ast: 'PA', reb_ast: 'RA'
      };
      for (const pred of topProps) {
        const prop = (pred as any).sbo_player_props;
        if (!prop) continue;
        const isOver = pred.predicted_outcome === 'over';
        const odds = isOver ? prop.over_odds : prop.under_odds;
        const tierEmoji = pred.confidence_tier === 'elite' ? '⭐' : '✅';
        const dir = isOver ? 'OV' : 'UN';
        const pt = propShort[prop.prop_type] || prop.prop_type;
        const lastName = prop.player_name?.split(' ').pop() || prop.player_name;
        message += `${tierEmoji} ${lastName} ${dir} ${prop.line} ${pt} ${odds ? formatOdds(odds) : '?'} — ${pred.final_confidence}%\n`;
      }
      message += `\n`;
    }

    if (parlayPayouts.length > 0) {
      message += `🎯 PARLAY BUILDER\n`;
      message += `━━━━━━━━━━━━━━━━━━━━\n`;
      const keyLegCounts = [3, 5, 7, 10, 15, 20];
      for (const count of keyLegCounts) {
        const pp = parlayPayouts.find(p => p.legs_count === count);
        if (!pp) continue;
        message += `${count}-leg: ${pp.win_probability}% win → $10=$${pp.payout_10} | $25=$${pp.payout_25}\n`;
      }
      message += `\n💬 Reply with your bets:\n`;
      message += `Format: BET [amount] [pick]\n`;
      message += `Example: BET 10 Lakers ML\n`;
      message += `Or: PARLAY 25 3LEG top\n`;
      message += `Or: DONE (to see full P&L)\n`;
    }

    // 7. SAVE BRIEFING RECORD
    const { data: briefing } = await supabase
      .from('sbo_daily_briefings')
      .upsert({
        briefing_date: date,
        phone_number: Deno.env.get('YOUR_PHONE_NUMBER') || '',
        moneylines_section: topMLs.map(p => {
          const g = (p as any).sbo_games;
          return `${p.predicted_outcome === 'home' ? g?.home_team : g?.away_team} ML`;
        }).join(', '),
        props_section: topProps.map(p => {
          const prop = (p as any).sbo_player_props;
          return `${prop?.player_name} ${p.predicted_outcome} ${prop?.line} ${prop?.prop_type}`;
        }).join(', '),
        full_message: message,
        top_moneylines: topMLs.map(p => ({
          id: p.id,
          team: p.predicted_outcome === 'home'
            ? (p as any).sbo_games?.home_team
            : (p as any).sbo_games?.away_team,
          confidence: p.final_confidence,
          tier: p.confidence_tier,
        })),
        top_props: topProps.map(p => ({
          id: p.id,
          player: (p as any).sbo_player_props?.player_name,
          prop_type: (p as any).sbo_player_props?.prop_type,
          line: (p as any).sbo_player_props?.line,
          direction: p.predicted_outcome,
          confidence: p.final_confidence,
        })),
        parlay_legs: parlayLegs.slice(0, 25).map(l => ({
          id: l.id, label: l.label, odds: l.odds,
          confidence: l.confidence, type: l.type,
        })),
        games_tonight: todayGames?.length || 0,
        props_available: propPreds?.length || 0,
        best_parlay_confidence: parlayPayouts[0]?.win_probability || 0,
        status: 'pending',
      }, { onConflict: 'briefing_date' })
      .select()
      .single();

    // Save parlay payouts
    if (briefing) {
      for (const pp of parlayPayouts) {
        await supabase.from('sbo_parlay_payouts').insert({
          briefing_id: briefing.id,
          legs_count: pp.legs_count,
          leg_details: pp.legs,
          combined_odds: pp.american_odds,
          parlay_multiplier: pp.multiplier,
          payout_5: pp.payout_5,
          payout_10: pp.payout_10,
          payout_20: pp.payout_20,
          payout_25: pp.payout_25,
          payout_50: pp.payout_50,
          payout_100: pp.payout_100,
          win_probability_pct: pp.win_probability,
          expected_value_10: pp.ev_at_10,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      briefing_id: briefing?.id,
      message_length: message.length,
      moneylines_count: topMLs.length,
      props_count: topProps.length,
      parlay_legs_available: parlayLegs.length,
      parlay_payouts_calculated: parlayPayouts.length,
      message_preview: message.slice(0, 200) + '...',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
