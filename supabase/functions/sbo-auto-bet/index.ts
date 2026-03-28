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
    try { body = JSON.parse(text); } catch { body = {}; }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Unauthorized");

    const mode = body.mode || "auto_bet"; // auto_bet | settle | daily_report | lock_play
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    // Get or create wallet
    let { data: wallet } = await supabase
      .from("sbo_betting_wallet")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!wallet) {
      const { data: newW } = await supabase
        .from("sbo_betting_wallet")
        .insert({ user_id: user.id, bankroll: body.bankroll || 1000 })
        .select()
        .single();
      wallet = newW;
    }
    if (!wallet) throw new Error("Could not create wallet");

    if (mode === "auto_bet") {
      // Check daily limits
      const { data: todayBets } = await supabase
        .from("sbo_bet_log")
        .select("id, stake, profit, result")
        .eq("user_id", user.id)
        .eq("game_date", today);

      const dailyBetCount = todayBets?.length || 0;
      const dailyLoss = (todayBets || [])
        .filter((b: any) => b.result !== "pending")
        .reduce((s: number, b: any) => s + (b.profit || 0), 0);
      const dailyLossPct = wallet.bankroll > 0 ? Math.abs(Math.min(0, dailyLoss)) / wallet.bankroll * 100 : 0;

      // Risk controls
      if (dailyBetCount >= wallet.max_bets_per_day) {
        return new Response(JSON.stringify({ success: false, reason: "Max daily bets reached", count: dailyBetCount }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (dailyLossPct >= wallet.max_daily_loss_pct) {
        return new Response(JSON.stringify({ success: false, reason: "Stop loss triggered", loss_pct: dailyLossPct.toFixed(1) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get top plays from props_master
      const { data: props } = await supabase
        .from("props_master")
        .select("id, player_name, stat_type, line, ai_recommendation, ai_confidence, composite_score, consensus_score, value_score, signal_strength, sharp_indicator, is_value_play, bet_size_pct")
        .eq("game_date", today)
        .not("composite_score", "is", null)
        .gte("composite_score", 60)
        .order("composite_score", { ascending: false })
        .limit(wallet.max_bets_per_day - dailyBetCount);

      if (!props || props.length === 0) {
        return new Response(JSON.stringify({ success: true, bets_placed: 0, reason: "No qualifying plays" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Filter by confidence & value gates
      const minConf = body.min_confidence || 70;
      const qualifying = props.filter((p: any) => {
        const conf = p.ai_confidence || p.consensus_score || 0;
        const value = p.value_score || 0;
        return conf >= minConf && value > 0;
      });

      // Calculate streak multiplier
      let streakMult = 1;
      if (wallet.streak_multiplier) {
        const { data: recent } = await supabase
          .from("sbo_bet_log")
          .select("result")
          .eq("user_id", user.id)
          .neq("result", "pending")
          .order("placed_at", { ascending: false })
          .limit(5);
        if (recent) {
          const streak = recent.findIndex((b: any) => b.result !== "won");
          if (streak === -1 && recent.length >= 3) streakMult = 1.25;
          else if (streak >= 3) streakMult = 1.15;
          // Cold streak protection
          const coldStreak = recent.findIndex((b: any) => b.result !== "lost");
          if (coldStreak === -1 && recent.length >= 3) streakMult = 0.5;
          else if (coldStreak >= 3) streakMult = 0.75;
        }
      }

      const betsToPlace: any[] = [];
      for (const prop of qualifying) {
        const basePct = prop.bet_size_pct || 2;
        const adjustedPct = Math.min(5, basePct * streakMult);
        const stake = Math.round(wallet.bankroll * (adjustedPct / 100) * 100) / 100;
        if (stake < 1) continue;

        const direction = prop.ai_recommendation || "OVER";
        const odds = -110;
        const impliedProb = Math.abs(odds) / (Math.abs(odds) + 100);
        const potentialPayout = Math.round(stake / impliedProb * 100) / 100;

        // Determine strategy
        let strategy = "CONSENSUS";
        if (prop.sharp_indicator === "SHARP") strategy = "SHARP";
        else if (prop.is_value_play) strategy = "VALUE";

        betsToPlace.push({
          user_id: user.id,
          prop_id: prop.id,
          player_name: prop.player_name,
          stat_type: prop.stat_type,
          line: prop.line,
          direction,
          odds,
          stake,
          potential_payout: potentialPayout,
          composite_score: prop.composite_score,
          signal_type: prop.signal_strength,
          sharp_indicator: prop.sharp_indicator,
          is_lock_play: prop.composite_score >= 85,
          auto_placed: true,
          strategy,
          game_date: today,
        });
      }

      if (betsToPlace.length > 0) {
        await supabase.from("sbo_bet_log").insert(betsToPlace);
        const totalStaked = betsToPlace.reduce((s, b) => s + b.stake, 0);
        await supabase
          .from("sbo_betting_wallet")
          .update({
            total_wagered: (wallet.total_wagered || 0) + totalStaked,
            total_bets: (wallet.total_bets || 0) + betsToPlace.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", wallet.id);
      }

      const lockPlay = betsToPlace.find(b => b.is_lock_play);
      return new Response(JSON.stringify({
        success: true,
        bets_placed: betsToPlace.length,
        total_staked: betsToPlace.reduce((s, b) => s + b.stake, 0).toFixed(2),
        lock_play: lockPlay ? { player: lockPlay.player_name, direction: lockPlay.direction, line: lockPlay.line, stake: lockPlay.stake } : null,
        streak_multiplier: streakMult,
        risk: { daily_bets: dailyBetCount + betsToPlace.length, daily_loss_pct: dailyLossPct.toFixed(1) },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "settle") {
      // Settle pending bets using props_master actual_result
      const { data: pending } = await supabase
        .from("sbo_bet_log")
        .select("*")
        .eq("user_id", user.id)
        .eq("result", "pending")
        .not("prop_id", "is", null);

      if (!pending || pending.length === 0) {
        return new Response(JSON.stringify({ success: true, settled: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const propIds = pending.map((b: any) => b.prop_id);
      const { data: props } = await supabase
        .from("props_master")
        .select("id, actual_result")
        .in("id", propIds)
        .not("actual_result", "is", null);

      let settled = 0;
      let totalProfit = 0;
      let wins = 0, losses = 0, pushes = 0;

      for (const prop of (props || [])) {
        const bet = pending.find((b: any) => b.prop_id === prop.id);
        if (!bet) continue;

        let result = "pending";
        let profit = 0;
        const actual = Number(prop.actual_result);
        if (isNaN(actual)) continue;

        const dir = (bet.direction || "").toUpperCase();
        if (dir === "OVER" || dir === "MORE" || dir === "YES") {
          if (actual > bet.line) { result = "won"; profit = (bet.potential_payout || bet.stake * 1.91) - bet.stake; wins++; }
          else if (actual === bet.line) { result = "push"; pushes++; }
          else { result = "lost"; profit = -bet.stake; losses++; }
        } else {
          if (actual < bet.line) { result = "won"; profit = (bet.potential_payout || bet.stake * 1.91) - bet.stake; wins++; }
          else if (actual === bet.line) { result = "push"; pushes++; }
          else { result = "lost"; profit = -bet.stake; losses++; }
        }

        profit = Math.round(profit * 100) / 100;
        totalProfit += profit;

        await supabase
          .from("sbo_bet_log")
          .update({ result, profit, settled_at: new Date().toISOString() })
          .eq("id", bet.id);

        // Update strategy performance
        if (bet.strategy) {
          const { data: existing } = await supabase
            .from("sbo_strategy_performance")
            .select("*")
            .eq("user_id", user.id)
            .eq("strategy", bet.strategy)
            .single();

          if (existing) {
            const newWins = existing.wins + (result === "won" ? 1 : 0);
            const newLosses = existing.losses + (result === "lost" ? 1 : 0);
            const newTotal = existing.total_bets + 1;
            const newProfit = (existing.total_profit || 0) + profit;
            const totalWagered = newTotal * bet.stake; // approximate
            await supabase.from("sbo_strategy_performance").update({
              wins: newWins, losses: newLosses, total_bets: newTotal,
              total_profit: newProfit,
              roi_pct: totalWagered > 0 ? Math.round(newProfit / totalWagered * 10000) / 100 : 0,
              last_updated: new Date().toISOString(),
            }).eq("id", existing.id);
          } else {
            await supabase.from("sbo_strategy_performance").insert({
              user_id: user.id, strategy: bet.strategy,
              total_bets: 1, wins: result === "won" ? 1 : 0, losses: result === "lost" ? 1 : 0,
              total_profit: profit, roi_pct: profit > 0 ? Math.round(profit / bet.stake * 10000) / 100 : 0,
            });
          }
        }

        settled++;
      }

      // Update wallet
      await supabase.from("sbo_betting_wallet").update({
        bankroll: (wallet.bankroll || 1000) + totalProfit,
        total_profit: (wallet.total_profit || 0) + totalProfit,
        wins: (wallet.wins || 0) + wins,
        losses: (wallet.losses || 0) + losses,
        pushes: (wallet.pushes || 0) + pushes,
        updated_at: new Date().toISOString(),
      }).eq("id", wallet.id);

      return new Response(JSON.stringify({
        success: true, settled, wins, losses, pushes,
        profit: totalProfit.toFixed(2),
        new_bankroll: ((wallet.bankroll || 1000) + totalProfit).toFixed(2),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "daily_report") {
      const reportDate = body.date || today;
      const { data: dayBets } = await supabase
        .from("sbo_bet_log")
        .select("*")
        .eq("user_id", user.id)
        .eq("game_date", reportDate);

      const resolved = (dayBets || []).filter((b: any) => b.result !== "pending");
      const w = resolved.filter((b: any) => b.result === "won").length;
      const l = resolved.filter((b: any) => b.result === "lost").length;
      const wagered = (dayBets || []).reduce((s: number, b: any) => s + (b.stake || 0), 0);
      const profit = resolved.reduce((s: number, b: any) => s + (b.profit || 0), 0);
      const roi = wagered > 0 ? Math.round(profit / wagered * 10000) / 100 : 0;

      // Best strategy
      const stratMap: Record<string, { profit: number; bets: number }> = {};
      for (const b of resolved) {
        const s = b.strategy || "OTHER";
        if (!stratMap[s]) stratMap[s] = { profit: 0, bets: 0 };
        stratMap[s].profit += b.profit || 0;
        stratMap[s].bets++;
      }
      const bestStrat = Object.entries(stratMap).sort(([, a], [, b]) => b.profit - a.profit)[0];

      await supabase.from("sbo_daily_report").upsert({
        user_id: user.id,
        report_date: reportDate,
        total_bets: (dayBets || []).length,
        wins: w, losses: l,
        total_wagered: Math.round(wagered * 100) / 100,
        total_profit: Math.round(profit * 100) / 100,
        roi_pct: roi,
        best_strategy: bestStrat?.[0] || null,
        best_strategy_roi: bestStrat ? Math.round(bestStrat[1].profit * 100) / 100 : 0,
        bankroll_start: wallet.bankroll - profit,
        bankroll_end: wallet.bankroll,
        stop_loss_hit: Math.abs(Math.min(0, profit)) / (wallet.bankroll - profit) * 100 >= wallet.max_daily_loss_pct,
      }, { onConflict: "user_id,report_date" });

      return new Response(JSON.stringify({
        success: true, report: { date: reportDate, bets: (dayBets || []).length, wins: w, losses: l, wagered: wagered.toFixed(2), profit: profit.toFixed(2), roi: roi + "%", best_strategy: bestStrat?.[0] },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "lock_play") {
      // Get today's #1 play
      const { data: props } = await supabase
        .from("props_master")
        .select("id, player_name, stat_type, line, ai_recommendation, composite_score, consensus_score, value_score, ai_confidence, signal_strength, sharp_indicator, is_value_play")
        .eq("game_date", today)
        .not("composite_score", "is", null)
        .order("composite_score", { ascending: false })
        .limit(1);

      const lock = props?.[0];
      if (!lock) {
        return new Response(JSON.stringify({ success: false, reason: "No lock play available" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: true,
        lock_play: {
          ...lock,
          direction: lock.ai_recommendation || "OVER",
          bet_pct: Math.min(5, (lock.composite_score || 0) / 20),
          bet_amount: Math.round(wallet.bankroll * Math.min(5, (lock.composite_score || 0) / 20) / 100 * 100) / 100,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auto-adjust strategy weights
    if (mode === "adjust_weights") {
      const { data: strats } = await supabase
        .from("sbo_strategy_performance")
        .select("*")
        .eq("user_id", user.id);

      if (strats && strats.length > 0) {
        const totalROI = strats.reduce((s: number, st: any) => s + Math.max(0, st.roi_pct || 0), 0);
        for (const strat of strats) {
          const weight = totalROI > 0 ? Math.max(0.1, (Math.max(0, strat.roi_pct || 0) / totalROI)) : 0.25;
          await supabase.from("sbo_strategy_performance").update({ current_weight: Math.round(weight * 100) / 100 }).eq("id", strat.id);
        }
      }

      return new Response(JSON.stringify({ success: true, strategies: strats?.length || 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
