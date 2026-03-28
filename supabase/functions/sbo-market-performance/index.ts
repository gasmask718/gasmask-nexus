import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.text();
  let parsed: any = {};
  try { parsed = JSON.parse(body); } catch { parsed = {}; }
  const mode = parsed.mode || "recalc";

  try {
    if (mode === "recalc") {
      // Recalculate market performance from bet_log
      const { data: bets } = await supabase
        .from("sbo_bet_log")
        .select("user_id, market_type, result, stake, profit, sport")
        .neq("result", "pending");

      if (!bets?.length) {
        return new Response(JSON.stringify({ success: true, message: "No settled bets" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by user + sport + market_type
      const groups: Record<string, any> = {};
      for (const b of bets) {
        const sport = b.sport || "NBA";
        const mt = b.market_type || "prop";
        const key = `${b.user_id}::${sport}::${mt}`;
        if (!groups[key]) {
          groups[key] = { user_id: b.user_id, sport, market_type: mt, wins: 0, losses: 0, pushes: 0, total_wagered: 0, total_profit: 0 };
        }
        const g = groups[key];
        if (b.result === "won") g.wins++;
        else if (b.result === "lost") g.losses++;
        else if (b.result === "push") g.pushes++;
        g.total_wagered += Number(b.stake) || 0;
        g.total_profit += Number(b.profit) || 0;
      }

      let updated = 0;
      for (const g of Object.values(groups) as any[]) {
        const total = g.wins + g.losses;
        const wr = total > 0 ? Math.round((g.wins / total) * 1000) / 10 : 0;
        const roi = g.total_wagered > 0 ? Math.round((g.total_profit / g.total_wagered) * 1000) / 10 : 0;

        // Auto-weight: boost winners, reduce losers
        let weight = 1.0;
        if (total >= 10) {
          if (wr >= 58) weight = 1.3;
          else if (wr >= 55) weight = 1.15;
          else if (wr < 48) weight = 0.5;
          else if (wr < 50) weight = 0.7;
        }

        await supabase.from("sbo_market_performance").upsert({
          user_id: g.user_id,
          sport: g.sport,
          market_type: g.market_type,
          win_rate: wr,
          roi,
          total_bets: total + g.pushes,
          wins: g.wins,
          losses: g.losses,
          pushes: g.pushes,
          current_weight: weight,
          last_recalc_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,sport,market_type" });
        updated++;
      }

      return new Response(JSON.stringify({ success: true, markets_updated: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mode === "get_weights" — return current weights for scoring
    if (mode === "get_weights") {
      const { data } = await supabase
        .from("sbo_market_performance")
        .select("sport, market_type, current_weight, win_rate, roi, total_bets")
        .order("win_rate", { ascending: false });

      return new Response(JSON.stringify({ success: true, weights: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown mode" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
