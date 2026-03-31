import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const text = await req.text();
    let body: any = {};
    try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const gameDate = body.game_date || new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const bankroll = body.bankroll || 1000;

    // 1. Fetch all props with consensus data for today
    const { data: props, error: propsErr } = await supabase
      .from("props_master")
      .select("id, player_name, stat_type, line, platform, ai_confidence, ai_recommendation, consensus_score, consensus_over, consensus_under, signal_strength, is_value_play, value_score, over_odds, under_odds")
      .eq("game_date", gameDate)
      .not("ai_confidence", "is", null);

    if (propsErr) throw propsErr;
    if (!props || props.length === 0) {
      return new Response(JSON.stringify({ success: true, top_plays: [], message: "No props for today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch capper picks for today with capper performance
    const { data: capperPicks } = await supabase
      .from("sbo_capper_picks")
      .select("matched_prop_id, direction, capper_id, edge_score, sharp_flag")
      .eq("game_date", gameDate)
      .eq("review_status", "verified");

    const { data: performances } = await supabase
      .from("sbo_capper_performance")
      .select("capper_id, confidence_grade, win_rate, hot_streak");

    const perfMap: Record<string, any> = {};
    (performances || []).forEach((p: any) => {
      if (!perfMap[p.capper_id] || p.win_rate > perfMap[p.capper_id].win_rate) {
        perfMap[p.capper_id] = p;
      }
    });

    // 3. Score each prop
    const scored = props.map((prop: any) => {
      const aiConf = prop.ai_confidence || 0;
      const consensusScore = prop.consensus_score || 0;
      const valueScore = prop.value_score || 0;

      // Capper confidence for this prop
      const propPicks = (capperPicks || []).filter((p: any) => p.matched_prop_id === prop.id);
      const elitePicks = propPicks.filter((p: any) => {
        const perf = perfMap[p.capper_id];
        return perf && (perf.confidence_grade === "A" || perf.confidence_grade === "B");
      });
      const capperConf = propPicks.length > 0 ? Math.min(100, propPicks.length * 15 + elitePicks.length * 10) : 0;

      // Sharp detection: elite cappers disagree with majority public picks
      const overPicks = propPicks.filter((p: any) => p.direction === "OVER" || p.direction === "WIN" || p.direction === "YES");
      const underPicks = propPicks.filter((p: any) => p.direction === "UNDER" || p.direction === "LOSE" || p.direction === "NO");
      const eliteOver = elitePicks.filter((p: any) => p.direction === "OVER" || p.direction === "WIN" || p.direction === "YES").length;
      const eliteUnder = elitePicks.length - eliteOver;
      const publicBias = overPicks.length >= underPicks.length ? "OVER" : "UNDER";
      const eliteBias = eliteOver >= eliteUnder ? "OVER" : "UNDER";
      
      let sharpIndicator = "NEUTRAL";
      if (elitePicks.length >= 2 && publicBias !== eliteBias) {
        sharpIndicator = "SHARP";
      } else if (propPicks.length >= 3 && elitePicks.length === 0 && overPicks.length > underPicks.length * 2) {
        sharpIndicator = "TRAP";
      }

      // Composite score: weighted blend
      const composite = Math.round(
        (consensusScore * 0.35) +
        (valueScore * 0.25) +
        (capperConf * 0.25) +
        (aiConf * 0.15)
      );

      // Build reasons
      const reasons: string[] = [];
      if (consensusScore >= 70) reasons.push(`High consensus (${consensusScore}%)`);
      if (prop.is_value_play) reasons.push(`💰 Value edge (+${valueScore})`);
      if (elitePicks.length >= 2) reasons.push(`${elitePicks.length} elite cappers aligned`);
      if (aiConf >= 65) reasons.push(`AI model agrees (${aiConf}%)`);
      if (sharpIndicator === "SHARP") reasons.push("🧠 Sharp money detected");
      if (prop.signal_strength === "STRONG") reasons.push("🔥 Strong signal");
      const hotCappers = propPicks.filter((p: any) => perfMap[p.capper_id]?.hot_streak > 2);
      if (hotCappers.length > 0) reasons.push(`${hotCappers.length} capper(s) on hot streak`);

      // Bet sizing (quarter-Kelly approximation)
      const edge = Math.max(0, composite - 50) / 100;
      const odds = prop.over_odds || -110;
      const impliedProb = odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100);
      const kelly = edge > 0 ? (edge / (1 - impliedProb)) : 0;
      const quarterKelly = Math.min(0.05, kelly * 0.25); // cap at 5%
      const betPct = composite >= 75 ? Math.max(quarterKelly, 0.03) :
                     composite >= 60 ? Math.max(quarterKelly, 0.02) :
                     Math.max(quarterKelly, 0.01);
      const betAmount = Math.round(bankroll * betPct);

      // Direction
      const direction = (prop.consensus_over || 0) >= (prop.consensus_under || 0) 
        ? (prop.ai_recommendation || "OVER") 
        : "UNDER";

      return {
        ...prop,
        composite_score: composite,
        capper_confidence: capperConf,
        sharp_indicator: sharpIndicator,
        bet_size_pct: Math.round(betPct * 1000) / 10,
        bet_amount: betAmount,
        play_reasons: reasons,
        direction,
        elite_count: elitePicks.length,
        total_picks: propPicks.length,
      };
    });

    // 4. Rank by composite
    scored.sort((a: any, b: any) => b.composite_score - a.composite_score);
    const topPlays = scored.slice(0, 10);

    // 5. Update props_master with rankings
    let rank = 1;
    for (const play of topPlays) {
      await supabase.from("props_master").update({
        composite_score: play.composite_score,
        top_play_rank: rank,
        sharp_indicator: play.sharp_indicator,
        bet_size_pct: play.bet_size_pct,
        play_reasons: play.play_reasons,
      }).eq("id", play.id);
      rank++;
    }

    // 6. Save top plays to sbo_top_plays table
    // Clear today's old entries first
    await supabase.from("sbo_top_plays").delete().eq("game_date", gameDate);

    for (const play of topPlays) {
      const enginesAgreed: string[] = [];
      if (play.ai_confidence >= 60) enginesAgreed.push("Props Engine");
      if (play.total_picks > 0) enginesAgreed.push("Capper Signals");
      if (play.is_value_play) enginesAgreed.push("Value Engine");

      const tier = play.composite_score >= 80 ? "ELITE BET" :
                   play.composite_score >= 60 ? "STRONG BET" : "WATCHLIST";

      await supabase.from("sbo_top_plays").insert({
        game_date: gameDate,
        player_name: play.player_name,
        pick: `${play.stat_type} ${play.direction} ${play.line}`,
        sport: "NBA",
        odds_american: play.over_odds || null,
        confidence: play.composite_score,
        edge_score: play.value_score || 0,
        engines_agreed: enginesAgreed,
        engine_count: enginesAgreed.length,
        signal_sources: {
          ai_confidence: play.ai_confidence,
          consensus_score: play.consensus_score,
          capper_confidence: play.capper_confidence,
          sharp_indicator: play.sharp_indicator,
          play_reasons: play.play_reasons,
        },
        recommended_action: tier,
      });
    }

    // 7. Log signals for learning
    for (const play of topPlays.slice(0, 5)) {
      await supabase.from("sbo_signal_performance").insert({
        signal_type: play.sharp_indicator === "SHARP" ? "SHARP" : play.is_value_play ? "VALUE" : "CONSENSUS",
        signal_strength: play.signal_strength,
        prop_id: play.id,
        consensus_score: play.consensus_score,
        value_score: play.value_score,
        ai_confidence: play.ai_confidence,
        capper_confidence: play.capper_confidence,
        composite_score: play.composite_score,
        sport: "NBA",
        stat_type: play.stat_type,
        game_date: gameDate,
      });
    }

    // 8. Fetch Polymarket value spots for cross-referencing
    const { data: polySignals } = await supabase
      .from("sbo_odds_comparison")
      .select("*")
      .eq("has_value", true)
      .gte("created_at", `${gameDate}T00:00:00`);

    if (polySignals?.length) {
      for (const sig of polySignals.slice(0, 5)) {
        const existing = topPlays.find((p: any) =>
          p.player_name && sig.description && 
          sig.description.toLowerCase().includes(p.player_name.toLowerCase())
        );
        if (!existing) {
          await supabase.from("sbo_top_plays").insert({
            game_date: gameDate,
            player_name: null,
            pick: sig.description || sig.market_slug || "Polymarket Value",
            sport: "NBA",
            confidence: Math.round((sig.implied_edge || 0) * 100),
            edge_score: sig.implied_edge || 0,
            engines_agreed: ["Polymarket"],
            engine_count: 1,
            signal_sources: { polymarket: sig },
            recommended_action: "WATCHLIST",
          });
        } else {
          // Upgrade existing play — add Polymarket as engine
          await supabase.from("sbo_top_plays")
            .update({
              engines_agreed: [...(existing.engines_agreed || []), "Polymarket"],
              engine_count: (existing.engines_agreed?.length || 0) + 1,
            })
            .eq("game_date", gameDate)
            .eq("player_name", existing.player_name);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      top_plays: topPlays,
      total_scored: scored.length,
      bankroll,
      game_date: gameDate,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
