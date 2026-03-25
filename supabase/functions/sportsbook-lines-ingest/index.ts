import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";

// Platform slug mapping from The Odds API bookmaker keys
const BOOKMAKER_MAP: Record<string, string> = {
  betonlineag: "bovada",
  bovada: "bovada",
  draftkings: "draftkings",
  fanduel: "fanduel",
  betmgm: "betmgm",
  williamhill_us: "caesars",
  pointsbetus: "pointsbet",
  betrivers: "betrivers",
  unibet_us: "unibet",
  wynnbet: "wynnbet",
  superbook: "superbook",
  lowvig: "lowvig",
  betus: "betus",
  mybookieag: "mybookie",
};

// Sport keys supported
const SPORT_KEYS = [
  "basketball_nba",
  "americanfootball_nfl",
  "baseball_mlb",
  "icehockey_nhl",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ODDS_API_KEY = Deno.env.get("ODDS_API_KEY");
    if (!ODDS_API_KEY) throw new Error("ODDS_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const sports = body.sports || ["basketball_nba"];
    const markets = body.markets || ["h2h", "spreads", "totals"];
    const bookmakers = body.bookmakers || Object.keys(BOOKMAKER_MAP).join(",");

    // Fetch platform IDs
    const { data: platforms } = await supabase
      .from("sportsbook_platforms")
      .select("id, slug, name");
    const platformMap = new Map(
      (platforms || []).map((p: any) => [p.slug, p.id])
    );

    const today = new Date().toISOString().split("T")[0];
    let totalInserted = 0;
    let totalEdges = 0;
    const errors: string[] = [];

    for (const sport of sports) {
      try {
        // Fetch odds from The Odds API
        const url = `${ODDS_API_BASE}/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=${markets.join(",")}&bookmakers=${bookmakers}&oddsFormat=american`;
        console.log(`Fetching: ${sport}`);
        const res = await fetch(url);
        if (!res.ok) {
          errors.push(`${sport}: HTTP ${res.status}`);
          continue;
        }

        const events = await res.json();
        console.log(`${sport}: ${events.length} events`);

        const lineRows: any[] = [];

        for (const event of events) {
          const homeTeam = event.home_team;
          const awayTeam = event.away_team;
          const commenceTime = event.commence_time;
          const gameDate = commenceTime
            ? commenceTime.split("T")[0]
            : today;

          for (const bookmaker of event.bookmakers || []) {
            const platformSlug =
              BOOKMAKER_MAP[bookmaker.key] || bookmaker.key;
            const platformId = platformMap.get(platformSlug);

            for (const market of bookmaker.markets || []) {
              if (market.key === "h2h") {
                // Moneyline
                const homeOutcome = market.outcomes?.find(
                  (o: any) => o.name === homeTeam
                );
                const awayOutcome = market.outcomes?.find(
                  (o: any) => o.name === awayTeam
                );
                const drawOutcome = market.outcomes?.find(
                  (o: any) => o.name === "Draw"
                );

                lineRows.push({
                  platform_id: platformId || null,
                  platform_slug: platformSlug,
                  sport,
                  external_event_id: event.id,
                  home_team: homeTeam,
                  away_team: awayTeam,
                  commence_time: commenceTime,
                  market_type: "moneyline",
                  home_odds: homeOutcome?.price || null,
                  away_odds: awayOutcome?.price || null,
                  draw_odds: drawOutcome?.price || null,
                  game_date: gameDate,
                  raw_data: { bookmaker_key: bookmaker.key },
                });
              }

              if (market.key === "spreads") {
                const homeOutcome = market.outcomes?.find(
                  (o: any) => o.name === homeTeam
                );
                const awayOutcome = market.outcomes?.find(
                  (o: any) => o.name === awayTeam
                );

                lineRows.push({
                  platform_id: platformId || null,
                  platform_slug: platformSlug,
                  sport,
                  external_event_id: event.id,
                  home_team: homeTeam,
                  away_team: awayTeam,
                  commence_time: commenceTime,
                  market_type: "spread",
                  spread_home: homeOutcome?.point || null,
                  spread_away: awayOutcome?.point || null,
                  spread_home_odds: homeOutcome?.price || null,
                  spread_away_odds: awayOutcome?.price || null,
                  game_date: gameDate,
                  raw_data: { bookmaker_key: bookmaker.key },
                });
              }

              if (market.key === "totals") {
                const overOutcome = market.outcomes?.find(
                  (o: any) => o.name === "Over"
                );
                const underOutcome = market.outcomes?.find(
                  (o: any) => o.name === "Under"
                );

                lineRows.push({
                  platform_id: platformId || null,
                  platform_slug: platformSlug,
                  sport,
                  external_event_id: event.id,
                  home_team: homeTeam,
                  away_team: awayTeam,
                  commence_time: commenceTime,
                  market_type: "total",
                  total: overOutcome?.point || null,
                  total_over_odds: overOutcome?.price || null,
                  total_under_odds: underOutcome?.price || null,
                  game_date: gameDate,
                  raw_data: { bookmaker_key: bookmaker.key },
                });
              }
            }
          }
        }

        if (lineRows.length > 0) {
          // Clear today's stale lines for this sport
          await supabase
            .from("sportsbook_line_events")
            .delete()
            .eq("sport", sport)
            .eq("game_date", today);

          // Batch insert
          const batchSize = 100;
          for (let i = 0; i < lineRows.length; i += batchSize) {
            const batch = lineRows.slice(i, i + batchSize);
            const { error: insertErr } = await supabase
              .from("sportsbook_line_events")
              .insert(batch);
            if (insertErr) {
              console.error(`Insert error: ${insertErr.message}`);
              errors.push(`${sport} insert: ${insertErr.message}`);
            }
          }
          totalInserted += lineRows.length;
        }

        // === EDGE DETECTION ===
        // Group lines by event + market
        const eventGroups: Record<string, any[]> = {};
        for (const row of lineRows) {
          const key = `${row.external_event_id}|${row.market_type}`;
          if (!eventGroups[key]) eventGroups[key] = [];
          eventGroups[key].push(row);
        }

        const edgeRows: any[] = [];
        for (const [, group] of Object.entries(eventGroups)) {
          if (group.length < 2) continue;
          const first = group[0];

          if (first.market_type === "moneyline") {
            const homeOdds = group
              .filter((g: any) => g.home_odds != null)
              .map((g: any) => ({ platform: g.platform_slug, odds: g.home_odds }));
            if (homeOdds.length < 2) continue;
            const best = homeOdds.reduce((a: any, b: any) => (b.odds > a.odds ? b : a));
            const worst = homeOdds.reduce((a: any, b: any) => (b.odds < a.odds ? b : a));
            const spread = Math.abs(best.odds - worst.odds);
            if (spread >= 15) {
              edgeRows.push({
                sport: first.sport,
                game_date: first.game_date,
                home_team: first.home_team,
                away_team: first.away_team,
                market_type: "moneyline",
                best_platform: best.platform,
                best_line: best.odds,
                worst_platform: worst.platform,
                worst_line: worst.odds,
                line_spread: spread,
                edge_score: Math.min(100, Math.round(spread / 2)),
                recommendation: spread >= 40 ? "strong_play" : spread >= 25 ? "medium_play" : "monitor",
                platforms_compared: homeOdds,
              });
            }
          }

          if (first.market_type === "spread") {
            const spreads = group
              .filter((g: any) => g.spread_home != null)
              .map((g: any) => ({ platform: g.platform_slug, spread: g.spread_home, odds: g.spread_home_odds }));
            if (spreads.length < 2) continue;
            const values = spreads.map((s: any) => s.spread);
            const range = Math.max(...values) - Math.min(...values);
            if (range >= 1) {
              const best = spreads.reduce((a: any, b: any) => (b.spread > a.spread ? b : a));
              const worst = spreads.reduce((a: any, b: any) => (b.spread < a.spread ? b : a));
              edgeRows.push({
                sport: first.sport,
                game_date: first.game_date,
                home_team: first.home_team,
                away_team: first.away_team,
                market_type: "spread",
                best_platform: best.platform,
                best_line: best.spread,
                worst_platform: worst.platform,
                worst_line: worst.spread,
                line_spread: range,
                edge_score: Math.min(100, Math.round(range * 15)),
                recommendation: range >= 3 ? "strong_play" : range >= 2 ? "medium_play" : "monitor",
                platforms_compared: spreads,
              });
            }
          }

          if (first.market_type === "total") {
            const totals = group
              .filter((g: any) => g.total != null)
              .map((g: any) => ({ platform: g.platform_slug, total: g.total, over: g.total_over_odds, under: g.total_under_odds }));
            if (totals.length < 2) continue;
            const values = totals.map((t: any) => t.total);
            const range = Math.max(...values) - Math.min(...values);
            if (range >= 1) {
              const best = totals.reduce((a: any, b: any) => (b.total > a.total ? b : a));
              const worst = totals.reduce((a: any, b: any) => (b.total < a.total ? b : a));
              edgeRows.push({
                sport: first.sport,
                game_date: first.game_date,
                home_team: first.home_team,
                away_team: first.away_team,
                market_type: "total",
                best_platform: best.platform,
                best_line: best.total,
                worst_platform: worst.platform,
                worst_line: worst.total,
                line_spread: range,
                edge_score: Math.min(100, Math.round(range * 12)),
                recommendation: range >= 3 ? "strong_play" : range >= 1.5 ? "medium_play" : "monitor",
                platforms_compared: totals,
              });
            }
          }
        }

        if (edgeRows.length > 0) {
          await supabase
            .from("sportsbook_edge_analysis")
            .delete()
            .eq("sport", sport)
            .eq("game_date", today);

          const { error: edgeErr } = await supabase
            .from("sportsbook_edge_analysis")
            .insert(edgeRows);
          if (edgeErr) errors.push(`Edge insert: ${edgeErr.message}`);
          totalEdges += edgeRows.length;
        }
      } catch (sportErr: any) {
        errors.push(`${sport}: ${sportErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        lines_ingested: totalInserted,
        edges_detected: totalEdges,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Ingest error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
